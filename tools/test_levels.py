"""Bot levels: same random tables for every level; the bot plans (async, as in
play) and each shot is run with the game's own physics on a copy of the table.

usage: python3 -I test_levels.py <test index.html> [trials]
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright

ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]

RUN = """async ([id, level, trials]) => {
  const s=__T.state; __T.setBot(id, level);
  let seed=12345; const rnd=()=>((seed=(seed*1103515245+12345)%2147483648)/2147483648);
  const HX=1.7845, HZ=0.889, R=0.02625;
  const out={pot:0,potIn:0,safety:0,safetyFoul:0,leave:0,escape:0,foul:0,ms:[],next:0,nextN:0};
  for(let t=0;t<trials;t++){
    __T.newRack(false); Object.assign(s,{mode:'bot',started:true,finished:true,current:1,ballInHand:false,shotCount:5,phase:'red',freeBall:false});
    const b=__T.balls, n=2+Math.floor(rnd()*9), placed=b.filter(x=>x.type!=='red'&&x.type!=='cue');
    b.filter(x=>x.type==='red').forEach((r,i)=>{ if(i>=n){r.pocketed=true;return;} });
    for(const x of b.filter(x=>(x.type==='red'&&!x.pocketed)||x.type==='cue')){
      for(let k=0;k<200;k++){ const px=(rnd()*2-1)*(HX-.07), pz=(rnd()*2-1)*(HZ-.07);
        if(placed.every(o=>Math.hypot(o.x-px,o.z-pz)>2*R+.01)){x.x=px;x.z=pz;placed.push(x);break;} } }
    const t0=performance.now(); const p=await __T.chooseBotShot(); out.ms.push(performance.now()-t0);
    if(!p)continue;
    const res=__T.simulateShot(p.aim,p); const on=['red'];
    const legal=res&&!res.cueScratch&&res.first==='red'&&res.potted.every(x=>x==='red');
    if(!legal)out.foul++;
    if(p.kind==='pot'){out.pot++; if(legal&&res.potted.includes('red')){out.potIn++;
        // what the bot left itself on a colour (Very Hard eyes)
        let best=0; for(const o of __T.potOptions(['yellow','green','brown','blue','pink','black'],res.arr)) best=Math.max(best,__T.potChance(o,.0009,1));
        out.next+=best; out.nextN++; } }
    else if(p.kind==='escape')out.escape++;
    else { out.safety++; if(!legal)out.safetyFoul++; else { let best=0;
        for(const o of __T.potOptions(['red'],res.arr)) best=Math.max(best,__T.potChance(o,.0009,1)); out.leave+=best; } }
  }
  const ms=out.ms.sort((a,b)=>a-b);
  return {id,level,trials,pots:out.pot,potted:out.potIn,pot_rate:+(out.potIn/Math.max(1,out.pot)).toFixed(2),
    safeties:out.safety,safety_fouls:out.safetyFoul,opp_chance_after_safety:+(out.leave/Math.max(1,out.safety-out.safetyFoul)).toFixed(2),
    escapes:out.escape,fouls:out.foul,next_colour_chance:+(out.next/Math.max(1,out.nextN)).toFixed(2),
    plan_ms_median:Math.round(ms[ms.length>>1]),plan_ms_max:Math.round(ms[ms.length-1])};
}"""

BREAKS = """async ([id, level, trials]) => {
  const s=__T.state; __T.setBot(id, level);
  let seed=777; const rnd=()=>((seed=(seed*1103515245+12345)%2147483648)/2147483648);
  const HX=1.7845, HZ=0.889, R=0.02625, V={red:1,yellow:2,green:3,brown:4,blue:5,pink:6,black:7};
  const breaks=[]; let shots=0, pots=0, ms=0;
  for(let t=0;t<trials;t++){
    __T.newRack(false); Object.assign(s,{mode:'bot',started:true,finished:true,current:1,ballInHand:false,shotCount:5,phase:'red',freeBall:false,nominated:null});
    const b=__T.balls, n=4+Math.floor(rnd()*6), placed=b.filter(x=>x.type!=='red'&&x.type!=='cue');
    b.filter(x=>x.type==='red').forEach((r,i)=>{ if(i>=n)r.pocketed=true; });
    for(const x of b.filter(x=>(x.type==='red'&&!x.pocketed)||x.type==='cue'))
      for(let k=0;k<200;k++){ const px=(rnd()*2-1)*(HX-.07), pz=(rnd()*2-1)*(HZ-.07);
        if(placed.every(o=>Math.hypot(o.x-px,o.z-pz)>2*R+.01)){x.x=px;x.z=pz;placed.push(x);break;} }
    let brk=0;
    for(let k=0;k<40;k++){
      if(!b.some(x=>x.type==='red'&&!x.pocketed)&&s.phase==='red')break;
      const t0=performance.now(); const p=await __T.chooseBotShot(); ms+=performance.now()-t0; shots++;
      if(!p||p.kind!=='pot')break;
      const on=__T.ballsOnTypes(), res=__T.simulateShot(p.aim,p);
      const legal=res&&!res.cueScratch&&on.includes(res.first)&&res.potted.length&&res.potted.every(x=>on.includes(x));
      if(!legal)break;
      for(const c of res.arr){const o=b.find(x=>x.id===c.id); o.x=c.x;o.z=c.z;o.vx=o.vz=o.wx=o.wz=o.wy=0; if(c.pocketed)o.pocketed=true;}
      pots++; brk+=res.potted.reduce((a,x)=>a+V[x],0);
      if(s.phase==='red'){s.phase='color';s.nominated=null;}
      else{ for(const x of res.potted){const o=b.find(y=>y.type===x); o.pocketed=false; __T.resPot(x);} s.phase='red';s.nominated=null; }
    }
    breaks.push(brk);
  }
  breaks.sort((a,b)=>a-b);
  return {id,level,trials,avg_break:+(breaks.reduce((a,x)=>a+x,0)/trials).toFixed(1),median:breaks[trials>>1],best:breaks[trials-1],
    pots_per_visit:+(pots/trials).toFixed(1),ms_per_shot:Math.round(ms/shots)};
}"""


def main():
    url = pathlib.Path(sys.argv[1]).resolve().as_uri()
    trials = int(sys.argv[2]) if len(sys.argv) > 2 else 40
    rows, errors = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(url)
        pg.wait_for_function('window.__T && window.__T.balls && window.__T.balls.length>0', timeout=120000)
        for id_, lv in [('club', 'easy'), ('club', 'medium'), ('club', 'hard'), ('club', 'veryhard')] + ([] if len(sys.argv) > 3 else [
                        ('osullivan', 'veryhard'), ('selby', 'veryhard')]):
            r = pg.evaluate(RUN, [id_, lv, trials])
            r.update(pg.evaluate(BREAKS, [id_, lv, trials]))
            rows.append(r)
            print(json.dumps(r), flush=True)
        b.close()
    print('errors:', errors)


if __name__ == '__main__':
    main()
