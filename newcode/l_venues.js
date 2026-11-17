  // ---- arena: VENUES (floor, stands, crowd boards, walls, scoreboard, chairs) ----
  // Five venues in the spirit of the tour's: an intimate steep theatre, a grand
  // palace hall, a big modern arena, a red-and-gold dome and the Velvet Room.
  // Animated spectators fill the front rows; the rows behind are filled with
  // simple seated figures so big venues read as full without costing much.
  const VENUES={
    velvet:{name:'THE VELVET ROOM',event:'THE VELVET MASTERS',seat:'#3a0f15',step:'#101216',wall:'#08090c',carpet:['#16191f',18,[0,3,9]],
      strip:'#ffcf8a',stripK:.55,ad:null,house:0xffd8a6,houseI:3.4,fog:0x030405,rowD:.95,rowH:.42,
      stands:[{o:[4.35,0],along:[0,1],face:[-1,0],rows:3,per:9,extra:0},{o:[.45,3.35],along:[1,0],face:[0,-1],rows:3,per:11,extra:0},{o:[.45,-3.35],along:[1,0],face:[0,1],rows:3,per:11,extra:0}],
      walls:[-9.5,8.4,7],board:1},
    theatre:{name:'THE THEATRE',event:'THE THEATRE CHAMPIONSHIP',seat:'#6a0f18',step:'#170d09',wall:'#140a06',carpet:['#1d1410',16,[4,1,-2]],
      strip:'#ffc27a',stripK:.42,ad:['#0d2a57','#ffffff'],house:0xffcf96,houseI:3.9,fog:0x050302,rowD:.9,rowH:.6,
      stands:[{o:[4.05,0],along:[0,1],face:[-1,0],rows:4,per:8,extra:3},{o:[.3,3.05],along:[1,0],face:[0,-1],rows:4,per:10,extra:3},{o:[.3,-3.05],along:[1,0],face:[0,1],rows:4,per:10,extra:3}],
      walls:[-9,9.3,8],board:1.05},
    palace:{name:'THE PALACE',event:'THE PALACE MASTERS',seat:'#2c1d52',step:'#0e0b16',wall:'#0c0914',carpet:['#141022',20,[3,0,8]],
      strip:'#c8adff',stripK:.5,ad:['#2a1458','#f2d58f'],house:0xe6dcff,houseI:3.7,fog:0x05040a,rowD:1.0,rowH:.46,
      stands:[{o:[4.7,0],along:[0,1],face:[-1,0],rows:3,per:10,extra:5},{o:[.4,3.6],along:[1,0],face:[0,-1],rows:3,per:13,extra:5},{o:[.4,-3.6],along:[1,0],face:[0,1],rows:3,per:13,extra:5}],
      walls:[-11,11.5,10.5],board:1.25},
    arena:{name:'GRAND ARENA',event:'GRAND ARENA OPEN',seat:'#0e2a52',step:'#070b12',wall:'#04060b',carpet:['#0b1320',22,[-2,3,10]],
      strip:'#63ccff',stripK:.6,ad:['#0b4fc2','#ffffff'],house:0xdcefff,houseI:4.3,fog:0x02040a,rowD:.95,rowH:.5,
      stands:[{o:[4.6,0],along:[0,1],face:[-1,0],rows:3,per:10,extra:7},{o:[.3,3.5],along:[1,0],face:[0,-1],rows:3,per:12,extra:7},{o:[.3,-3.5],along:[1,0],face:[0,1],rows:3,per:12,extra:7},
        {o:[-5.2,0],along:[0,1],face:[1,0],rows:0,per:10,extra:6}],
      walls:[-13,13.5,12],board:1.45},
    dome:{name:'DRAGON DOME',event:'DRAGON DOME INTERNATIONAL',seat:'#7a1510',step:'#140605',wall:'#130504',carpet:['#1c0b08',18,[6,0,-3]],
      strip:'#ffbf47',stripK:.55,ad:['#740c0c','#ffd27a'],house:0xffd29a,houseI:4.0,fog:0x060201,rowD:.95,rowH:.48,
      stands:[{o:[4.5,0],along:[0,1],face:[-1,0],rows:3,per:10,extra:5},{o:[.35,3.45],along:[1,0],face:[0,-1],rows:3,per:12,extra:5},{o:[.35,-3.45],along:[1,0],face:[0,1],rows:3,per:12,extra:5}],
      walls:[-11,11.5,10],board:1.3}};
  let venueId=(()=>{try{const v=localStorage.getItem('velvet.venue');return VENUES[v]?v:'velvet';}catch(e){return 'velvet';}})();
  const seats=[],venueMats=[];
  const arenaGroup=new T.Group();scene.add(arenaGroup);
  const vmat=m=>{venueMats.push(m);return m;};
  function boardTexture(v){
    const c=document.createElement('canvas');c.width=1024;c.height=64;const g=c.getContext('2d');
    g.fillStyle=v.ad[0];g.fillRect(0,0,1024,64);g.fillStyle=v.ad[1];g.font='700 34px Arial, sans-serif';g.textBaseline='middle';
    for(let x=24;x<1024;x+=g.measureText(v.event+'  ·  ').width)g.fillText(v.event+'  ·  ',x,34);
    const t=canvasTexture(c,1,1);t.wrapS=T.RepeatWrapping;return t;
  }
  function buildArena(v){
    arenaGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();});
    for(const m of venueMats.splice(0)){if(m.map&&m.map!==scoreTex)m.map.dispose();m.dispose();}
    arenaGroup.clear();seats.length=0;
    scene.fog.color.set(v.fog);scene.background.set(v.fog);
    const carpet=document.createElement('canvas');carpet.width=carpet.height=256;const g=carpet.getContext('2d');
    g.fillStyle=v.carpet[0];g.fillRect(0,0,256,256);
    for(let i=0;i<9000;i++){const k=v.carpet[1]+Math.random()*16,d=v.carpet[2];g.fillStyle=`rgb(${k+d[0]},${k+d[1]},${k+d[2]})`;g.fillRect(Math.random()*256,Math.random()*256,1.5,1.5);}
    const floor=new T.Mesh(new T.PlaneGeometry(44,44).rotateX(-PI/2),vmat(new T.MeshStandardMaterial({map:canvasTexture(carpet,18,18),roughness:1,envMapIntensity:.2})));
    floor.position.y=FLOOR_Y;floor.receiveShadow=true;arenaGroup.add(floor);
    const stepMat=vmat(new T.MeshStandardMaterial({color:v.step,roughness:.95}));
    const seatMat=vmat(new T.MeshStandardMaterial({color:v.seat,roughness:.85}));
    const seatGeo=T.BufferGeometryUtils.mergeGeometries([
      new T.BoxGeometry(.5,.09,.46).translate(0,.42,.02),new T.BoxGeometry(.5,.54,.07).translate(0,.71,-.22),new T.BoxGeometry(.32,.38,.3).translate(0,.19,-.04)]);
    const SEAT_W=.64,seatSpots=[],proxySpots=[];
    let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
    for(const st of v.stands){
      const total=st.rows+st.extra;
      for(let r=0;r<total;r++){
        const cx=st.o[0]-st.face[0]*r*v.rowD,cz=st.o[1]-st.face[1]*r*v.rowD,y=FLOOR_Y+r*v.rowH,len=st.per*SEAT_W+.6+r*.18;
        if(r>0){const w=Math.abs(st.along[0])*len+Math.abs(st.face[0])*v.rowD,d=Math.abs(st.along[1])*len+Math.abs(st.face[1])*v.rowD;
          box(w,r*v.rowH,d,stepMat,cx,FLOOR_Y+r*v.rowH/2,cz,arenaGroup,false);}
        const per=st.per+Math.floor(r*.28);
        for(let i=0;i<per;i++){const k=i-(per-1)/2;
          const s={x:cx+st.along[0]*k*SEAT_W,y,z:cz+st.along[1]*k*SEAT_W,yaw:Math.atan2(st.face[0],st.face[1]),row:r};
          if(r<st.rows)seatSpots.push(s);else{s.full=rnd()<.86;proxySpots.push(s);}}
      }
      // LED boards in front of the stand, like the tour's sponsor boards.
      if(v.ad){const len=st.per*SEAT_W+.4,bx=st.o[0]+st.face[0]*.62,bz=st.o[1]+st.face[1]*.62;
        const tex=boardTexture(v);tex.repeat.set(len/3.2,1);
        const mat=vmat(new T.MeshBasicMaterial({map:tex,toneMapped:false,color:new T.Color(.62,.62,.62)}));
        const bd=new T.Mesh(new T.BoxGeometry(len,.5,.05),mat);bd.position.set(bx,FLOOR_Y+.25,bz);bd.rotation.y=Math.atan2(st.face[0],st.face[1]);arenaGroup.add(bd);}
    }
    const all=seatSpots.concat(proxySpots);
    const inst=new T.InstancedMesh(seatGeo,seatMat,all.length);const m=new T.Matrix4(),q=new T.Quaternion(),one=new T.Vector3(1,1,1),Y=new T.Vector3(0,1,0);
    all.forEach((s,i)=>{q.setFromAxisAngle(Y,s.yaw);m.compose(new T.Vector3(s.x,s.y,s.z),q,one);inst.setMatrixAt(i,m);});
    inst.receiveShadow=true;arenaGroup.add(inst);
    // Rows behind the animated spectators: seated figures in the half-dark.
    const full=proxySpots.filter(s=>s.full);
    if(full.length){
      const bodyGeo=T.BufferGeometryUtils.mergeGeometries([new T.BoxGeometry(.4,.56,.26).translate(0,.78,-.08),new T.BoxGeometry(.36,.16,.42).translate(0,.5,.08)]);
      const headGeo=new T.SphereGeometry(.105,12,10).translate(0,1.16,-.06);
      const bodies=new T.InstancedMesh(bodyGeo,vmat(new T.MeshStandardMaterial({roughness:.9})),full.length);
      const heads=new T.InstancedMesh(headGeo,vmat(new T.MeshStandardMaterial({roughness:.7})),full.length);
      const cloth=['#1b1d22','#2a2c33','#3a3f4a','#1d2a3a','#4a2a2a','#2d3a2d','#5a5148','#111214','#6b6f78'],skin=['#c99a7a','#a8765a','#e0b49a','#7a5038','#d6a483'];
      const col=new T.Color();
      full.forEach((s,i)=>{q.setFromAxisAngle(Y,s.yaw);m.compose(new T.Vector3(s.x+Math.sin(s.yaw)*.05,s.y,s.z+Math.cos(s.yaw)*.05),q,one);
        bodies.setMatrixAt(i,m);heads.setMatrixAt(i,m);
        bodies.setColorAt(i,col.set(cloth[Math.floor(rnd()*cloth.length)]));heads.setColorAt(i,col.set(skin[Math.floor(rnd()*skin.length)]));});
      arenaGroup.add(bodies,heads);
    }
    seats.push(...seatSpots);
    // Walls with soft vertical light strips.
    const [wx0,wx1,wz]=v.walls,wallMat=vmat(new T.MeshStandardMaterial({color:v.wall,roughness:.9})),H=7+(wz-7)*.4;
    box(.2,H,wz*2+1,wallMat,wx1,FLOOR_Y+H/2,0,arenaGroup,false);box(.2,H,wz*2+1,wallMat,wx0,FLOOR_Y+H/2,0,arenaGroup,false);
    box(wx1-wx0,H,.2,wallMat,(wx0+wx1)/2,FLOOR_Y+H/2,wz,arenaGroup,false);box(wx1-wx0,H,.2,wallMat,(wx0+wx1)/2,FLOOR_Y+H/2,-wz,arenaGroup,false);
    const stripMat=vmat(new T.MeshBasicMaterial({color:new T.Color(v.strip).multiplyScalar(v.stripK)}));
    for(let i=-3;i<=3;i++){box(.02,2.6,.05,stripMat,wx1-.12,FLOOR_Y+3.4+(wz-7)*.25,i*wz*.27,arenaGroup,false);
      for(const zs of [-1,1])box(.05,2.6,.02,stripMat,i*(wx1-wx0)*.12,FLOOR_Y+3.4+(wz-7)*.25,zs*(wz-.12),arenaGroup,false);}
    // Players' chairs with a small table and water glasses (players are not shown).
    const leather=vmat(new T.MeshStandardMaterial({color:'#121214',roughness:.45}));
    for(const x of [-.95,.95]){const chair=new T.Group();chair.position.set(x,FLOOR_Y,-(OUT_Z+1.1));arenaGroup.add(chair);
      box(.56,.1,.52,leather,0,.46,0,chair);box(.56,.6,.08,leather,0,.82,-.24,chair);
      for(const s of [-1,1])box(.07,.26,.5,leather,s*.28,.6,0,chair);
      for(const [lx,lz] of [[-.24,-.22],[.24,-.22],[-.24,.22],[.24,.22]])box(.035,.42,.035,metalMat,lx,.21,lz,chair);}
    const tableTop=new T.Mesh(new T.CylinderGeometry(.25,.25,.025,32),woodDarkMat);tableTop.position.set(0,FLOOR_Y+.62,-(OUT_Z+1.1));tableTop.castShadow=true;arenaGroup.add(tableTop);
    const stem=new T.Mesh(new T.CylinderGeometry(.03,.05,.6,12),metalMat);stem.position.set(0,FLOOR_Y+.31,-(OUT_Z+1.1));arenaGroup.add(stem);
    const glassMat=vmat(new T.MeshPhysicalMaterial({color:'#dfe9ee',roughness:.04,metalness:0,transparent:true,opacity:.28,envMapIntensity:1.4,clearcoat:1}));
    const waterMat=vmat(new T.MeshPhysicalMaterial({color:'#b9d4dc',roughness:.05,transparent:true,opacity:.32}));
    for(const x of [-.08,.09]){const gl1=new T.Mesh(new T.CylinderGeometry(.034,.03,.12,24,1,true),glassMat);gl1.position.set(x,FLOOR_Y+.693,-(OUT_Z+1.1));arenaGroup.add(gl1);
      const w=new T.Mesh(new T.CylinderGeometry(.031,.029,.07,24),waterMat);w.position.set(x,FLOOR_Y+.67,-(OUT_Z+1.1));arenaGroup.add(w);}
    // Scoreboard over the far stand.
    const far=v.stands[0],top=FLOOR_Y+(far.rows+far.extra)*v.rowH,bs=v.board;
    const board=new T.Mesh(new T.PlaneGeometry(2.9*bs,.815*bs),vmat(new T.MeshBasicMaterial({map:scoreTex,toneMapped:false})));
    board.position.set(wx1-.15,Math.max(FLOOR_Y+3.05,top+.9*bs),0);board.rotation.y=-PI/2;arenaGroup.add(board);
    box(.08,.9*bs,3.0*bs,metalMat,wx1-.1,board.position.y,0,arenaGroup,false);
    for(const [i,s] of houseLights.entries()){s.color.set(v.house);s.intensity=v.houseI;}
    scoreKey='';
  }
  // Scoreboard canvas, redrawn whenever the score changes.
  const scoreCanvas=document.createElement('canvas');scoreCanvas.width=1024;scoreCanvas.height=288;
  const scoreTex=new T.CanvasTexture(scoreCanvas);scoreTex.colorSpace=T.SRGBColorSpace;scoreTex.anisotropy=maxAniso;
  let scoreKey='';
  buildArena(VENUES[venueId]);
