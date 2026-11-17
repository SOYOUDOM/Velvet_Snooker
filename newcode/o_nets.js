  // ---- POCKET RAILS: brass ring, wire basket and the chrome ball-return rail
  // A potted ball drops through the pocket into a wire basket, out of its
  // bottom onto a chrome rail (two tubes it rides on, two above to keep it
  // there) that turns along the side of the table under the cushion rail and
  // runs gently down to a U-bend, where it waits with the others. Real 3D
  // contact physics (gravity, the tubes as capsules, ball-ball impacts);
  // nothing is scripted. The referee takes colours off the rail of the pocket
  // they fell into, and clears the reds from a rail when it fills up.
  const TRAY_X=-(HX+.045),TRAY_Y=-.452;          // the old ball tray (kept for older callers)
  const railCaps=[],dropTubes=[],NET_CRADLES=[],ROD_R=.0062;
  (function buildCradles(){
    POCKETS.forEach((p,pid)=>{
      const sz=Math.sign(p.z)||1,al=p.corner?-Math.sign(p.x):1;          // along the side: from a corner toward the middle; from a middle pocket toward the top
      const ringY=CLOTH_Y-.05,ringR=p.radius+.006,y0=ringY-.15,zr=sz*(OUT_Z+.058),L=p.corner?.47:.42;
      // the line a ball's centre follows (sitting on the two lower tubes): under the pocket, out past the
      // table's body, round the bend and along to the end
      // straight out from under the pocket, a wide quarter turn (so the tubes on the inside of the bend never
      // pinch the ball), then along the side, sloping down all the way
      const Rb=.09,flat=[[p.x,p.z-sz*.02],[p.x,p.z]],zt=zr-sz*Rb;
      flat.push([p.x,(p.z+zt)/2],[p.x,zt]);
      for(let k=1;k<=5;k++){const a=k/5*PI/2;flat.push([p.x+al*Rb*(1-Math.cos(a)),zt+sz*Rb*Math.sin(a)]);}
      flat.push([p.x+al*(Rb+.08),zr],[p.x+al*L,zr]);
      let run=0;const lens=flat.map((q,k)=>k?(run+=Math.hypot(q[0]-flat[k-1][0],q[1]-flat[k-1][1])):0),turnEnd=lens[8],total=lens[lens.length-1];
      const line=flat.map((q,k)=>{const d=Math.max(0,lens[k]-lens[1]),te=turnEnd-lens[1];
        return[q[0],k===0?y0+.003:d<=te?y0-.036*d/te:y0-.036-.036*(d-te)/(total-turnEnd),q[1]];});
      const A=line[1],E=line[line.length-1],B=line[8];
      // each point's sideways direction (half way between its two segments)
      const side=line.map((q,k)=>{const a=line[Math.max(0,k-1)],b=line[Math.min(line.length-1,k+1)],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;return[-dz/l,dx/l];});
      const off=(k,l,dy)=>[line[k][0]+side[k][0]*l,line[k][1]+dy,line[k][2]+side[k][1]*l];
      dropTubes.push({x:p.x,z:p.z,bx:p.x+(B[0]-A[0])*.15,bz:p.z+(B[2]-A[2])*.15,top:CLOTH_Y-.02,bottom:y0+.04,r:p.radius+.004});
      const tubes=[];
      for(const [l,dy,sup] of [[-.0175,-R-.002,true],[.0175,-R-.002,true],[-.039,.012,false],[.039,.012,false]]){
        const pts=line.map((q,k)=>off(k,l,dy));tubes.push({pts,sup,l,dy});
        for(let k=0;k+1<pts.length;k++)railCaps.push({a:pts[k],b:pts[k+1],r:ROD_R,sup});
      }
      const ex=E[0]+al*.016,dz=sz;   // the end: the lower tubes meet in a U, a bar across stops the balls
      railCaps.push({a:[ex,E[1]+.006,zr-.05],b:[ex,E[1]+.006,zr+.05],r:.011});
      const bk=line[0];railCaps.push({a:[bk[0]-side[0][0]*.06,bk[1]-.004,bk[2]-side[0][1]*.06],b:[bk[0]+side[0][0]*.06,bk[1]-.004,bk[2]+side[0][1]*.06],r:.012});   // the back of the basket
      NET_CRADLES.push({pid,end:[E[0]-al*.045,E[1]+.02,zr],ringY,ringR,y0,y1:E[1],line,tubes,al,zr,corner:p.corner});
    });
  })();
  // Visuals: the brass ring, a wire basket under it, chrome tubes with a U at the end and caps on the upper
  // tubes, small brackets holding the rail to the table.
  (()=>{
    const netTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
      g.strokeStyle='#ffffff';g.lineWidth=5;g.lineCap='round';
      for(let k=-128;k<=256;k+=32){g.beginPath();g.moveTo(k,0);g.lineTo(k+128,128);g.stroke();g.beginPath();g.moveTo(k,128);g.lineTo(k+128,0);g.stroke();}
      const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=maxAniso;t.colorSpace=T.SRGBColorSpace;return t;})();
    const netMat=new T.MeshStandardMaterial({map:netTex,alphaTest:.42,side:T.DoubleSide,color:'#e9ebee',roughness:.35,metalness:.75});
    const rodMat=new T.MeshPhysicalMaterial({color:'#e6e8eb',roughness:.12,metalness:1,clearcoat:.6,clearcoatRoughness:.08});
    const strapMat=new T.MeshStandardMaterial({color:'#121112',roughness:.55});
    const nets=[],rods=[],brass=[],chrome=[],V=(a)=>new T.Vector3(a[0],a[1],a[2]);
    for(const c of NET_CRADLES){const p=POCKETS[c.pid],{ringY,ringR,y0,line,tubes,al,zr}=c;
      brass.push(new T.TorusGeometry(ringR,.0042,10,56).rotateX(PI/2).translate(p.x,ringY,p.z));
      // the basket: a wire cylinder from the ring down to the rail, a chrome hoop at its foot
      const bh=ringY-(y0+.012),bas=new T.CylinderGeometry(ringR+.002,ringR-.004,bh,40,1,true);
      const uv=bas.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*9,uv.getY(i)*bh/.034);
      nets.push(bas.translate(p.x,ringY-bh/2,p.z));
      chrome.push(new T.TorusGeometry(ringR-.004,.0035,8,40).rotateX(PI/2).translate(p.x,y0+.012,p.z));
      // the tubes, smooth through the bends
      for(const t of tubes){const curve=new T.CatmullRomCurve3(t.pts.map(V),false,'centripetal',.5);rods.push(new T.TubeGeometry(curve,72,ROD_R,10,false));
        if(!t.sup)chrome.push(new T.SphereGeometry(ROD_R*1.35,12,8).translate(...t.pts[t.pts.length-1]),new T.SphereGeometry(ROD_R*1.35,12,8).translate(...t.pts[0]));}
      // the U at the end of the lower tubes, and the stop bar across
      const lo=tubes.filter(t=>t.sup),a=lo[0].pts[lo[0].pts.length-1],b=lo[1].pts[lo[1].pts.length-1],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],r=Math.hypot(a[0]-b[0],a[2]-b[2])/2;
      const u=new T.TorusGeometry(r,ROD_R,10,24,PI);u.rotateX(PI/2);u.rotateY(al>0?PI/2:-PI/2);u.translate(...mid);rods.push(u);
      const hi=tubes.filter(t=>!t.sup),h1=hi[0].pts[hi[0].pts.length-1],h2=hi[1].pts[hi[1].pts.length-1];
      const bar=new T.CylinderGeometry(.0045,.0045,Math.hypot(h1[0]-h2[0],h1[2]-h2[2]),10);bar.rotateX(PI/2);bar.translate((h1[0]+h2[0])/2+al*.004,(h1[1]+h2[1])/2-.012,(h1[2]+h2[2])/2);chrome.push(bar);
      // brackets: from the rail up to the underside of the table, at the bend and near the end
      for(const k of [8,line.length-1]){const q=line[k],top=CLOTH_Y-.07,y=q[1]+.03;const br=new T.CylinderGeometry(.004,.004,top-y,8);br.translate(q[0]-al*(k>8?.05:0),(top+y)/2,q[2]-Math.sign(zr)*.046);chrome.push(br);}
    }
    const add=(list,mat,shadow)=>{if(!list.length)return;const m=new T.Mesh(T.BufferGeometryUtils.mergeGeometries(list.map(g=>{g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);return g;})),mat);m.castShadow=shadow;m.receiveShadow=true;m.userData.vxObj='nets';scene.add(m);return m;};
    vxKey(netMat,'nets.net','Pocket baskets');vxKey(rodMat,'nets.rods','Ball-return rails');vxKey(strapMat,'nets.straps','Net straps');
    const netMesh=add(nets,netMat,false);add(rods,rodMat,true);add(chrome,rodMat,true);add(brass,goldMat,true);if(netMesh){netMesh.userData.vxRole='CLOTH';netMesh.name='NETS';}
  })();
  // Physics step for balls in the nets.
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
      f.inTray=!!f.sleep||(f.rest||0)>.25;              // settled in its net
    }
  }
  function netSimStep(){}
  function syncNets(){}
