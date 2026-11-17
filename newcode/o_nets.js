  // ---- POCKET NETS: brass ring, white net and the rod catcher --------------
  // A potted ball drops through the pocket into a white net lying in a cradle
  // of black rods, rolls down to the low end and waits there with the others.
  // Real 3D contact physics (gravity, the rods as capsules, ball-ball impacts);
  // nothing is scripted. The referee takes colours out of the pocket they fell
  // into, and empties the reds from a pocket when it fills up.
  const TRAY_X=-(HX+.045),TRAY_Y=-.452;          // the old ball tray (kept for older callers)
  const railCaps=[],dropTubes=[],NET_CRADLES=[],ROD_R=.0055;
  (function buildCradles(){
    POCKETS.forEach((p,pid)=>{
      const ox=p.ux,oz=p.uz,lx=-oz,lz=ox;           // outward, and across
      const ringY=CLOTH_Y-.05,ringR=p.radius+.006,s0=.035,s1=p.corner?.3:.26,y0=ringY-.13,y1=ringY-.165;
      const P=(s,y,l=0)=>[p.x+ox*s+lx*l,y,p.z+oz*s+lz*l];
      dropTubes.push({x:p.x,z:p.z,bx:p.x+ox*.03,bz:p.z+oz*.03,top:CLOTH_Y-.02,bottom:y0+.03,r:p.radius+.004});
      for(const sg of [-1,1]){
        railCaps.push({a:P(s0-.03,y0-.004,.017*sg),b:P(s1,y1,.017*sg),r:ROD_R,sup:true});   // the two rods a ball rides on
        railCaps.push({a:P(s0-.03,y0+.04,.045*sg),b:P(s1,y1+.04,.045*sg),r:ROD_R});         // the net's sides
      }
      railCaps.push({a:P(s1+.005,y1+.012,-.05),b:P(s1+.005,y1+.012,.05),r:.012});           // the end plate
      railCaps.push({a:P(-.04,y0-.004,-.05),b:P(-.04,y0-.004,.05),r:.012});                 // the back of the bag
      NET_CRADLES.push({pid,end:P(s1-.04,y1+.03),ringY,ringR,s0,s1,y0,y1,P,corner:p.corner});
    });
  })();
  // Visuals: brass ring, see-through net bag, black rods, end plate, strap.
  (()=>{
    const netTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
      g.strokeStyle='#ffffff';g.lineWidth=7;g.lineCap='round';
      for(let k=-128;k<=256;k+=32){g.beginPath();g.moveTo(k,0);g.lineTo(k+128,128);g.stroke();g.beginPath();g.moveTo(k,128);g.lineTo(k+128,0);g.stroke();}
      g.fillStyle='#ffffff';for(let y=0;y<=128;y+=32)for(let x=0;x<=128;x+=32){g.beginPath();g.arc(x,y,6,0,TAU);g.fill();g.beginPath();g.arc(x+16,y+16,6,0,TAU);g.fill();}
      const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=maxAniso;t.colorSpace=T.SRGBColorSpace;return t;})();
    const netMat=new T.MeshStandardMaterial({map:netTex,alphaTest:.42,side:T.DoubleSide,color:'#f2eee4',roughness:.92});
    const rodMat=new T.MeshPhysicalMaterial({color:'#0b0b0c',roughness:.18,metalness:.5,clearcoat:.8,clearcoatRoughness:.1});
    const strapMat=new T.MeshStandardMaterial({color:'#121112',roughness:.55});
    const nets=[],rods=[],brass=[],straps=[],V=(a)=>new T.Vector3(a[0],a[1],a[2]);
    for(const c of NET_CRADLES){const p=POCKETS[c.pid],{P,ringY,ringR,s0,s1,y0,y1}=c,lx=-p.uz,lz=p.ux;
      brass.push(new T.TorusGeometry(ringR,.0042,10,56).rotateX(PI/2).translate(p.x,ringY,p.z));
      // the bag: a sock swept along its centreline, round at the ring, an oval lying in the cradle, closed at the end
      const path=new T.CatmullRomCurve3([V(P(0,ringY+.004)),V(P(.012,ringY-.06)),V(P(s0+.02,y0+.03)),V(P((s0+s1)/2,(y0+y1)/2+.03)),V(P(s1-.004,y1+.03))]);
      const N=34,M=22,pos=[],uv=[],idx=[],L=new T.Vector3(lx,0,lz);let arc=0,prev=null;
      for(let j=0;j<=N;j++){const t=j/N,o=path.getPointAt(t),tg=path.getTangentAt(t),B=new T.Vector3().crossVectors(tg,L).normalize();
        if(prev)arc+=o.distanceTo(prev);prev=o;
        const w=t<.3?lerp(ringR,.05,t/.3):t>.9?lerp(.05,.008,(t-.9)/.1):.05,h=t<.3?lerp(ringR,.031,t/.3):t>.9?lerp(.031,.008,(t-.9)/.1):.031;
        for(let i=0;i<=M;i++){const a=i/M*TAU,sag=Math.sin(a)<0?1.12:1;
          pos.push(o.x+L.x*Math.cos(a)*w+B.x*Math.sin(a)*h*sag,o.y+L.y*Math.cos(a)*w+B.y*Math.sin(a)*h*sag,o.z+L.z*Math.cos(a)*w+B.z*Math.sin(a)*h*sag);
          uv.push(i/M*7,arc/.034);}}
      for(let j=0;j<N;j++)for(let i=0;i<M;i++){const a=j*(M+1)+i,b=a+M+1;idx.push(a,b,a+1,a+1,b,b+1);}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();nets.push(g);
      // rods: from the ring down into the cradle and out to the end plate
      for(const [l,dy] of [[-.017,-.004],[.017,-.004],[-.045,.04],[.045,.04]]){
        const be=(dy<0?62:108)*PI/180*Math.sign(l),ra=[p.x+(p.ux*Math.cos(be)+lx*Math.sin(be))*ringR,ringY,p.z+(p.uz*Math.cos(be)+lz*Math.sin(be))*ringR];
        const curve=new T.CatmullRomCurve3([V(ra),V(P(s0-.032,ringY-.07,l*.9)),V(P(s0-.03,y0+dy,l)),V(P(s1,y1+dy,l))]);
        rods.push(new T.TubeGeometry(curve,48,ROD_R,8,false));
        brass.push(new T.SphereGeometry(.0075,12,8).translate(...P(s1+.011,y1+dy,l)));}
      const plate=new T.BoxGeometry(.006,.06,.11);plate.rotateY(-Math.atan2(p.uz,p.ux));plate.translate(...P(s1+.006,y1+.018));brass.push(plate);
    }
    const add=(list,mat,shadow)=>{if(!list.length)return;const m=new T.Mesh(T.BufferGeometryUtils.mergeGeometries(list.map(g=>g.index?g.toNonIndexed():g)),mat);m.castShadow=shadow;m.receiveShadow=true;m.userData.vxObj='nets';scene.add(m);return m;};
    vxKey(netMat,'nets.net','Nets');vxKey(rodMat,'nets.rods','Net rods');vxKey(strapMat,'nets.straps','Net straps');
    const netMesh=add(nets,netMat,false);add(rods,rodMat,true);add(brass,goldMat,true);if(netMesh){netMesh.userData.vxRole='CLOTH';netMesh.name='NETS';}
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
