"""Pocket physics: real jaws instead of a capture circle.

Rolls single balls at the corner and middle pockets over a sweep of entry
angles and offsets and reports how wide each pocket plays, then checks the
cases that used to be wrong: balls swallowed from the cloth in front of a
pocket, balls cut into a jaw, full-power balls into the facings.
Usage: python3 tools/test_pockets.py path/to/testcopy/index.html
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]

LIB = r"""
window.__pk = (() => {
  const T=__T,{R,HX,HZ,POCKETS}=T.K;
  // roll one ball (naturally rolling, or sliding when slide=true); returns
  // the pocket that took it (-1: none), jaw hits, and where it ended
  function roll(x,z,dir,speed,slide){
    const b={x,z,vx:Math.cos(dir)*speed,vz:Math.sin(dir)*speed,wx:0,wy:0,wz:0,q:[0,0,0,1]};
    if(!slide){b.wz=-b.vx/R;b.wx=b.vz/R;}
    let pot=-1,jaws=0,rails=0,maxOut=0,bad=0;
    const onP=(bb,i)=>{pot=i;},onC=(v,kind)=>{if(kind==='jaw')jaws++;else rails++;};
    for(let i=0;i<180*8;i++){
      T.advanceOnCloth(b,T.STEP);
      if(T.tableContacts(b,onP,onC))break;
      maxOut=Math.max(maxOut,Math.abs(b.x)-HX,Math.abs(b.z)-HZ);if(invalid(b))bad++;
      if(!b.vx&&!b.vz)break;
    }
    return {pot,jaws,rails,x:b.x,z:b.z,maxOut,bad};
  }
  // inside the rubber: behind a facing, or past a cushion nose where the cushion runs
  function invalid(b){
    const ca=HX-T.K.R,eps=.0015;
    for(const j of T.JAWS){const t=((b.x-j.ax)*j.ex+(b.z-j.az)*j.ez)/j.l2;if(t<=0||t>=1)continue;
      const qx=j.ax+j.ex*t,qz=j.az+j.ez*t,side=(b.x-qx)*j.nx+(b.z-qz)*j.nz,perp=Math.hypot(b.x-qx,b.z-qz);
      if(perp<R+j.r+.004&&side<R+j.r-eps)return true;}
    return false;
  }
  // sweep lateral offsets for a ball sent at `angle` (deg) off the pocket's
  // axis, from `dist` metres out; returns the potting width in mm
  function sweep(pi,angle,speed,dist=.7){
    const p=POCKETS[pi],ax=Math.atan2(p.uz,p.ux),dir=ax+angle*Math.PI/180;
    const dx=Math.cos(dir),dz=Math.sin(dir),nx=-dz,nz=dx;
    let n=0,first=null,last=null,tried=0;const hits=[];
    for(let o=-.06;o<=.0601;o+=.001){
      const x=p.ax-dx*dist+nx*o,z=p.az-dz*dist+nz*o;
      if(Math.abs(x)>HX-R-.001||Math.abs(z)>HZ-R-.001)continue;
      tried++;
      const r=roll(x,z,dir,speed);
      if(r.pot===pi&&!r.rails){n++;if(first===null)first=o;last=o;hits.push(r.jaws);}
    }
    return {angle,speed,width:n,from:first===null?null:+(first*1000).toFixed(0),to:last===null?null:+(last*1000).toFixed(0),
      rattledIn:hits.filter(j=>j>0).length,tried};
  }
  return {roll,sweep};
})();
"""


def run(path):
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(pathlib.Path(path).resolve().as_uri()); pg.wait_for_function('window.__T', timeout=120000)
        pg.evaluate(LIB)
        # 1 how wide each pocket plays, by entry angle (positive: from the side-cushion side)
        out['corner'] = [pg.evaluate("([a,s])=>__pk.sweep(3,a,s)", [a, s]) for s in (0.9, 2.6) for a in (0, 15, 30, 40, 45, -30, -45)]
        out['middle'] = [pg.evaluate("([a,s])=>__pk.sweep(5,a,s)", [a, s]) for s in (0.9, 2.6) for a in (0, 20, 35, 45, 55, 62, -45)]
        # 2 no more black hole: balls that pass in front of a corner, or stop
        #   in front of it, stay on the table
        out['no_black_hole'] = pg.evaluate("""() => { const {HX,HZ,R}=__T.K,r=[];
          // rolling up the table 8 cm off the end cushion into the side cushion near the corner
          r.push(['8cm off the end cushion, into the side cushion', __pk.roll(HX-.08,HZ-.5,Math.PI/2,1.2).pot]);
          // 7 cm off the side cushion into the end cushion: the old capture circle took it
          r.push(['7 cm off the side cushion, into the end cushion', __pk.roll(HX-.5,HZ-.07,0,.8).pot]);
          // a slow ball that dies 5 cm short of the corner
          r.push(['slow ball dies short', __pk.roll(HX-.30,HZ-.30,Math.PI/4,.38).pot]);
          // along the side cushion past the middle pocket at speed (may drop in the far corner)
          r.push(['fast down the side cushion past the middle', __pk.roll(-1.0,HZ-R,0,3.0).pot===5?5:-1]);
          return r; }""")
        # 3 a ball rolling down the cushion into the corner drops (slow and firm)
        out['down_the_cushion'] = pg.evaluate("""() => { const {HX,HZ,R}=__T.K;
          return [.6,1.2,2.4].map(s=>({speed:s,pot:__pk.roll(HX-.6,HZ-R,0,s).pot})); }""")
        # 4 full power into the jaws from many angles: never through a facing
        out['tunnel'] = pg.evaluate("""() => { const {HX,HZ,R,POCKETS}=__T.K;let bad=0,pots=0,n=0;
          for(const pi of [3,5])for(let a=-60;a<=60;a+=3)for(let o=-.05;o<=.05;o+=.005){
            const p=POCKETS[pi],dir=Math.atan2(p.uz,p.ux)+a*Math.PI/180,dx=Math.cos(dir),dz=Math.sin(dir);
            const x=p.ax-dx*.5-dz*o,z=p.az-dz*.5+dx*o;if(Math.abs(x)>HX-R||Math.abs(z)>HZ-R)continue;
            const r=__pk.roll(x,z,dir,4.9,true);n++;if(r.pot>=0)pots++;
            if(r.bad)bad++;}
          return {shots:n,potted:pots,escaped_the_table:bad}; }""")
        out['errors'] = errs
        b.close()
    return out


if __name__ == '__main__':
    res = run(sys.argv[1])
    print(json.dumps(res, indent=1))
    ok = (not res['errors'] and res['tunnel']['escaped_the_table'] == 0
          and all(x[1] < 0 for x in res['no_black_hole'])
          and all(x['pot'] >= 0 for x in res['down_the_cushion']))
    print('PASS' if ok else 'FAIL')
