  // ---- the World Championship Arena (VENUES['world-championship-arena']) ----
  // Its rows run round three sides as one U: the far end at x = X, the sides
  // at |z| = Z, mitred at the corners into lit stairways and cut by aisles.
  const uRow=(v,r)=>({X:v.u.x0+r*v.rowD,Z:v.u.z0+r*v.rowD,y:FLOOR_Y+r*v.rowH});
  function uSeats(v,seatSpots,proxySpots,rnd,SEAT_W){
    const u=v.u,A=u.aisles.length,si0=v.stands.length;
    for(let r=0;r<u.rows;r++){const {X,Z,y}=uRow(v,r);
      const put=(x,z,yaw,si)=>{const s={x,y,z,yaw,row:r,si};
        if(r<u.live&&rnd()<.82)seatSpots.push(s);else{s.full=r>=u.live&&rnd()<.9;proxySpots.push(s);}};
      for(const sz of [-1,1])for(let x=u.xf+.42;x<=X-1.25;x+=SEAT_W){
        if(u.aisles.some(a=>Math.abs(x-a)<.55))continue;
        put(x,sz*Z,sz<0?0:PI,si0+(sz<0?0:A+2)+u.aisles.filter(a=>x>a).length);}
      for(let z=-Z+1.25;z<=Z-1.25+1e-6;z+=SEAT_W)put(X,z,-PI/2,si0+A+1);
    }
    const b=u.box;   // one row along the front of each side's private boxes
    for(const sz of [-1,1])for(let x=b.x0+1.4;x<=b.x1-1.6;x+=.72){if(rnd()<.2)continue;
      proxySpots.push({x,y:FLOOR_Y+b.y,z:sz*(b.z0+.62),yaw:sz<0?0:PI,row:u.rows+1,si:si0+2*A+3+(sz>0?1:0),full:true});}
  }
  // The arena's own mark: a crown in a red hexagon (its branding, not the club's).
  function champEmblem(g,cx,cy,r,col='#e3243a',ink='#ffffff'){
    g.save();g.translate(cx,cy);const hex=k=>{g.beginPath();for(let i=0;i<6;i++){const a=PI/6+i*PI/3;g.lineTo(Math.cos(a)*r*k,Math.sin(a)*r*k);}g.closePath();};
    hex(1);g.fillStyle=col;g.fill();hex(.8);g.lineWidth=r*.06;g.strokeStyle=ink;g.stroke();
    g.fillStyle=ink;g.beginPath();g.moveTo(-r*.42,r*.2);g.lineTo(-r*.5,-r*.24);g.lineTo(-r*.2,-r*.04);g.lineTo(0,-r*.38);g.lineTo(r*.2,-r*.04);g.lineTo(r*.5,-r*.24);g.lineTo(r*.42,r*.2);g.closePath();g.fill();
    g.fillRect(-r*.42,r*.27,r*.84,r*.1);for(const [x,y] of [[-r*.5,-r*.3],[0,-r*.45],[r*.5,-r*.3]]){g.beginPath();g.arc(x,y,r*.075,0,TAU);g.fill();}
    g.restore();}
  function champWordmark(g,x,y,size,align='left',col='#ffffff'){
    g.save();g.fillStyle=col;g.textBaseline='middle';g.textAlign=align;g.font='800 italic '+size+'px Arial, sans-serif';
    try{g.letterSpacing=(size*.04)+'px';}catch(e){}g.fillText('WORLD CHAMPIONSHIP',x,y);g.restore();}
  function champSlashes(g,w,h,side){   // the bold red slashes of the arena's screens
    g.save();for(const [k,a] of [[0,.95],[1,.55],[2,.3]]){const x0=side<0?w*(.02+k*.07):w*(.98-k*.07),dx=side<0?1:-1,bw=w*.045;
      g.fillStyle='rgba(227,36,58,'+a+')';g.beginPath();g.moveTo(x0,h);g.lineTo(x0+dx*bw,h);g.lineTo(x0+dx*(bw+h*.42),0);g.lineTo(x0+dx*h*.42,0);g.closePath();g.fill();}
    g.restore();}
  function champTrophy(g,cx,cy,s){   // a silver cup, drawn
    g.save();g.translate(cx,cy);const gr=g.createLinearGradient(-s*.5,0,s*.5,0);
    for(const [t,c] of [[0,'#6d7178'],[.28,'#f4f6f8'],[.5,'#b9bec6'],[.72,'#ffffff'],[1,'#5e6268']])gr.addColorStop(t,c);
    g.fillStyle=gr;g.strokeStyle=gr;g.lineWidth=s*.07;
    g.beginPath();g.moveTo(-s*.36,-s*.62);g.lineTo(s*.36,-s*.62);g.bezierCurveTo(s*.36,-s*.15,s*.2,s*.02,s*.07,s*.08);g.lineTo(-s*.07,s*.08);g.bezierCurveTo(-s*.2,s*.02,-s*.36,-s*.15,-s*.36,-s*.62);g.fill();
    for(const sx of [-1,1]){g.beginPath();g.ellipse(sx*s*.4,-s*.4,s*.13,s*.17,0,sx<0?PI*.5:-PI*.5,sx<0?PI*1.5:PI*.5);g.stroke();}
    g.fillRect(-s*.05,s*.06,s*.1,s*.3);g.beginPath();g.moveTo(-s*.12,s*.34);g.lineTo(s*.12,s*.34);g.lineTo(s*.26,s*.56);g.lineTo(-s*.26,s*.56);g.closePath();g.fill();
    g.fillStyle='#1b1c20';g.fillRect(-s*.32,s*.56,s*.64,s*.16);g.restore();}
  function champScreenArt(kind,w,h){
    return stageTexture(w,h,(g)=>{const bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#101016');bg.addColorStop(1,'#07070a');g.fillStyle=bg;g.fillRect(0,0,w,h);
      if(kind==='main'){champSlashes(g,w,h,-1);champSlashes(g,w,h,1);champEmblem(g,w/2,h*.3,h*.17);
        champWordmark(g,w/2,h*.62,Math.round(h*.13),'center');
        g.fillStyle='#d9dae0';g.font='600 '+Math.round(h*.07)+'px Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';try{g.letterSpacing=(h*.035)+'px';}catch(e){}g.fillText('ARENA',w/2,h*.8);
        champTrophy(g,w*.83,h*.5,h*.5);}
      else if(kind==='reds'){const fl=g.createRadialGradient(w*.55,h*.55,0,w*.55,h*.55,w*.6);fl.addColorStop(0,'#1d7a3c');fl.addColorStop(1,'#06200f');g.fillStyle=fl;g.fillRect(0,0,w,h);
        const R=h*.075;for(let row=0;row<5;row++)for(let i=0;i<=row;i++){const x=w*.42+row*R*1.75,y=h*.55+(i-row/2)*R*2.02;
          const b=g.createRadialGradient(x-R*.35,y-R*.4,R*.1,x,y,R);b.addColorStop(0,'#ff8a8a');b.addColorStop(.35,'#d8121e');b.addColorStop(1,'#4a0306');g.fillStyle=b;g.beginPath();g.arc(x,y,R,0,TAU);g.fill();}
        champSlashes(g,w,h,-1);champEmblem(g,w*.86,h*.16,h*.09);}
      else{champSlashes(g,w,h,-1);champSlashes(g,w,h,1);champTrophy(g,w/2,h*.47,h*.62);champWordmark(g,w/2,h*.9,Math.round(h*.07),'center');}
    });}
  // the trophy on its plinth beside the far end (shared by the TV venues)
  function addTrophy(grp,x,z){
    const silver=vmat(new T.MeshPhysicalMaterial({color:'#e6e8ec',metalness:1,roughness:.12,clearcoat:.6,envMapIntensity:2}));
    const plinth=new T.Mesh(new T.BoxGeometry(.46,1.02,.46),vmat(new T.MeshStandardMaterial({color:'#0c0c10',roughness:.35,metalness:.3})));
    plinth.position.set(x,FLOOR_Y+.51,z);plinth.castShadow=true;grp.add(plinth);
    const cupPts=[[0,0],[.13,0],[.13,.03],[.06,.05],[.035,.1],[.03,.2],[.06,.24],[.1,.27],[.13,.33],[.15,.42],[.155,.5],[.145,.52],[0,.52]].map(q=>new T.Vector2(q[0],q[1]));
    const cup=new T.Mesh(new T.LatheGeometry(cupPts,48),silver);cup.position.set(x,FLOOR_Y+1.02,z);cup.castShadow=true;grp.add(cup);
    for(const sx of [-1,1]){const h=new T.Mesh(new T.TorusGeometry(.07,.012,8,24,PI),silver);h.position.set(x+sx*.15,FLOOR_Y+1.42,z);h.rotation.z=sx>0?-PI/2:PI/2;grp.add(h);}
    const lid=new T.Mesh(new T.SphereGeometry(.05,16,12),silver);lid.position.set(x,FLOOR_Y+1.58,z);grp.add(lid);
  }
  // broadcast cameras on tripods, pointed at the table (shared by the TV venues)
  function addTvCameras(grp,spots,truss,glow){
    const camBody=vmat(new T.MeshStandardMaterial({color:'#1b1d21',roughness:.45,metalness:.5})),glass=vmat(new T.MeshPhysicalMaterial({color:'#0a1018',roughness:.05,metalness:.2,clearcoat:1}));
    for(const [x,z] of spots){const c=new T.Group();c.position.set(x,FLOOR_Y,z);c.lookAt(0,FLOOR_Y,0);grp.add(c);
      for(let k=0;k<3;k++){const a=k/3*TAU,leg=new T.Mesh(new T.CylinderGeometry(.012,.016,1.36,8),truss);leg.position.set(Math.cos(a)*.24,.64,Math.sin(a)*.24);leg.rotation.set(Math.sin(a)*.32,0,-Math.cos(a)*.32);c.add(leg);}
      const head=new T.Mesh(new T.BoxGeometry(.14,.1,.14),truss);head.position.y=1.34;c.add(head);
      const body=new T.Mesh(new T.BoxGeometry(.24,.24,.46),camBody);body.position.set(0,1.51,.02);body.castShadow=true;c.add(body);
      const lens=new T.Mesh(new T.CylinderGeometry(.065,.075,.36,24).rotateX(PI/2),camBody);lens.position.set(0,1.5,.42);c.add(lens);
      const front=new T.Mesh(new T.CircleGeometry(.062,24),glass);front.position.set(0,1.5,.601);c.add(front);
      const vf=new T.Mesh(new T.BoxGeometry(.16,.11,.04),camBody);vf.position.set(-.2,1.62,-.12);c.add(vf);
      for(const sx of [-1,1]){const hb=new T.Mesh(new T.CylinderGeometry(.012,.012,.5,8).rotateX(PI/2),truss);hb.position.set(sx*.1,1.36,-.42);hb.rotation.y=sx*.35;c.add(hb);}
      const tally=new T.Mesh(new T.SphereGeometry(.012,8,6),glow);tally.position.set(.1,1.66,.2);c.add(tally);}
  }
  function buildChampArena(v){
    const grp=new T.Group();arenaGroup.add(grp);stage.group=grp;stage.screens.length=0;
    const u=v.u,D=v.rowD,red=new T.Color('#ff1f33'),Y=new T.Vector3(0,1,0),one=new T.Vector3(1,1,1),q=new T.Quaternion(),m4=new T.Matrix4();
    const glow=vmat(new T.MeshBasicMaterial({color:red.clone().multiplyScalar(1.7),toneMapped:false}));
    const gold=vmat(new T.MeshBasicMaterial({color:new T.Color('#ffc864').multiplyScalar(1.25),toneMapped:false}));
    const blue=vmat(new T.MeshBasicMaterial({color:new T.Color('#3d5cff').multiplyScalar(1.9),toneMapped:false}));
    const concrete=vmat(new T.MeshStandardMaterial({color:v.step,roughness:.92})),dark=vmat(new T.MeshStandardMaterial({color:'#08090c',roughness:.6,metalness:.3}));
    const truss=vmat(new T.MeshStandardMaterial({color:'#24262b',roughness:.5,metalness:.7}));
    // the stands: one stepped U, the sides running past the corner so the rows mitre
    for(let r=1;r<u.rows;r++){const {X,Z}=uRow(v,r),h=r*v.rowH;
      for(const sz of [-1,1])box(X+D/2-u.xf+.1,h,D,concrete,(u.xf-.1+X+D/2)/2,FLOOR_Y+h/2,sz*Z,grp,false);
      box(D,h,2*Z+D,concrete,X,FLOOR_Y+h/2,0,grp,false);}
    // aisles and corner stairways: half steps and a lit gold nosing on every step
    const halfs=[],noses=[];const top=uRow(v,u.rows-1);
    for(let r=1;r<u.rows;r++){const {X,Z}=uRow(v,r),y=FLOOR_Y+r*v.rowH;
      for(const sz of [-1,1]){
        for(const a of u.aisles){halfs.push([a,y-v.rowH/2,sz*(Z-D/4),0,.95,D/2]);
          noses.push([a,y+.006,sz*(Z+.02),0,.85],[a,y-v.rowH/2+.006,sz*(Z-D/2+.02),0,.85]);}
        noses.push([X-1.0+.31,y+.006,sz*(Z-D/2+.02),0,.62],[X-D/2+.02,y+.006,sz*(Z-1.0+.31),PI/2,.62]);}}
    const halfG=new T.BoxGeometry(1,1,1),halfI=new T.InstancedMesh(halfG,concrete,halfs.length);
    halfs.forEach((s,i)=>{const hh=s[1]-FLOOR_Y;m4.compose(new T.Vector3(s[0],FLOOR_Y+hh/2,s[2]),q.identity(),new T.Vector3(s[4],hh,s[5]));halfI.setMatrixAt(i,m4);});
    halfI.computeBoundingSphere();grp.add(halfI);
    const noseI=new T.InstancedMesh(new T.BoxGeometry(1,.012,.035),gold,noses.length);
    noses.forEach((s,i)=>{q.setFromAxisAngle(Y,s[3]);m4.compose(new T.Vector3(s[0],s[1],s[2]),q,new T.Vector3(s[4],1,1));noseI.setMatrixAt(i,m4);});
    noseI.computeBoundingSphere();grp.add(noseI);
    // private boxes over each side: the block below, a red-lit back wall, glass, a lit fascia
    const b=u.box,BL=b.x1-b.x0,bx=(b.x0+b.x1)/2,ceilY=FLOOR_Y+b.y+2.8;
    const redWall=vmat(new T.MeshBasicMaterial({color:new T.Color('#b3142a').multiplyScalar(.95),toneMapped:false}));
    const glassM=vmat(new T.MeshPhysicalMaterial({color:'#8fa3b8',roughness:.05,transparent:true,opacity:.16,depthWrite:false}));
    const down=[];
    for(const sz of [-1,1]){
      const z0=top.Z+D/2,dz=v.walls[2]-z0;box(BL,b.y,dz,concrete,bx,FLOOR_Y+b.y/2,sz*(z0+dz/2),grp,false);
      const back=new T.Mesh(new T.PlaneGeometry(BL,ceilY-FLOOR_Y-b.y),redWall);back.position.set(bx,(ceilY+FLOOR_Y+b.y)/2,sz*(b.z1-.02));back.rotation.y=sz<0?0:PI;grp.add(back);
      for(let x=b.x0;x<=b.x1+1e-6;x+=2.6){box(.12,ceilY-FLOOR_Y-b.y,b.z1-b.z0,dark,x,(ceilY+FLOOR_Y+b.y)/2,sz*(b.z0+b.z1)/2,grp,false);}
      box(BL,.22,b.z1-b.z0+.3,dark,bx,ceilY+.11,sz*(b.z0+b.z1)/2,grp,false);
      box(BL,.9,.1,dark,bx,FLOOR_Y+b.y+.2,sz*b.z0,grp,false);
      const gl=new T.Mesh(new T.BoxGeometry(BL,.5,.02),glassM);gl.position.set(bx,FLOOR_Y+b.y+.9,sz*(b.z0-.02));grp.add(gl);
      for(const y of [FLOOR_Y+b.y+.65,FLOOR_Y+b.y-.24]){const n=new T.Mesh(new T.BoxGeometry(BL,.025,.025),y>FLOOR_Y+b.y?glow:blue);n.position.set(bx,y,sz*(b.z0-.07));grp.add(n);}
      for(let x=b.x0+.8;x<b.x1;x+=1.3)down.push([x,ceilY-.005,sz*(b.z0+b.z1)/2]);}
    const lampM=vmat(new T.MeshBasicMaterial({color:new T.Color(1,.92,.8).multiplyScalar(1.6),toneMapped:false}));
    const downI=new T.InstancedMesh(new T.CircleGeometry(.09,12).rotateX(PI/2),lampM,down.length);
    down.forEach((p,i)=>{m4.makeTranslation(p[0],p[1],p[2]);downI.setMatrixAt(i,m4);});downI.computeBoundingSphere();grp.add(downI);
    // the barrier: LED boards in the arena's colours, edged with red neon top and bottom
    const boardArt=stageTexture(1024,128,(g,w,h)=>{g.fillStyle='#07070a';g.fillRect(0,0,w,h);
      champEmblem(g,60,64,36);champWordmark(g,110,66,38);champEmblem(g,800,64,47);});
    boardArt.wrapS=T.RepeatWrapping;vtexAdd(boardArt);
    const segs=[[[4.0,-2.5],[4.0,2.5]],[[4.0,2.5],[3.0,3.5]],[[3.0,3.5],[-4.6,3.5]],[[-4.6,3.5],[-4.6,-2.4]],[[-3.4,-3.5],[3.0,-3.5]],[[3.0,-3.5],[4.0,-2.5]]];
    for(let [a,c] of segs){let dx=c[0]-a[0],dz=c[1]-a[1];const L=Math.hypot(dx,dz),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2;
      let ang=Math.atan2(-dz,dx);if(Math.sin(ang)*-mx+Math.cos(ang)*-mz<0)ang+=PI;   // the boards' faces read the right way from the table
      const nx=Math.sin(ang),nz=Math.cos(ang),tex=boardArt.clone();tex.repeat.set(L/7.2,1);tex.needsUpdate=true;vtexAdd(tex);
      const face=vmat(new T.MeshBasicMaterial({map:tex,toneMapped:false,color:new T.Color(.78,.78,.78)}));
      const bd=new T.Mesh(new T.BoxGeometry(L,.9,.08),[dark,dark,dark,dark,face,face]);   // the artwork on the two faces only
      bd.position.set(mx,FLOOR_Y+.45,mz);bd.rotation.y=ang;grp.add(bd);
      for(const y of [FLOOR_Y+.9,FLOOR_Y+.02]){const n=new T.Mesh(new T.BoxGeometry(L,.024,.024),glow);n.position.set(mx+nx*.05,y,mz+nz*.05);n.rotation.y=ang;grp.add(n);}}
    // the players' entrance: a lit frame across the gap at the front corner
    {const p0=[-4.6,-2.45],p1=[-3.42,-3.5],mx=(p0[0]+p1[0])/2,mz=(p0[1]+p1[1])/2,dx=p1[0]-p0[0],dz=p1[1]-p0[1],L=Math.hypot(dx,dz);
      let nx=-dz/L,nz=dx/L;if(nx*-mx+nz*-mz<0){nx=-nx;nz=-nz;}
      for(const p of [p0,p1]){box(.14,2.5,.14,dark,p[0],FLOOR_Y+1.25,p[1],grp,false);const s=new T.Mesh(new T.BoxGeometry(.03,2.4,.03),glow);s.position.set(p[0]+nx*.08,FLOOR_Y+1.25,p[1]+nz*.08);grp.add(s);}
      const lin=new T.Mesh(new T.BoxGeometry(L+.14,.36,.14),dark);lin.position.set(mx,FLOOR_Y+2.55,mz);lin.rotation.y=Math.atan2(-dz,dx);grp.add(lin);
      const sign=new T.Mesh(new T.PlaneGeometry(L*.86,.3),vmat(new T.MeshBasicMaterial({map:stageTexture(512,80,(g,w,h)=>{g.fillStyle='#08080b';g.fillRect(0,0,w,h);
        champEmblem(g,46,40,28);g.fillStyle='#f2f2f2';g.font='800 36px Arial, sans-serif';g.textBaseline='middle';g.fillText('PLAYERS',92,42);}),toneMapped:false})));
      sign.position.set(mx+nx*.08,FLOOR_Y+2.55,mz+nz*.08);sign.rotation.y=Math.atan2(nx,nz);grp.add(sign);}
    // the lighting rig over the table: an octagon edged in red neon, twelve white panels inside
    const RIG_Y=FLOOR_Y+6.0,rig=new T.Group();grp.add(rig);stage.rig=rig;stage.rigY=RIG_Y-.3;
    const oct=[[-3.4,-1.7],[-3.4,1.7],[-2.1,3.0],[2.7,3.0],[4.0,1.7],[4.0,-1.7],[2.7,-3.0],[-2.1,-3.0]],ocx=.3;
    const fascia=vmat(new T.MeshStandardMaterial({color:'#0d0e12',roughness:.5,metalness:.5}));
    for(let i=0;i<8;i++){const a=oct[i],c=oct[(i+1)%8],dx=c[0]-a[0],dz=c[1]-a[1],L=Math.hypot(dx,dz),ang=Math.atan2(-dz,dx),mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2;
      let nx=dz/L,nz=-dx/L;if(nx*(mx-ocx)+nz*mz<0){nx=-nx;nz=-nz;}
      const f=new T.Mesh(new T.BoxGeometry(L+.1,.5,.14),fascia);f.position.set(mx,RIG_Y,mz);f.rotation.y=ang;rig.add(f);
      for(const y of [RIG_Y-.25,RIG_Y+.25]){const n=new T.Mesh(new T.BoxGeometry(L+.1,.035,.035),glow);n.position.set(mx+nx*.08,y,mz+nz*.08);n.rotation.y=ang;rig.add(n);}}
    const panelM=vmat(new T.MeshBasicMaterial({color:new T.Color(1,.98,.95).multiplyScalar(1.45),toneMapped:false}));
    const cellsX=[-2.55,-1.1,.35,1.8,3.25],cellsZ=[-2.2,-.73,.73,2.2];
    const panelI=new T.InstancedMesh(new T.PlaneGeometry(1.18,1.2).rotateX(PI/2),panelM,12);let k=0;
    for(let i=0;i<4;i++)for(let j=0;j<3;j++){m4.makeTranslation((cellsX[i]+cellsX[i+1])/2,RIG_Y-.2,(cellsZ[j]+cellsZ[j+1])/2);panelI.setMatrixAt(k++,m4);}
    panelI.computeBoundingSphere();rig.add(panelI);
    for(const x of cellsX){const bm=new T.Mesh(new T.BoxGeometry(.09,.2,cellsZ[3]-cellsZ[0]+.1),fascia);bm.position.set(x,RIG_Y-.1,0);rig.add(bm);}
    for(const z of cellsZ){const bm=new T.Mesh(new T.BoxGeometry(cellsX[4]-cellsX[0]+.1,.2,.09),fascia);bm.position.set(.35,RIG_Y-.1,z);rig.add(bm);}
    const signTex=stageTexture(1024,256,(g,w,h)=>{g.fillStyle='#09090c';g.fillRect(0,0,w,h);champEmblem(g,128,128,92);champWordmark(g,250,132,74);});
    const sign=new T.Mesh(new T.PlaneGeometry(3.1,.78),vmat(new T.MeshBasicMaterial({map:signTex,toneMapped:false,color:new T.Color(.85,.85,.85)})));
    sign.position.set(-3.49,RIG_Y+.66,0);sign.rotation.y=-PI/2;rig.add(sign);
    box(.08,.84,3.18,fascia,-3.43,RIG_Y+.66,0,rig,false);
    // trusses above, with hanging lamps (white and blue) and the cables down to the rig
    const TY=FLOOR_Y+8.3,cans=[],lens=[];
    for(const z of [-4.7,4.7]){box(14,.3,.3,truss,.5,TY,z,grp,false);for(let x=-5.8;x<=6.8;x+=1.4)cans.push([x,TY-.3,z]);}
    for(const x of [-5.6,6.6]){box(.3,.3,10.4,truss,x,TY,0,grp,false);for(let z=-3.5;z<=3.6;z+=1.4)cans.push([x,TY-.3,z]);}
    const canI=new T.InstancedMesh(new T.CylinderGeometry(.14,.18,.32,12),truss,cans.length),lensI=new T.InstancedMesh(new T.CircleGeometry(.12,12).rotateX(PI/2),vmat(new T.MeshBasicMaterial({color:'#ffffff',toneMapped:false})),cans.length);
    const tint=[new T.Color(2.1,2.05,2.0),new T.Color(.45,.62,2.5)];
    cans.forEach((p,i)=>{m4.makeTranslation(p[0],p[1],p[2]);canI.setMatrixAt(i,m4);m4.makeTranslation(p[0],p[1]-.165,p[2]);lensI.setMatrixAt(i,m4);lensI.setColorAt(i,tint[i%3===1?1:0]);});
    canI.computeBoundingSphere();lensI.computeBoundingSphere();grp.add(canI,lensI);
    for(const p of [oct[0],oct[1],oct[4],oct[5]]){const c=new T.Mesh(new T.CylinderGeometry(.008,.008,TY-RIG_Y+2.2,6),truss);c.position.set(p[0]*.96,(TY+2.5+RIG_Y+.25)/2,p[1]*.96);rig.add(c);}
    // three giant LED screens over the far stand: the championship graphic in the middle,
    // and either side a graphic that gives way to the live picture and the score now and then
    if(!stage.rt){stage.rt=new T.WebGLRenderTarget(768,432,{samples:2});stage.rt.texture.colorSpace=T.SRGBColorSpace;stage.cam=new T.PerspectiveCamera(32,16/9,.05,60);}
    stage.barTex=stageTexture(1024,128,()=>{});
    const frameMat=vmat(new T.MeshStandardMaterial({color:'#0c0d10',roughness:.4,metalness:.6}));
    const mainArt=vtexAdd(champScreenArt('main',2048,784));
    const main=new T.Mesh(new T.PlaneGeometry(8.6,3.3),vmat(new T.MeshBasicMaterial({map:mainArt,toneMapped:false,color:new T.Color(.9,.9,.9)})));
    main.position.set(11.35,FLOOR_Y+6.55,0);main.rotation.y=-PI/2;grp.add(main);box(.12,3.5,8.8,frameMat,11.45,FLOOR_Y+6.55,0,grp,false);
    for(const sz of [-1,1])for(const dz of [0,.16]){const bar=new T.Mesh(new T.BoxGeometry(.05,5.8,.05),blue);bar.position.set(11.4,FLOOR_Y+5.6,sz*(4.75+dz));grp.add(bar);}
    stage.cycle=[];
    const barMat=vmat(new T.MeshBasicMaterial({map:stage.barTex,toneMapped:false,transparent:true}));
    for(const [sz,kind] of [[-1,'reds'],[1,'trophy']]){const g2=new T.Group();g2.position.set(9.1,FLOOR_Y+5.9,sz*8.3);g2.lookAt(-1,FLOOR_Y+2.2,sz*1.2);grp.add(g2);
      const art=vtexAdd(champScreenArt(kind,1024,576));
      const fr=new T.Mesh(new T.BoxGeometry(5.0,2.95,.12),frameMat);fr.position.z=-.07;g2.add(fr);
      const scr=new T.Mesh(new T.PlaneGeometry(4.8,2.7),vmat(new T.MeshBasicMaterial({map:art,toneMapped:false,color:new T.Color(.92,.92,.92)})));g2.add(scr);
      const bar=new T.Mesh(new T.PlaneGeometry(4.8,.6),barMat);bar.position.set(0,-1.05,.005);bar.visible=false;g2.add(bar);
      for(const dy of [1.5,-1.5]){const n=new T.Mesh(new T.BoxGeometry(5.0,.03,.03),glow);n.position.set(0,dy,.02);g2.add(n);}
      stage.cycle.push({mesh:scr,gfx:art,bar});}
    stage.cyPh=-1;stage.cyT=0;
    addTrophy(grp,3.05,2.2);
    addTvCameras(grp,[[-4.15,2.95],[-4.3,-1.55],[3.25,-2.75]],truss,glow);
    // light on the crowd: blue washes into the far corners, red-magenta along the sides
    for(const [x,z,tx,tz,c] of [[5.5,-4,8.6,-7.4,0x4b5dff],[5.5,4,8.6,7.4,0x4b5dff],[-1.5,-4.4,-.5,-8.2,0xff3d6a],[-1.5,4.4,-.5,8.2,0xff3d6a]]){
      const sl=new T.SpotLight(c,26,32,.7,.85,1.3);sl.position.set(x,FLOOR_Y+8,z);sl.target.position.set(tx,FLOOR_Y+2.4,tz);grp.add(sl,sl.target);}
  }
