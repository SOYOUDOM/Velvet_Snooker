  // ---- 3D SCENE: BROADCAST-LIT ARENA (Three.js) -----------------------------
  // TV-style lighting: a bright canopy over the table and the arena in shadow.
  // Physically based balls, cloth, wood and leather; a table built to
  // tournament dimensions; tiered seating, players' chairs and a scoreboard.
  const CLOTH_Y=.006, BALL_Y=CLOTH_Y+R-.0006, FLOOR_Y=CLOTH_Y-.86;
  const CUSH_W=.050, RAIL_W=.120, RAIL_TOP=CLOTH_Y+.052, RAIL_T=.046;
  const IN_X=HX+CUSH_W, IN_Z=HZ+CUSH_W, OUT_X=IN_X+RAIL_W, OUT_Z=IN_Z+RAIL_W;
  const CANOPY_Y=CLOTH_Y+2.35;
  const FOV_DEG=27, RADIUS_SCALE=Math.tan(21*PI/180)/Math.tan(FOV_DEG/2*PI/180);
  let eye=[0,4,4], width=1, height=1, time=0;

  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.9;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFShadowMap;
  T.RectAreaLightUniformsLib.init();
  const scene=new T.Scene();
  scene.background=new T.Color(0x030405);
  scene.fog=new T.Fog(0x030405,12,28);
  const camera=new T.PerspectiveCamera(FOV_DEG,1,.05,70);

  // Quality presets. HIGH: full crowd, soft shadows, bloom. LOW: for laptops.
  const QUALITY_LEVELS=['high','medium','low'];
  const QUALITY={high:{ratio:2,shadow:2048,bloom:true,crowd:1,crowdHz:60},
    medium:{ratio:1.25,shadow:1024,bloom:false,crowd:.62,crowdHz:30},
    low:{ratio:1,shadow:0,bloom:false,crowd:.34,crowdHz:15}};
  let quality='high',qualityChosen=false;
  try{const q=localStorage.getItem('velvet.quality');if(QUALITY_LEVELS.includes(q)){quality=q;qualityChosen=true;}}catch(e){}

  // ---- materials ----
  const maxAniso=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const texLoader=new T.TextureLoader();
  function imageTexture(key,rx,ry){const t=texLoader.load(MATERIAL_IMAGES[key]);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=maxAniso;t.colorSpace=T.SRGBColorSpace;return t;}
  function canvasTexture(c,rx,ry,srgb=true){const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=maxAniso;if(srgb)t.colorSpace=T.SRGBColorSpace;return t;}
  // Smart rail fade: rails and cushions between a low camera and a ball near
  // that cushion dissolve (dithered, so nothing needs depth sorting).
  const fadeUniforms={uFadeDir:{value:new T.Vector2(0,1)},uFadeAmt:{value:0}};
  function fadeable(material){
    material.alphaHash=true;
    material.onBeforeCompile=shader=>{
      shader.uniforms.uFadeDir=fadeUniforms.uFadeDir;shader.uniforms.uFadeAmt=fadeUniforms.uFadeAmt;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vFadeXZ;')
        .replace('#include <project_vertex>','#include <project_vertex>\nvFadeXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vFadeXZ;uniform vec2 uFadeDir;uniform float uFadeAmt;')
        .replace('#include <alphahash_fragment>','diffuseColor.a*=1.0-.86*uFadeAmt*smoothstep(.55,.95,dot(vFadeXZ,uFadeDir));\n#include <alphahash_fragment>');
    };
    return material;
  }
  const CLOTH_GREEN=new T.Color('#1b7a3e');
  const clothMat=new T.MeshPhysicalMaterial({color:CLOTH_GREEN,roughness:.93,metalness:0,sheen:.6,sheenRoughness:.72,sheenColor:new T.Color('#4cc27c'),envMapIntensity:.5});
  const cushionMat=fadeable(clothMat.clone());
  const chalkMat=new T.MeshStandardMaterial({color:'#eef0e8',roughness:.95,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,envMapIntensity:.4});
  const woodMat=fadeable(new T.MeshPhysicalMaterial({map:imageTexture('wood',1.4,1.4),color:new T.Color('#a8774f'),roughness:.56,clearcoat:.18,clearcoatRoughness:.5,envMapIntensity:.35}));
  const woodDarkMat=new T.MeshPhysicalMaterial({map:woodMat.map,color:new T.Color('#5d3a24'),roughness:.4,clearcoat:.4,clearcoatRoughness:.3,envMapIntensity:.6});
  const leatherMat=new T.MeshStandardMaterial({map:imageTexture('leather',4,4),color:new T.Color('#3b2417'),roughness:.52,envMapIntensity:.7});
  const pocketMat=new T.MeshStandardMaterial({color:'#090706',roughness:.8,side:T.DoubleSide});
  const slateMat=new T.MeshStandardMaterial({color:'#15181a',roughness:.9});
  const metalMat=new T.MeshStandardMaterial({color:'#1c1e21',roughness:.4,metalness:.7});
  // The baize photo becomes a neutral weave (+ matching relief) so the cloth
  // colour comes from the material, not the photo.
  (()=>{const img=new Image();img.onload=()=>{
    const S=512,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');g.drawImage(img,0,0,S,S);
    const d=g.getImageData(0,0,S,S),p=d.data,lum=new Float32Array(S*S);let mean=0;
    for(let i=0;i<S*S;i++){lum[i]=.2126*p[i*4]+.7152*p[i*4+1]+.0722*p[i*4+2];mean+=lum[i];}mean/=S*S;
    for(let i=0;i<S*S;i++){const v=clamp(226*(1+(lum[i]/mean-1)*.85),150,255);p[i*4]=p[i*4+1]=p[i*4+2]=v;p[i*4+3]=255;}
    g.putImageData(d,0,0);
    const n=document.createElement('canvas');n.width=n.height=S;const gn=n.getContext('2d'),nd=gn.createImageData(S,S);
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){
      const i=y*S+x,dx=(lum[y*S+(x+1)%S]-lum[y*S+(x+S-1)%S])/mean,dy=(lum[((y+1)%S)*S+x]-lum[((y+S-1)%S)*S+x])/mean;
      const l=Math.hypot(dx*1.3,dy*1.3,1);nd.data[i*4]=(-dx*1.3/l*.5+.5)*255;nd.data[i*4+1]=(-dy*1.3/l*.5+.5)*255;nd.data[i*4+2]=(1/l*.5+.5)*255;nd.data[i*4+3]=255;}
    gn.putImageData(nd,0,0);
    const map=canvasTexture(c,2.6,2.6),nmap=canvasTexture(n,2.6,2.6,false);
    for(const m of [clothMat,cushionMat]){m.map=map;m.normalMap=nmap;m.normalScale.set(.32,.32);m.needsUpdate=true;}
    chalkMat.map=map;chalkMat.needsUpdate=true;
  };img.src=MATERIAL_IMAGES.felt;})();
  const BALL_COLORS={cue:'#f3f0e4',red:'#a8121a',yellow:'#f0bd06',green:'#0b7038',brown:'#6a3618',blue:'#1340a4',pink:'#ee8e9f',black:'#09090b'};
  const ballMats={};
  for(const k in BALL_COLORS)ballMats[k]=new T.MeshPhysicalMaterial({color:new T.Color(BALL_COLORS[k]),roughness:.1,metalness:0,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:1.1});
  const ballGeo=new T.SphereGeometry(R,48,32);
  const blobTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
    const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.66)');gr.addColorStop(.36,'rgba(0,0,0,.36)');gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr;g.fillRect(0,0,64,64);return new T.CanvasTexture(c);})();
  const blobMat=new T.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
  const blobGeo=new T.PlaneGeometry(R*2.7,R*2.7).rotateX(-PI/2);

  // ---- lights & reflections ----
  const canopyLight=new T.RectAreaLight(0xfff2dc,3.2,2.9,1.22);
  canopyLight.position.set(0,CANOPY_Y,0);canopyLight.lookAt(0,0,0);scene.add(canopyLight);
  const keyLight=new T.DirectionalLight(0xfff4e4,1.05);
  keyLight.position.set(0,CANOPY_Y+3.2,0);keyLight.target.position.set(0,0,0);scene.add(keyLight,keyLight.target);
  keyLight.castShadow=true;keyLight.shadow.camera.up.set(1,0,0);
  Object.assign(keyLight.shadow.camera,{left:-2.25,right:2.25,top:2.25,bottom:-2.25,near:1,far:9});
  keyLight.shadow.mapSize.set(2048,2048);keyLight.shadow.bias=-.00035;keyLight.shadow.normalBias=.008;keyLight.shadow.radius=4;
  const hemi=new T.HemisphereLight(0x8a97b0,0x0b0907,.05);scene.add(hemi);
  // Warm house lights spill faintly onto the stands: the audience reads as
  // real people in the dark, never brighter than the table.
  for(const [x,z,tx,tz] of [[0,-2.6,0,-5.3],[0,2.6,0,5.3],[3.1,0,6.1,0]]){
    const s=new T.SpotLight(0xffd8a6,3.4,15,1.05,.95,1.6);s.position.set(x,CANOPY_Y+1.6,z);s.target.position.set(tx,FLOOR_Y+1.1,tz);scene.add(s,s.target);
  }
  // Reflection environment: a dark hall with the canopy as one bright panel,
  // so every ball carries the lamp's rectangle like on television.
  (()=>{
    const env=new T.Scene();env.background=new T.Color(0x020203);
    env.add(new T.Mesh(new T.BoxGeometry(24,10,24),new T.MeshBasicMaterial({color:0x0a0b0d,side:T.BackSide})));
    const panel=new T.Mesh(new T.PlaneGeometry(3,1.3),new T.MeshBasicMaterial({color:new T.Color(1,.96,.9).multiplyScalar(16),side:T.DoubleSide}));
    panel.position.y=1.6;panel.rotation.x=PI/2;env.add(panel);
    for(const [x,z,r] of [[7,0,-PI/2],[-7,0,PI/2],[0,7,PI],[0,-7,0]]){
      const glow=new T.Mesh(new T.PlaneGeometry(6,.5),new T.MeshBasicMaterial({color:new T.Color(1,.82,.6).multiplyScalar(.5),side:T.DoubleSide}));
      glow.position.set(x,2.4,z);glow.rotation.y=r;env.add(glow);
    }
    const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(env,.02).texture;scene.environmentIntensity=.42;pm.dispose();
  })();

  // ---- geometry helpers ----
  // Walk a rectangle anticlockwise; where it passes through one of the circles
  // follow that circle's arc instead: outside=true gives the union (a pocket
  // cut into a rail), false gives a notch (a pocket mouth in the cloth).
  function notchedOutline(hx,hz,circles,outside){
    const corners=[[hx,-hz],[hx,hz],[-hx,hz],[-hx,-hz]],S=[];
    for(let e=0;e<4;e++){const a=corners[e],b=corners[(e+1)%4],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.002);
      for(let i=0;i<n;i++)S.push([lerp(a[0],b[0],i/n),lerp(a[1],b[1],i/n)]);}
    const inC=p=>circles.findIndex(c=>Math.hypot(p[0]-c[0],p[1]-c[1])<c[2]);
    const start=S.findIndex(p=>inC(p)<0),L=S.slice(start).concat(S.slice(0,start)),out=[];
    for(let i=0;i<L.length;i++){
      const ci=inC(L[i]);if(ci<0){out.push(L[i]);continue;}
      let j=i;while(j<L.length&&inC(L[j])===ci)j++;
      const c=circles[ci],enter=L[Math.max(0,i-1)],exit=L[j%L.length];
      const a0=Math.atan2(enter[1]-c[1],enter[0]-c[0]),a1=Math.atan2(exit[1]-c[1],exit[0]-c[0]);
      let da=a1-a0;while(da<=0)da+=TAU;
      const mid=a0+da/2,mx=c[0]+Math.cos(mid)*c[2],mz=c[1]+Math.sin(mid)*c[2];
      if((Math.abs(mx)>hx||Math.abs(mz)>hz)!==outside)da-=TAU;
      const steps=Math.max(6,Math.ceil(Math.abs(da)*c[2]/.003));
      for(let k=1;k<steps;k++){const ang=a0+da*k/steps;out.push([c[0]+Math.cos(ang)*c[2],c[1]+Math.sin(ang)*c[2]]);}
      i=j-1;
    }
    return out;
  }
  const shapeFrom=pts=>new T.Shape(pts.map(p=>new T.Vector2(p[0],-p[1])));
  const pathFrom=pts=>new T.Path(pts.map(p=>new T.Vector2(p[0],-p[1])));
  function roundedRect(hx,hz,r){const s=[];for(const [cx,cz,a0] of [[hx-r,hz-r,0],[-hx+r,hz-r,PI/2],[-hx+r,-hz+r,PI],[hx-r,-hz+r,PI*1.5]])
    for(let i=0;i<=8;i++){const a=a0+i/8*PI/2;s.push([cx+Math.cos(a)*r,cz+Math.sin(a)*r]);}return s;}
  function worldBoxUV(geo,w,h,d){ // metre-scaled UVs so wood grain matches across pieces
    const uv=geo.attributes.uv,sz=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
    for(let f=0;f<6;f++)for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,uv.getX(i)*sz[f][0],uv.getY(i)*sz[f][1]);}
    return geo;
  }
  function box(w,h,d,mat,x,y,z,parent=scene,shadow=true){const m=new T.Mesh(worldBoxUV(new T.BoxGeometry(w,h,d),w,h,d),mat);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;}
  function arcPts(c,a0,a1,r,n=40){const p=[];for(let i=0;i<=n;i++){const a=lerp(a0,a1,i/n);p.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]);}return p;}
  function wallFromArc(pts,y0,y1,mat){
    const pos=[],uv=[],idx=[];pts.forEach((p,i)=>{pos.push(p[0],y0,p[1],p[0],y1,p[1]);uv.push(i/(pts.length-1)*2,0,i/(pts.length-1)*2,.3);});
    for(let i=0;i<pts.length-1;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
    const m=new T.Mesh(g,mat);m.receiveShadow=true;scene.add(m);return m;
  }

  // Cushion cross-section (outward distance from the nose line, height over
  // the cloth): undercut face, rounded nose at ~64% of a ball's height,
  // sloping top meeting the rail. The last point closes the profile.
  const CUSHION_PROFILE=[[.011,0],[.005,.011],[.0012,.022],[0,.0300],[.0008,.0345],[.004,.0390],[.011,.0425],[.026,.0455],[CUSH_W,.0478],[CUSH_W,0]];
  function cushionMesh(s0,s1,kA,kB,O,S,N){
    const P=CUSHION_PROFILE,n=P.length,pos=[],nor=[],uv=[],idx=[];
    const arc=[0];for(let i=1;i<n;i++)arc.push(arc[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
    const at=(s,d,h)=>[O[0]+S[0]*s+N[0]*d,CLOTH_Y+h,O[2]+S[2]*s+N[2]*d];
    for(let i=0;i<n;i++){
      const a=P[Math.max(0,i-1)],b=P[Math.min(n-1,i+1)],td=b[0]-a[0],th=b[1]-a[1],l=Math.hypot(td,th)||1;
      const nd=-th/l,nh=td/l;
      for(const s of [s0-P[i][0]*kA,s1+P[i][0]*kB]){pos.push(...at(s,P[i][0],P[i][1]));nor.push(N[0]*nd,nh,N[2]*nd);uv.push(s,arc[i]);}
    }
    for(let i=0;i<n-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
    // Angled end caps (the pocket jaws), flat-shaded.
    for(const [end,k,sign] of [[0,kA,-1],[1,kB,1]]){
      const base=pos.length/3,nx=S[0]*sign-N[0]*k,nz=S[2]*sign-N[2]*k,nl=Math.hypot(nx,nz);
      let cs=0,cd=0,ch=0;P.forEach(p=>{cd+=p[0];ch+=p[1];});cd/=n;ch/=n;cs=end?s1+cd*kB:s0-cd*kA;
      pos.push(...at(cs,cd,ch));nor.push(nx/nl,0,nz/nl);uv.push(cs,cd);
      for(let i=0;i<n;i++){const s=end?s1+P[i][0]*kB:s0-P[i][0]*kA;pos.push(...at(s,P[i][0],P[i][1]));nor.push(nx/nl,0,nz/nl);uv.push(s,P[i][0]+P[i][1]);}
      for(let i=0;i<n;i++)idx.push(base,base+1+i,base+1+(i+1)%n);
    }
    // Wind every triangle to agree with its vertex normals (front faces out).
    for(let t=0;t<idx.length;t+=3){
      const [i0,i1,i2]=[idx[t],idx[t+1],idx[t+2]],v=k=>[pos[k*3],pos[k*3+1],pos[k*3+2]];
      const A=v(i0),B=v(i1),C=v(i2),e1=sub(B,A),e2=sub(C,A),f=cross(e1,e2);
      const n=[nor[i0*3]+nor[i1*3]+nor[i2*3],nor[i0*3+1]+nor[i1*3+1]+nor[i2*3+1],nor[i0*3+2]+nor[i1*3+2]+nor[i2*3+2]];
      if(dot(f,n)<0){idx[t+1]=i2;idx[t+2]=i1;}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);
    const m=new T.Mesh(g,cushionMat);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
  }

  // ---- the table ----
  const tableParts=[];
  (function buildTable(){
    // Cloth: playing surface plus the strip under the cushions, with the six
    // pocket mouths cut out exactly where the physics captures a ball.
    const clothCircles=[[HX,HZ,.096],[-HX,HZ,.096],[HX,-HZ,.096],[-HX,-HZ,.096],[0,HZ+.004,.062],[0,-HZ-.004,.062]];
    const cloth=new T.Mesh(new T.ShapeGeometry(shapeFrom(notchedOutline(HX+.034,HZ+.034,clothCircles,false))).rotateX(-PI/2),clothMat);
    cloth.position.y=CLOTH_Y;cloth.receiveShadow=true;scene.add(cloth);
    box(2*IN_X-.02,.04,2*IN_Z-.02,slateMat,0,CLOTH_Y-.021,0,scene,false);
    // Six cushions; ends angled toward the pockets like real jaws.
    const corner=1.0,middle=.32;
    for(const zs of [-1,1]){
      cushionMesh(.073,HX-.095,middle,corner,[0,0,zs*HZ],[1,0,0],[0,0,zs]);
      cushionMesh(-(HX-.095),-.073,corner,middle,[0,0,zs*HZ],[1,0,0],[0,0,zs]);
    }
    for(const xs of [-1,1])cushionMesh(-(HZ-.096),HZ-.096,corner,corner,[xs*HX,0,0],[0,0,1],[xs,0,0]);
    // Polished top rail with the pocket openings cut through it.
    const railCircles=[[HX+.016,HZ+.016,.085],[-HX-.016,HZ+.016,.085],[HX+.016,-HZ-.016,.085],[-HX-.016,-HZ-.016,.085],[0,HZ+.045,.068],[0,-HZ-.045,.068]];
    const railShape=shapeFrom(roundedRect(OUT_X,OUT_Z,.07));
    railShape.holes.push(pathFrom(notchedOutline(IN_X,IN_Z,railCircles,true)));
    const railGeo=new T.ExtrudeGeometry(railShape,{depth:RAIL_T-.012,bevelEnabled:true,bevelThickness:.006,bevelSize:.006,bevelSegments:3,curveSegments:24});
    railGeo.rotateX(-PI/2);railGeo.translate(0,RAIL_TOP-RAIL_T+.006,0);
    const rail=new T.Mesh(railGeo,woodMat);rail.castShadow=true;rail.receiveShadow=true;scene.add(rail);
    // Leather pocket shields over the cut rail and down into each pocket.
    for(const c of railCircles){
      const cornerPocket=c[2]>.08,outward=Math.atan2(Math.sign(c[1]),cornerPocket?Math.sign(c[0]):0);
      const span=cornerPocket?PI*1.12:PI*1.04,pts=arcPts(c,outward-span/2,outward+span/2,c[2],36);
      const tube=new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(p[0],RAIL_TOP+.002,p[1]))),48,.0085,10,false);
      const shield=new T.Mesh(tube,leatherMat);shield.castShadow=true;scene.add(shield);
      wallFromArc(arcPts(c,outward-span/2,outward+span/2,c[2]-.004,36),CLOTH_Y-.07,RAIL_TOP+.002,pocketMat);
    }
    for(const p of POCKETS){
      const liner=new T.Mesh(new T.CylinderGeometry(p.radius*1.06,p.radius*.86,.07,32,1,true),pocketMat);
      liner.position.set(p.x,CLOTH_Y-.036,p.z);scene.add(liner);
    }
    // Body: apron panels between the pockets, mouldings, eight square legs.
    const apronH=.235,apronY=RAIL_TOP-RAIL_T-apronH/2+.004;
    for(const zs of [-1,1])for(const xs of [-1,1]){
      const x0=.105,x1=HX-.115,a=box(x1-x0,apronH,.075,woodMat,xs*(x0+x1)/2,apronY,zs*(OUT_Z-.05));tableParts.push(a);
      box(x1-x0+.01,.03,.088,woodDarkMat,xs*(x0+x1)/2,apronY-apronH/2+.01,zs*(OUT_Z-.05));
    }
    for(const xs of [-1,1]){
      box(.075,apronH,2*HZ-.23,woodMat,xs*(OUT_X-.05),apronY,0);
      box(.088,.03,2*HZ-.22,woodDarkMat,xs*(OUT_X-.05),apronY-apronH/2+.01,0);
    }
    const legTop=apronY-apronH/2,legH=legTop-FLOOR_Y;
    for(const x of [-(HX-.17),-.62,.62,HX-.17])for(const zs of [-1,1]){
      const leg=new T.Mesh(new T.CylinderGeometry(.075,.06,legH,4,1),woodDarkMat);leg.rotation.y=PI/4;
      leg.position.set(x,FLOOR_Y+legH/2,zs*(OUT_Z-.09));leg.castShadow=true;leg.receiveShadow=true;scene.add(leg);
      box(.13,.05,.13,woodDarkMat,x,FLOOR_Y+.025,zs*(OUT_Z-.09));
    }
  })();

  // Chalk-white baulk line, D and spots, carrying the cloth's weave.
  (function buildMarkings(){
    const w=.0045,y=CLOTH_Y+.0004;
    const baulk=new T.Mesh(new T.PlaneGeometry(w,2*HZ).rotateX(-PI/2),chalkMat);baulk.position.set(BAULK_X,y,0);baulk.receiveShadow=true;scene.add(baulk);
    const dArc=new T.Mesh(new T.RingGeometry(D-w/2,D+w/2,120,1,PI/2,PI).rotateX(-PI/2),chalkMat);dArc.position.set(BAULK_X,y,0);dArc.receiveShadow=true;scene.add(dArc);
    for(const p of Object.values(SPOTS)){const s=new T.Mesh(new T.CircleGeometry(.0048,20).rotateX(-PI/2),chalkMat);s.position.set(p[0],y,p[1]);s.receiveShadow=true;scene.add(s);}
  })();

  // ---- canopy light fixture ----
  const canopy=new T.Group();canopy.position.y=CANOPY_Y;scene.add(canopy);
  (()=>{const CW=3.15,CD=1.42,CH=.12;
    for(const z of [-CD/2,CD/2])box(CW,CH,.05,metalMat,0,CH/2,z,canopy,false);
    for(const x of [-CW/2,CW/2])box(.05,CH,CD,metalMat,x,CH/2,0,canopy,false);
    box(CW,.02,CD,metalMat,0,CH,0,canopy,false);
    const panel=new T.Mesh(new T.PlaneGeometry(CW-.1,CD-.1),new T.MeshBasicMaterial({color:new T.Color(1,.965,.9).multiplyScalar(1.6)}));
    panel.rotation.x=PI/2;panel.position.y=.01;canopy.add(panel);
    for(const [x,z] of [[-1.4,-.6],[1.4,-.6],[-1.4,.6],[1.4,.6]]){const cable=new T.Mesh(new T.CylinderGeometry(.004,.004,7,6),metalMat);cable.position.set(x,CH+3.5,z);canopy.add(cable);}
  })();

  // ---- arena: floor, stands, walls, scoreboard, players' chairs ----
  const seats=[];
  const arenaGroup=new T.Group();scene.add(arenaGroup);
  (function buildArena(){
    const carpet=document.createElement('canvas');carpet.width=carpet.height=256;const g=carpet.getContext('2d');
    g.fillStyle='#16191f';g.fillRect(0,0,256,256);
    for(let i=0;i<9000;i++){const v=18+Math.random()*16;g.fillStyle=`rgb(${v},${v+3},${v+9})`;g.fillRect(Math.random()*256,Math.random()*256,1.5,1.5);}
    const floor=new T.Mesh(new T.PlaneGeometry(44,44).rotateX(-PI/2),new T.MeshStandardMaterial({map:canvasTexture(carpet,18,18),roughness:1,envMapIntensity:.2}));
    floor.position.y=FLOOR_Y;floor.receiveShadow=true;scene.add(floor);
    const stepMat=new T.MeshStandardMaterial({color:'#101216',roughness:.95});
    const seatMat=new T.MeshStandardMaterial({color:'#3a0f15',roughness:.85});
    const seatGeo=T.BufferGeometryUtils.mergeGeometries([
      new T.BoxGeometry(.5,.09,.46).translate(0,.42,.02),new T.BoxGeometry(.5,.54,.07).translate(0,.71,-.22),new T.BoxGeometry(.32,.38,.3).translate(0,.19,-.04)]);
    const STANDS=[ // centre of the front row, direction along the row, direction toward the table
      {o:[4.35,0],along:[0,1],face:[-1,0],rows:3,per:9},
      {o:[.45,3.35],along:[1,0],face:[0,-1],rows:3,per:11},
      {o:[.45,-3.35],along:[1,0],face:[0,1],rows:3,per:11}];
    const ROW_D=.95,ROW_H=.42,SEAT_W=.64,seatSpots=[];
    for(const st of STANDS)for(let r=0;r<st.rows;r++){
      const cx=st.o[0]-st.face[0]*r*ROW_D,cz=st.o[1]-st.face[1]*r*ROW_D,y=FLOOR_Y+r*ROW_H,len=st.per*SEAT_W+.6;
      if(r>0){const w=Math.abs(st.along[0])*len+Math.abs(st.face[0])*ROW_D,d=Math.abs(st.along[1])*len+Math.abs(st.face[1])*ROW_D;
        box(w,r*ROW_H,d,stepMat,cx,FLOOR_Y+r*ROW_H/2,cz,arenaGroup,false);}
      for(let i=0;i<st.per;i++){const k=i-(st.per-1)/2;
        seatSpots.push({x:cx+st.along[0]*k*SEAT_W,y,z:cz+st.along[1]*k*SEAT_W,yaw:Math.atan2(st.face[0],st.face[1]),row:r});}
    }
    const inst=new T.InstancedMesh(seatGeo,seatMat,seatSpots.length);const m=new T.Matrix4(),q=new T.Quaternion(),one=new T.Vector3(1,1,1);
    seatSpots.forEach((s,i)=>{q.setFromAxisAngle(new T.Vector3(0,1,0),s.yaw);m.compose(new T.Vector3(s.x,s.y,s.z),q,one);inst.setMatrixAt(i,m);});
    inst.receiveShadow=true;arenaGroup.add(inst);
    seats.push(...seatSpots);
    // Walls with soft vertical light strips.
    const wallMat=new T.MeshStandardMaterial({color:'#08090c',roughness:.9});
    box(.2,7,15,wallMat,8.4,FLOOR_Y+3.5,0,arenaGroup,false);box(.2,7,15,wallMat,-9.5,FLOOR_Y+3.5,0,arenaGroup,false);
    box(18,7,.2,wallMat,-.5,FLOOR_Y+3.5,7,arenaGroup,false);box(18,7,.2,wallMat,-.5,FLOOR_Y+3.5,-7,arenaGroup,false);
    const stripMat=new T.MeshBasicMaterial({color:new T.Color('#ffcf8a').multiplyScalar(.55)});
    for(let i=-3;i<=3;i++){box(.02,2.6,.05,stripMat,8.28,FLOOR_Y+3.4,i*1.9,arenaGroup,false);
      for(const zs of [-1,1])box(.05,2.6,.02,stripMat,i*2.2,FLOOR_Y+3.4,zs*6.88,arenaGroup,false);}
    // Players' chairs with a small table and water glasses (players are not shown).
    const leather=new T.MeshStandardMaterial({color:'#121214',roughness:.45});
    for(const x of [-.95,.95]){const chair=new T.Group();chair.position.set(x,FLOOR_Y,-(OUT_Z+1.1));arenaGroup.add(chair);
      box(.56,.1,.52,leather,0,.46,0,chair);box(.56,.6,.08,leather,0,.82,-.24,chair);
      for(const s of [-1,1])box(.07,.26,.5,leather,s*.28,.6,0,chair);
      for(const [lx,lz] of [[-.24,-.22],[.24,-.22],[-.24,.22],[.24,.22]])box(.035,.42,.035,metalMat,lx,.21,lz,chair);}
    const tableTop=new T.Mesh(new T.CylinderGeometry(.25,.25,.025,32),woodDarkMat);tableTop.position.set(0,FLOOR_Y+.62,-(OUT_Z+1.1));tableTop.castShadow=true;arenaGroup.add(tableTop);
    const stem=new T.Mesh(new T.CylinderGeometry(.03,.05,.6,12),metalMat);stem.position.set(0,FLOOR_Y+.31,-(OUT_Z+1.1));arenaGroup.add(stem);
    const glassMat=new T.MeshPhysicalMaterial({color:'#dfe9ee',roughness:.04,metalness:0,transparent:true,opacity:.28,envMapIntensity:1.4,clearcoat:1});
    const waterMat=new T.MeshPhysicalMaterial({color:'#b9d4dc',roughness:.05,transparent:true,opacity:.32});
    for(const x of [-.08,.09]){const gl1=new T.Mesh(new T.CylinderGeometry(.034,.03,.12,24,1,true),glassMat);gl1.position.set(x,FLOOR_Y+.693,-(OUT_Z+1.1));arenaGroup.add(gl1);
      const w=new T.Mesh(new T.CylinderGeometry(.031,.029,.07,24),waterMat);w.position.set(x,FLOOR_Y+.67,-(OUT_Z+1.1));arenaGroup.add(w);}
  })();

  // Scoreboard over the far stand, redrawn whenever the score changes.
  const scoreCanvas=document.createElement('canvas');scoreCanvas.width=1024;scoreCanvas.height=288;
  const scoreTex=new T.CanvasTexture(scoreCanvas);scoreTex.colorSpace=T.SRGBColorSpace;scoreTex.anisotropy=maxAniso;
  (()=>{const board=new T.Mesh(new T.PlaneGeometry(2.9,.815),new T.MeshBasicMaterial({map:scoreTex,toneMapped:false}));
    board.position.set(8.25,FLOOR_Y+3.05,0);board.rotation.y=-PI/2;arenaGroup.add(board);
    box(.08,.9,3.0,metalMat,8.3,FLOOR_Y+3.05,0,arenaGroup,false);})();
  let scoreKey='';
  function drawScoreboard(names,scores,current,brk,frameNo){
    const key=names.join()+scores.join()+current+brk+frameNo;if(key===scoreKey)return;scoreKey=key;
    const g=scoreCanvas.getContext('2d'),W=1024,H=288;
    g.fillStyle='#05070a';g.fillRect(0,0,W,H);g.strokeStyle='rgba(215,184,122,.75)';g.lineWidth=4;g.strokeRect(6,6,W-12,H-12);
    g.fillStyle='#d6b77a';g.font='600 30px Georgia, serif';g.textAlign='center';g.fillText('THE VELVET MASTERS · FRAME '+String(frameNo).padStart(2,'0'),W/2,58);
    for(let i=0;i<2;i++){const x=i?W*.75:W*.25;
      g.fillStyle=current===i?'#f4e7c6':'#8d9a92';g.font='700 40px Arial, sans-serif';g.fillText(names[i],x,132);
      g.fillStyle='#ffffff';g.font='700 96px Georgia, serif';g.fillText(String(scores[i]),x,236);}
    g.fillStyle='#d6b77a';g.font='600 30px Arial, sans-serif';g.fillText('BREAK',W/2,150);
    g.fillStyle='#ffffff';g.font='700 64px Georgia, serif';g.fillText(String(brk),W/2,226);
    scoreTex.needsUpdate=true;
  }

  // ---- post-processing (HIGH quality): MSAA + gentle bloom on the lamp and highlights ----
  let composer=null;
  function ensureComposer(){
    if(composer)return composer;
    const rt=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:4});
    composer=new T.EffectComposer(renderer,rt);
    composer.addPass(new T.RenderPass(scene,camera));
    composer.addPass(new T.UnrealBloomPass(new T.Vector2(512,512),.12,.45,1.05));
    composer.addPass(new T.OutputPass());
    composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(width,height);
    return composer;
  }
