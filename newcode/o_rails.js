  // ---- BALL RETURN: drop tubes, rails and the tray (rigid-body physics) ------
  // A potted ball drops through its pocket's leather tube onto a pair of
  // chrome rails under the cushion, rolls down the slope to the baulk end and
  // into the tray, where balls queue against each other. Everything is real
  // 3D contact physics (gravity, rails as capsules, ball-ball impacts, rolling
  // resistance); nothing is scripted. The referee takes colours from the tray.
  const RAIL_R=.006,RAIL_GAP=.017,GUARD_W=.038,GUARD_H=.045,TRAY_X=-(HX+.045),TRAY_Y=-.452;
  const railCaps=[],dropTubes=[],railLine=[];
  const railY=x=>-.29+(x-(HX+.01))*.031;              // ~1.8° fall toward the baulk end
  function channel(a,b,guards=true){                    // a,b: [x,y,z] centreline at rail height
    railLine.push([a,b]);const dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;
    for(const s of [-1,1]){
      railCaps.push({a:[a[0]+nx*RAIL_GAP*s,a[1],a[2]+nz*RAIL_GAP*s],b:[b[0]+nx*RAIL_GAP*s,b[1],b[2]+nz*RAIL_GAP*s],r:RAIL_R,show:true,sup:true});
      if(guards)railCaps.push({a:[a[0]+nx*GUARD_W*s,a[1]+GUARD_H,a[2]+nz*GUARD_W*s],b:[b[0]+nx*GUARD_W*s,b[1]+GUARD_H,b[2]+nz*GUARD_W*s],r:RAIL_R,show:true});
    }
  }
  for(const zs of [-1,1]){
    const zc=zs*(HZ-.05),xa=HX+.03,xb=-(HX-.08),bend=[-(HX+.025),railY(-(HX+.025))-.006,zs*(HZ-.13)];
    channel([xa,railY(xa),zc],[xb,railY(xb),zc]);
    channel([xb,railY(xb),zc],bend);
    channel(bend,[TRAY_X,TRAY_Y+.02,zs*(HZ-.17)]);
    channel([TRAY_X,TRAY_Y+.02,zs*(HZ-.17)],[TRAY_X,TRAY_Y,0],true);
    // end stops: across the top end of each side rail and at the tray's middle
    railCaps.push({a:[xa+.012,railY(xa)+.005,zc-.05],b:[xa+.012,railY(xa)+.005,zc+.05],r:.008,show:true});
  }
  // Each pocket's tube leads from the pocket down to the nearest point of the
  // rails (the middle pockets sit outside the rail line, so theirs slant).
  for(const p of POCKETS){
    let bx=p.x,bz=p.z,bd=1e9;
    for(const [a,b] of railLine){const ex=b[0]-a[0],ez=b[2]-a[2],t=clamp(((p.x-a[0])*ex+(p.z-a[2])*ez)/(ex*ex+ez*ez||1),0,1),qx=a[0]+ex*t,qz=a[2]+ez*t,d=Math.hypot(qx-p.x,qz-p.z);
      if(d<bd){bd=d;bx=qx;bz=qz;}}
    dropTubes.push({x:p.x,z:p.z,bx,bz,top:CLOTH_Y-.02,bottom:railY(bx)+.075,r:p.radius*.9});
  }
  // Visuals: leather tubes under the pockets, chrome rails with hangers.
  (()=>{
    const chrome=new T.MeshStandardMaterial({color:'#c9ccd1',roughness:.22,metalness:.95,envMapIntensity:1.1});
    const leather=new T.MeshStandardMaterial({color:'#17100c',roughness:.62,side:T.DoubleSide});
    const up=new T.Vector3(0,1,0),grp=new T.Group();scene.add(grp);
    for(const c of railCaps){if(!c.show)continue;
      const a=new T.Vector3(...c.a),b=new T.Vector3(...c.b),len=a.distanceTo(b);
      const m=new T.Mesh(new T.CylinderGeometry(c.r,c.r,len,10),chrome);m.position.copy(a).add(b).multiplyScalar(.5);
      m.quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());m.castShadow=true;grp.add(m);}
    for(const t of dropTubes){
      const a=new T.Vector3(t.bx,t.bottom,t.bz),b=new T.Vector3(t.x,t.top,t.z),m=new T.Mesh(new T.CylinderGeometry(t.r+.004,t.r*.92+.004,a.distanceTo(b),24,1,true),leather);
      m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(up,b.sub(a).normalize());grp.add(m);}
    // Hangers from the frame to the rails.
    const hang=(x,z,y0)=>{const y1=-.219,m=new T.Mesh(new T.CylinderGeometry(.004,.004,y1-y0,6),chrome);m.position.set(x,(y0+y1)/2,z);grp.add(m);};
    for(const zs of [-1,1]){for(const x of [-1.2,-.4,.4,1.2])for(const s of [-1,1])hang(x,zs*(HZ-.05)+s*GUARD_W,railY(x)+GUARD_H);
      for(const s of [-1,1])hang(TRAY_X+s*GUARD_W,zs*.45,TRAY_Y+.012+GUARD_H);}
    // one draw call per material instead of one per piece
    grp.updateMatrixWorld(true);
    for(const mat of [chrome,leather]){const parts=grp.children.filter(m=>m.material===mat);if(parts.length<2)continue;
      const one=new T.Mesh(T.BufferGeometryUtils.mergeGeometries(parts.map(m=>m.geometry.clone().applyMatrix4(m.matrixWorld))),mat);
      for(const m of parts){grp.remove(m);m.geometry.dispose();}
      one.castShadow=mat===chrome;grp.add(one);}
  })();
  // Physics step for balls in the return system.
  const _cp=[0,0,0];
  function closestOnSeg(p,a,b){
    const abx=b[0]-a[0],aby=b[1]-a[1],abz=b[2]-a[2],L=abx*abx+aby*aby+abz*abz||1;
    const t=clamp(((p[0]-a[0])*abx+(p[1]-a[1])*aby+(p[2]-a[2])*abz)/L,0,1);
    _cp[0]=a[0]+abx*t;_cp[1]=a[1]+aby*t;_cp[2]=a[2]+abz*t;return _cp;
  }
  function railStep(f,ds){
    f.touch=Math.max(0,(f.touch||0)-ds);
    f.vy-=GRAVITY*(f.touch>0?.71:1)*ds;              // a rolling ball accelerates at 5/7 g along a slope
    f.x+=f.vx*ds;f.y+=f.vy*ds;f.z+=f.vz*ds;
    // drop tube: the pocket's leather (and its tube below) keeps the ball in
    const t=dropTubes[f.pocketId];
    if(t&&f.y>t.bottom){
      const u=clamp((t.top-f.y)/(t.top-t.bottom),0,1),cx=t.x+(t.bx-t.x)*u,cz=t.z+(t.bz-t.z)*u;
      const dx=f.x-cx,dz=f.z-cz,d=Math.hypot(dx,dz),lim=t.r-R;
      if(d>lim&&d>1e-6){const nx=dx/d,nz=dz/d,c=f.y>t.top?Math.min(d-lim,.004):d-lim;f.x-=nx*c;f.z-=nz*c;
        const vn=f.vx*nx+f.vz*nz;if(vn>0){f.vx-=1.35*vn*nx;f.vz-=1.35*vn*nz;if(vn>.6)f.clack=Math.max(f.clack||0,vn*.6);}f.vx*=.97;f.vz*=.97;}
    }
    const p=[f.x,f.y,f.z];
    for(const c of railCaps){
      if(Math.abs(f.x-(c.a[0]+c.b[0])/2)>Math.abs(c.a[0]-c.b[0])/2+.1||Math.abs(f.z-(c.a[2]+c.b[2])/2)>Math.abs(c.a[2]-c.b[2])/2+.1)continue;
      const q=closestOnSeg(p,c.a,c.b),dx=p[0]-q[0],dy=p[1]-q[1],dz=p[2]-q[2],d=Math.hypot(dx,dy,dz),min=R+c.r;
      if(d>=min||d<1e-7)continue;
      let nx=dx/d,ny=dy/d,nz=dz/d,pen=min-d;
      if(c.sup&&ny<0){ny=-ny;f.x=q[0]+nx*min;f.y=q[1]+ny*min;f.z=q[2]+nz*min;pen=0;}   // a support rail only ever holds a ball up
      f.x+=nx*pen;f.y+=ny*pen;f.z+=nz*pen;p[0]=f.x;p[1]=f.y;p[2]=f.z;
      const vn=f.vx*nx+f.vy*ny+f.vz*nz;
      if(vn<0){const e=vn<-.35?.3:0;f.vx-=(1+e)*vn*nx;f.vy-=(1+e)*vn*ny;f.vz-=(1+e)*vn*nz;
        if(-vn>.35)f.clack=Math.max(f.clack||0,-vn);}
      if(ny>.3)f.touch=.05;
    }
    if(f.touch>0){const k=Math.exp(-.35*ds);f.vx*=k;f.vy*=k;f.vz*=k;}
    if(f.y<FLOOR_Y+R){f.y=FLOOR_Y+R;f.vy=Math.abs(f.vy)*.3;f.vx*=.9;f.vz*=.9;f.touch=.05;}  // safety net: the floor
    // the ball turns as it rolls
    const vh=Math.hypot(f.vx,f.vz);
    if(vh>1e-4&&f.touch>0){if(!f.qq)f.qq=new T.Quaternion();_rq.setFromAxisAngle(_ra.set(f.vz/vh,0,-f.vx/vh),vh*ds/(R*.8));f.qq.premultiply(_rq);}
  }
  const _rq=new T.Quaternion(),_ra=new T.Vector3();
  function updateFalling(dt){
    const h=Math.min(dt,.05),steps=Math.max(1,Math.ceil(h/(1/240))),ds=h/steps;
    for(let i=0;i<steps;i++){
      for(const f of falling){if(!f.sleep)railStep(f,ds);}
      for(let a=0;a<falling.length;a++)for(let b=a+1;b<falling.length;b++){
        const A=falling[a],B=falling[b];
        const dx=B.x-A.x,dy=B.y-A.y,dz=B.z-A.z,d=Math.hypot(dx,dy,dz),min=2*R;
        if(d>=min)continue;
        const nx=d>1e-7?dx/d:0,ny=d>1e-7?dy/d:1,nz=d>1e-7?dz/d:0,pen=(min-d)/2;
        A.x-=nx*pen;A.y-=ny*pen;A.z-=nz*pen;B.x+=nx*pen;B.y+=ny*pen;B.z+=nz*pen;
        if(pen>.0003)for(const F of [A,B])if(F.sleep){F.sleep=false;F.rest=0;}   // a pushed ball wakes up
        const rv=(B.vx-A.vx)*nx+(B.vy-A.vy)*ny+(B.vz-A.vz)*nz;
        if(rv<0){const j=-(1+.55)*rv/2;A.vx-=j*nx;A.vy-=j*ny;A.vz-=j*nz;B.vx+=j*nx;B.vy+=j*ny;B.vz+=j*nz;
          if(-rv>.12){A.sleep=B.sleep=false;A.rest=B.rest=0;if(-rv>.3)A.clack=Math.max(A.clack||0,-rv);}}
      }
    }
    for(const f of falling){
      if(f.clack){if(f.clack>.3)sound('click',f.clack*.5,f.x,f.z);f.clack=0;}
      const sp=Math.hypot(f.vx,f.vy,f.vz);
      f.rest=sp<.012&&f.touch>0?(f.rest||0)+h:0;
      if(f.rest>.5&&!f.sleep){f.sleep=true;f.vx=f.vy=f.vz=0;}
      f.inTray=Math.abs(f.x-TRAY_X)<.09&&f.y<TRAY_Y+.11;
    }
  }
  function netSimStep(){}
  function syncNets(){}
