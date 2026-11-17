  // ===== VELVET STUDIO · OBJECTS & TEXTURES ===================================
  // Every object in the game, in groups, with the pictures of its materials:
  // swap any of them for an image or a video, tint, tile or light them up; take
  // any object (or a whole venue) to Blender as .glb with VX_ markers, and bring
  // models back: as a new look, as your own objects, or as a whole new venue.
  // Saved by the studio as objects/objects.js (+ objects/media) in the game folder.
  // (State is `var` and set up in objectsBoot: some of these run while the
  // venue is first built, before this part of the file has run.)
  var objReady=false,OD=null,mediaP=null,mediaRT=null,glbP=null,glbReady=null,matOrig=null,clothList=null,customGroup=null,replaceGroups=null,studio=null;
  function slugOf(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'part';}
  function odEmpty(){return {version:1,textures:{},replace:{},custom:[],venues:[],media:{}};}
  function odClean(d){if(!d||typeof d!=='object')return null;const o=odEmpty();for(const k of Object.keys(o))if(d[k]&&typeof d[k]==='object')o[k]=JSON.parse(JSON.stringify(d[k]));return o;}
  // venues made in Blender join the venue list (called before the saved venue is chosen)
  function objectsVenues(){try{const d=window.VELVET_OBJECTS;if(d&&Array.isArray(d.venues))for(const e of d.venues)if(e&&e.id&&e.media)VENUES[e.id]=glbVenueEntry(e);}catch(e){console.warn('VELVET objects: venues',e);}}
  function glbVenueEntry(e){return {name:e.name||'YOUR VENUE',event:e.event||e.name||'YOUR VENUE',desc:e.desc||'Your own venue, made in Blender.',light:'Your venue\'s own light',
    crowd:(e.seats||0)+' seats from your VX_SEAT markers',seat:'#3b1018',step:'#101114',wall:'#07070a',carpet:['#1b1c21',14,[0,0,2]],strip:'#000000',stripK:0,ad:null,
    house:0xdfe6ff,houseI:3.2,fog:0x040406,rowD:.86,rowH:.5,stands:[],walls:e.walls||[-14,14,14],board:0,noBoard:true,glb:e.media,cut:true,entrance:e.entrance||null,mine:true};}

  // ---- media: images, videos and models, kept as bytes and loaded on demand ----
  function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=()=>{s.remove();res();};s.onerror=()=>{s.remove();rej(new Error('Missing '+src));};document.head.appendChild(s);});}
  function mediaLoad(id){
    if(mediaP[id])return mediaP[id];
    return mediaP[id]=(async()=>{const m=OD.media[id];if(!m)throw new Error('Unknown picture or model '+id);
      let b64=m.b64;if(!b64){await loadScript('objects/'+(m.file||('media/'+id+'.js')));b64=window.VELVET_MEDIA&&window.VELVET_MEDIA[id];if(!b64)throw new Error('objects/media/'+id+'.js is missing');}
      const bytes=new Uint8Array(await (await fetch('data:'+(m.mime||'application/octet-stream')+';base64,'+b64)).arrayBuffer());
      if(window.VELVET_MEDIA)delete window.VELVET_MEDIA[id];
      const r={kind:m.kind,bytes,url:URL.createObjectURL(new Blob([bytes],{type:m.mime||'application/octet-stream'})),tex:{}};mediaRT[id]=r;return r;})();
  }
  async function mediaAdd(file,kind){
    const bytes=new Uint8Array(await file.arrayBuffer()),id='m'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
    const mime=file.type||(kind==='glb'?'model/gltf-binary':kind==='video'?'video/mp4':'image/png');
    OD.media[id]={name:file.name||id,kind,mime,size:bytes.length};
    const r={kind,bytes,url:URL.createObjectURL(new Blob([bytes],{type:mime})),tex:{}};mediaRT[id]=r;mediaP[id]=Promise.resolve(r);return id;
  }
  function kindOf(file){const n=(file.name||'').toLowerCase(),t=file.type||'';
    if(/\.(glb|gltf)$/.test(n)||t.includes('gltf'))return 'glb';if(t.startsWith('video/')||/\.(mp4|webm|mov|m4v|ogv)$/.test(n))return 'video';
    if(t.startsWith('image/')||/\.(png|jpe?g|webp|gif|bmp|avif)$/.test(n))return 'image';return null;}
  // one texture per picture (and per tiling / orientation), shared by every material that shows it
  async function mediaTexture(id,flipY,rx,ry){
    const r=await mediaLoad(id),k=(flipY?'f':'n')+(r.kind==='video'?'':'|'+rx.toFixed(3)+'|'+ry.toFixed(3));
    if(r.tex[k])return r.tex[k];
    let t;
    if(r.kind==='video'){
      if(!r.video){const v=document.createElement('video');v.muted=true;v.loop=true;v.playsInline=true;v.autoplay=true;v.setAttribute('playsinline','');v.setAttribute('muted','');v.src=r.url;v.play().catch(()=>{});r.video=v;}
      t=new T.VideoTexture(r.video);t.repeat.set(rx,ry);
    }else{
      if(!r.img){const img=new Image();img.src=r.url;await img.decode();r.img=img;}
      t=new T.Texture(r.img);t.repeat.set(rx,ry);t.anisotropy=maxAniso;
    }
    t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.flipY=flipY;t.needsUpdate=true;r.tex[k]=t;return t;
  }

  // ---- materials by name (key): find them, remember how they were made, dress them ----
  function matsByKey(key){
    const out=new Set(),add=m=>{if(m&&m.userData&&m.userData.vxKey===key)out.add(m);};
    scene.traverse(o=>{if(o.material)for(const m of [].concat(o.material))add(m);});
    if(key.startsWith('people.')){const P=window.VelvetPeople,t=P&&P.templates&&P.templates[key.split('.')[1]];if(t)t.scene.traverse(o=>{if(o.material)for(const m of [].concat(o.material))add(m);});}
    return [...out];
  }
  function origOf(m){if(!matOrig.has(m))matOrig.set(m,{map:m.map||null,color:m.color?m.color.clone():null,emissive:m.emissive?m.emissive.clone():null,emissiveMap:m.emissiveMap||null,emissiveIntensity:m.emissiveIntensity,toneMapped:m.toneMapped});return matOrig.get(m);}
  function restoreMat(m){const o=matOrig.get(m);if(!o)return;const a=!!m.map,b=!!m.emissiveMap;
    m.map=o.map;if(o.color)m.color.copy(o.color);if(o.emissive)m.emissive.copy(o.emissive);m.emissiveMap=o.emissiveMap;
    if(o.emissiveIntensity!==undefined)m.emissiveIntensity=o.emissiveIntensity;m.toneMapped=o.toneMapped;m.userData.vxOwn=false;
    if(a!==!!m.map||b!==!!m.emissiveMap)m.needsUpdate=true;}
  function tiledOf(map,tile){map.userData.vxTiles=map.userData.vxTiles||{};const k=tile.toFixed(3);
    if(!map.userData.vxTiles[k]){const t=map.clone();t.repeat.set(map.repeat.x*tile,map.repeat.y*tile);t.wrapS=t.wrapT=T.RepeatWrapping;t.needsUpdate=true;map.userData.vxTiles[k]=t;}
    return map.userData.vxTiles[k];}
  const applying={};
  async function applyTex(key){
    const o=OD.textures[key],mats=matsByKey(key);if(!mats.length)return;
    const ticket=applying[key]=(applying[key]||0)+1;
    const plan=[];
    for(const m of mats){const g=origOf(m),tile=o&&o.tile?o.tile:1,flip=g.map?g.map.flipY:!m.userData.vxGltf;
      let tex=null;if(o&&o.map){try{tex=await mediaTexture(o.map,flip,(g.map?g.map.repeat.x:1)*tile,(g.map?g.map.repeat.y:1)*tile);}catch(e){objWarn(e.message);}}
      plan.push([m,tex,tile]);}
    if(applying[key]!==ticket)return;   // a newer change won
    for(const [m,tex,tile] of plan){restoreMat(m);if(!o)continue;const a=!!m.map,b=!!m.emissiveMap;
      if(tex){m.map=tex;m.userData.vxOwn=true;}else if(tile!==1&&m.map&&!m.map.isRenderTargetTexture&&!m.map.isVideoTexture)m.map=tiledOf(m.map,tile);
      if(o.tint&&m.color){const k=Math.max(m.color.r,m.color.g,m.color.b,1);m.color.set(o.tint).multiplyScalar(m.toneMapped===false?k:1);}
      if(o.glow>0){if(m.emissive){m.emissive.set(o.tint||'#ffffff');m.emissiveMap=m.map||null;m.emissiveIntensity=o.glow;}else if(m.color){m.color.multiplyScalar(1+o.glow);m.toneMapped=false;}}
      if(a!==!!m.map||b!==!!m.emissiveMap)m.needsUpdate=true;}
  }

  // ---- people: their materials get names when the characters arrive ----
  function personMatLabel(n){n=String(n||'').toLowerCase();return /head|face/.test(n)?'Head and face':/opac|hair|lash/.test(n)?'Hair and lashes':/body|cloth|suit/.test(n)?'Body and clothes':/eye/.test(n)?'Eyes':/teeth|mouth/.test(n)?'Mouth':(n||'Part');}
  function objectsTagPeople(){
    const P=window.VelvetPeople;if(!P||!P.templates)return;
    for(const [cid,tpl] of Object.entries(P.templates)){let n=0;
      tpl.scene.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material)){if(!m||m.userData.vxKey)continue;n++;
        m.userData.vxGltf=true;vxKey(m,'people.'+cid+'.'+slugOf(m.name||o.name||('part-'+n)),personMatLabel(m.name||o.name));}});}
    if(objReady)for(const k of Object.keys(OD.textures))if(k.startsWith('people.'))applyTex(k);
    if(studio&&studio.on)setTimeout(studioRender,0);
  }

  // ---- .glb in: parse, read the VX_ markers, line up with the table ----
  function gltfOf(id){
    if(glbP[id])return glbP[id];
    return glbP[id]=mediaLoad(id).then(r=>new Promise((res,rej)=>{const l=new T.GLTFLoader();if(T.MeshoptDecoder)l.setMeshoptDecoder(T.MeshoptDecoder);
      l.parse(r.bytes.buffer.slice(r.bytes.byteOffset,r.bytes.byteOffset+r.bytes.byteLength),'',g=>{const info=prepGltf(g);glbReady[id]=info;res(info);},e=>rej(new Error('Not a readable .glb: '+((e&&e.message)||e))));}));
  }
  function markerOf(o){
    const mm=/^VX_([A-Za-z]+)(?:_([A-Za-z0-9]+))?/.exec(o.name||''),ex=o.userData&&(o.userData.vx||o.userData.VX);
    if(!mm&&!ex)return null;
    const role=String(mm?mm[1]:ex).toUpperCase();let sub=(mm&&mm[2]?mm[2]:(o.userData&&o.userData.sub)||'').toString().toUpperCase();
    if(/^\d+$/.test(sub))sub='';   // VX_SEAT_12 / VX_SEAT.012: copies of the same marker
    return {role:role==='SCREENLIVE'?'SCREEN':role,sub:role==='SCREENLIVE'?'LIVE':sub};
  }
  function prepGltf(g){
    const root=g.scene,markers=[];root.updateMatrixWorld(true);
    root.traverse(o=>{const mk=markerOf(o);if(o.material)for(const m of [].concat(o.material))if(m)m.userData.vxGltf=true;
      if(!mk)return;const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();o.matrixWorld.decompose(p,q,s);
      // CLOTH and SCREEN mark a mesh: the marker's parent mesh, or the mesh itself when it carries the name
      const target=(mk.role==='CLOTH'||mk.role==='SCREEN')?(o.isMesh?o:(o.parent&&o.parent.isMesh?o.parent:null)):null;
      markers.push({role:mk.role,sub:mk.sub,name:o.name,pos:p,quat:q,scale:s,extras:Object.assign({},o.userData||{}),target:target?target.name||target.uuid:null});
      if(target)target.userData.vxRole=mk.role+(mk.sub?'_'+mk.sub:'');
      if(!target||target!==o)o.userData.vxMarker=true;});
    const bb=new T.Box3();root.traverse(o=>{if(o.isMesh&&!o.userData.vxMarker){o.geometry.computeBoundingBox();bb.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
    return {root,markers,box:bb,anims:g.animations||[]};
  }
  // VX_TABLE is the box of the table: the model moves (and turns) so it sits under the game's table
  function alignOf(info){
    const t=info.markers.find(k=>k.role==='TABLE'),m=new T.Matrix4();
    if(!t)return m;
    const yaw=new T.Euler().setFromQuaternion(t.quat,'YXZ').y,want=new T.Vector3(0,(FLOOR_Y+CLOTH_Y)/2,0);
    const r=new T.Matrix4().makeRotationY(-yaw),p=t.pos.clone().applyMatrix4(r);
    return m.makeTranslation(want.x-p.x,want.y-p.y,want.z-p.z).multiply(r);
  }
  function useClone(info,keyBase,opts={}){
    const r=info.root.clone(true);let n=0;
    r.traverse(o=>{
      if(o.userData.vxMarker){o.visible=false;return;}
      if(o.isMesh){o.castShadow=o.receiveShadow=true;if(o.userData.vxRole==='CLOTH')o.userData.vxCloth=true;
        if(opts.ownMats)o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
        for(const m of [].concat(o.material)){if(!m||(m.userData.vxKey&&!opts.ownMats))continue;n++;vxKey(m,keyBase+'.'+slugOf(m.name||o.name||('part-'+n)),m.name||o.name||('Part '+n));}}});
    return r;
  }
  function glbSeats(v,seatSpots,proxySpots,rnd){
    const info=glbReady&&glbReady[v.glb];if(!info)return;const al=alignOf(info),q0=new T.Quaternion().setFromRotationMatrix(al);
    const pts=info.markers.filter(k=>k.role==='SEAT').map(k=>{const p=k.pos.clone().applyMatrix4(al),d=new T.Vector3(0,0,1).applyQuaternion(k.quat).applyQuaternion(q0);
      return {x:p.x,y:p.y,z:p.z,yaw:Math.atan2(d.x,d.z),dist:Math.hypot(p.x,p.z)};}).sort((a,b)=>a.dist-b.dist);
    const live=Math.min(96,Math.round(pts.length*.35));
    pts.forEach((s,i)=>{const spot={x:s.x,y:s.y,z:s.z,yaw:s.yaw,row:Math.floor(s.dist),si:Math.min(7,Math.floor((Math.atan2(s.z,s.x)+PI)/TAU*8))};
      if(i<live&&rnd()<.85)seatSpots.push(spot);else{spot.full=rnd()<.9;proxySpots.push(spot);}});
    const e=info.markers.find(k=>k.role==='ENTRANCE');if(e){const p=e.pos.clone().applyMatrix4(al);v.entrance=[p.x,p.z];}
  }
  function ensureStageRT(){if(!stage.rt){stage.rt=new T.WebGLRenderTarget(768,432,{samples:2});stage.rt.texture.colorSpace=T.SRGBColorSpace;stage.cam=new T.PerspectiveCamera(32,16/9,.05,60);}}
  function buildGlbVenue(v){
    const info=glbReady&&glbReady[v.glb];
    if(!info){if(glbP&&OD){const want=v;gltfOf(v.glb).then(()=>{if(VENUES[venueId]===want)setVenue(venueId);}).catch(e=>objWarn('Your venue could not be loaded: '+e.message));}return;}
    const grp=new T.Group();grp.name='Your venue';arenaGroup.add(grp);stage.group=grp;stage.screens.length=0;
    const al=alignOf(info),root=useClone(info,'venue.'+venueId);root.applyMatrix4(al);grp.add(root);
    const live=[];root.traverse(o=>{if(o.isMesh&&/^SCREEN_LIVE/.test(o.userData.vxRole||''))live.push(o);});
    if(live.length){ensureStageRT();stage.barTex=stage.barTex||stageTexture(1024,128,()=>{});
      for(const s of live){s.material=s.material.clone();s.material.map=stage.rt.texture;s.material.toneMapped=false;s.material.needsUpdate=true;vxKey(s.material,'venue.'+venueId+'.live-screens','Live screens');stage.screens.push(s);}}
    const tro=info.markers.find(k=>k.role==='TROPHY');if(tro){const p=tro.pos.clone().applyMatrix4(al);stage.trophyAt=[p.x,FLOOR_Y+1.35,p.z];}
    for(const k of info.markers.filter(k=>k.role==='LIGHT'&&k.sub!=='TABLE')){const ex=k.extras||{},p=k.pos.clone().applyMatrix4(al);
      const l=new T.PointLight(new T.Color(ex.color||'#ffffff'),+ex.intensity||14,+ex.distance||20,1.6);l.position.copy(p);grp.add(l);}
  }

  // ---- your own seat model, trophy, table, nets and lamp ----
  const REPL={table:'Table',nets:'Pocket nets',lamp:'Table lamp',trophy:'Trophy',seat:'Seat model'};
  function seatModelFrom(info){
    const s=info.markers.find(k=>k.role==='SEAT'),off=new T.Matrix4();
    if(s){const yaw=new T.Euler().setFromQuaternion(s.quat,'YXZ').y;off.makeRotationY(-yaw).multiply(new T.Matrix4().makeTranslation(-s.pos.x,-s.pos.y,-s.pos.z));}
    const geos=[],mats=[];info.root.updateMatrixWorld(true);
    info.root.traverse(o=>{if(!o.isMesh||o.userData.vxMarker||o.isSkinnedMesh)return;const g=o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(off,o.matrixWorld));
      for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);if(!g.attributes.normal)g.computeVertexNormals();
      if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
      geos.push(g.index?g.toNonIndexed():g);const m=[].concat(o.material)[0];m.userData.vxGltf=true;if(!m.userData.vxKey)vxKey(m,'repl.seat.'+slugOf(m.name||('part-'+mats.length)),m.name||('Seat part '+(mats.length+1)));mats.push(m);});
    if(!geos.length)return null;
    return {geo:T.BufferGeometryUtils.mergeGeometries(geos,true),mat:mats};
  }
  async function applyReplace(id){
    const media=OD.replace[id],root=id==='trophy'?arenaGroup:scene,built=[];
    if(id==='seat'){seatModel=null;if(media){try{seatModel=seatModelFrom(await gltfOf(media));}catch(e){objWarn(e.message);}}if(OD.replace.seat===media)setVenue(venueId);return;}
    root.traverse(o=>{if(o.userData.vxObj===id)built.push(o);});
    if(replaceGroups[id]){clothForget(replaceGroups[id]);replaceGroups[id].removeFromParent();replaceGroups[id]=null;}
    for(const o of built)o.visible=!media;
    if(!media||!built.length&&id==='trophy')return;
    let info;try{info=await gltfOf(media);}catch(e){objWarn(e.message);for(const o of built)o.visible=true;return;}
    if(OD.replace[id]!==media)return;
    const g=new T.Group();g.name='Your '+REPL[id];g.userData.vxRepl=id;
    const r=useClone(info,'repl.'+id);
    if(id==='table'||id==='nets')r.applyMatrix4(alignOf(info));
    if(id==='trophy'){const t=info.markers.find(k=>k.role==='TROPHY'),at=stage.trophyAt||[3.05,0,2.2];if(t)r.position.add(new T.Vector3(at[0]-t.pos.x,FLOOR_Y-t.pos.y,at[2]-t.pos.z));}
    g.add(r);(id==='trophy'&&built[0]?built[0].parent:root).add(g);replaceGroups[id]=g;
    g.traverse(o=>{if(o.isMesh&&o.userData.vxCloth)clothAdd(o);});
  }

  // ---- your objects: models and banners ----
  function scopeOK(e){return !e.scope||e.scope==='all'||e.scope===venueId;}
  function placeCustom(e,g){g.position.fromArray(e.pos||[0,FLOOR_Y,0]);g.rotation.set(0,(e.turn||0)*PI/180,0);g.scale.setScalar(e.size||1);g.visible=scopeOK(e);}
  async function buildCustom(e){
    const g=new T.Group();g.name=e.name||'Your object';g.userData.vxCustom=e.id;customGroup.add(g);placeCustom(e,g);
    if(e.kind==='banner'){
      const mat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,side:e.twoSided?T.DoubleSide:T.FrontSide});vxKey(mat,'obj.'+e.id+'.screen','Banner picture');
      const scr=new T.Mesh(new T.PlaneGeometry(e.w||2.4,e.h||1.35),mat);scr.position.y=(e.h||1.35)/2+(e.lift||0);g.add(scr);
      const back=new T.Mesh(new T.BoxGeometry((e.w||2.4)+.08,(e.h||1.35)+.08,.06),new T.MeshStandardMaterial({color:'#0b0c0f',roughness:.5,metalness:.4}));
      back.position.set(0,scr.position.y,-.035);vxKey(back.material,'obj.'+e.id+'.frame','Frame');g.add(back);
    }else{
      try{const info=await gltfOf(e.media);g.add(useClone(info,'obj.'+e.id,{ownMats:true}));}catch(err){objWarn((e.name||'A model')+': '+err.message);}
      g.traverse(o=>{if(o.isMesh&&o.userData.vxCloth)clothAdd(o);});
      g.traverse(o=>{if(o.isMesh&&/^SCREEN_LIVE/.test(o.userData.vxRole||'')){ensureStageRT();o.material.map=stage.rt.texture;o.material.toneMapped=false;o.material.needsUpdate=true;}});
    }
    for(const k of Object.keys(OD.textures))if(k.startsWith('obj.'+e.id+'.'))applyTex(k);
    return g;
  }
  function customObj(id){return customGroup.children.find(g=>g.userData.vxCustom===id);}
  async function rebuildCustoms(){for(const g of [...customGroup.children]){clothForget(g);g.removeFromParent();}for(const e of OD.custom)await buildCustom(e);}

  // ---- cloth: a mesh marked VX_CLOTH stretches round the balls lying in it ----
  function clothAdd(mesh){if(clothList.some(c=>c.mesh===mesh))return;const g=mesh.geometry=mesh.geometry.clone(),pos=g.attributes.position;
    clothList.push({mesh,pos,base:Float32Array.from(pos.array),sig:0,bent:false,n:0});}
  function clothForget(root){clothList=clothList.filter(c=>{let o=c.mesh;while(o){if(o===root)return false;o=o.parent;}return true;});}
  const _osInv=new T.Matrix4(),_osBp=new T.Vector3();
  function clothStep(){
    if(!objReady||!clothList.length)return;
    for(const c of clothList){const m=c.mesh;if(!m.visible||!m.parent)continue;
      let sig=0;for(const f of falling)sig+=f.x*13.1+f.y*7.7+f.z*3.3+1;
      if(Math.abs(sig-c.sig)<1e-6&&(c.bent||!falling.length))continue;c.sig=sig;
      const a=c.pos.array,b=c.base;a.set(b);
      if(falling.length){m.updateMatrixWorld();_osInv.copy(m.matrixWorld).invert();const k=1/Math.max(1e-6,m.matrixWorld.getMaxScaleOnAxis());
        const local=falling.map(f=>_osBp.set(f.x,f.y,f.z).applyMatrix4(_osInv).toArray());const r=R*k,reach=r+.012*k,sag=r*1.7;
        for(let i=0;i<a.length;i+=3){const x=b[i],y=b[i+1],z=b[i+2];let px=x,py=y,pz=z;
          for(const p of local){const dx=px-p[0],dy=py-p[1],dz=pz-p[2],d=Math.hypot(dx,dy,dz);
            if(d<reach&&d>1e-6){const s=(r+.004*k)/d;if(s>1){px=p[0]+dx*s;py=p[1]+dy*s;pz=p[2]+dz*s;}}
            const hd=Math.hypot(x-p[0],z-p[2]);if(y<p[1]&&hd<sag)py-=(1-hd/sag)*.007*k;}   // the weight of the ball pulls the net down
          a[i]=px;a[i+1]=py;a[i+2]=pz;}}
      c.pos.needsUpdate=true;c.bent=falling.length>0;if((c.n++)%2===0||!c.bent)m.geometry.computeVertexNormals();}
  }

  // ---- everything together: (re)apply what the studio data says ----
  async function applyAll(){
    for(const k of new Set([...Object.keys(OD.textures),...(studio&&studio.touched||[])]))applyTex(k);
    for(const id of new Set([...Object.keys(REPL)]))if(OD.replace[id]||replaceGroups[id]||(id==='seat'&&seatModel))applyReplace(id);
    await rebuildCustoms();
    if(studio&&studio.on)studioRender();
  }
  function objectsAfterArena(v){
    if(!objReady)return;
    for(const k of Object.keys(OD.textures))if(k.startsWith('venue.'+venueId+'.')||/^(props|trophy|tvcam|repl\.trophy)\./.test(k))applyTex(k);
    if(OD.replace.trophy)applyReplace('trophy');
    for(const g of customGroup.children){const e=OD.custom.find(x=>x.id===g.userData.vxCustom);if(e)g.visible=scopeOK(e);}
    if(studio&&studio.on){studio.sel=studio.sel&&studio.sel.startsWith('venue')?'venue':studio.sel;studioRender();}
  }
  function objWarn(msg){console.warn('VELVET objects:',msg);if(studio&&studio.on)studioToast(msg,true);}
  function objectsBoot(){
    OD=odClean(window.VELVET_OBJECTS)||odEmpty();mediaP={};mediaRT={};glbP={};glbReady={};matOrig=new WeakMap();clothList=[];replaceGroups={};
    customGroup=new T.Group();customGroup.name='Your objects';scene.add(customGroup);
    for(const o of scene.children)if(o.isMesh&&!o.userData.vxObj){const m=[].concat(o.material)[0],k=m&&m.userData.vxKey||'';if(k.startsWith('table.'))o.userData.vxObj='table';}
    scene.traverse(o=>{if(o.isMesh&&o.userData.vxRole==='CLOTH'){o.userData.vxCloth=true;clothAdd(o);}});
    objReady=true;
    // a Blender venue: read its model first, so its seats and entrance are known when it is built
    const v=VENUES[venueId];if(v&&v.glb)gltfOf(v.glb).then(()=>setVenue(venueId)).catch(e=>objWarn(e.message));
    applyAll().catch(e=>objWarn(e.message));
    addStudioEntry();
    if(/^#studio/.test(location.hash))setTimeout(enterStudio,30);
  }

  // ---- .glb out: objects in world coordinates, with VX_ markers ----
  let _osArrow=null,_osGuide=null,_osMarkMat=null,_osGuideMat=null;
  function vxSpot(role,x,y,z,yaw,extras){
    if(!_osArrow){_osArrow=T.BufferGeometryUtils.mergeGeometries([new T.ConeGeometry(.07,.2,12).rotateX(PI/2).translate(0,.06,.18),new T.CylinderGeometry(.018,.018,.18,8).rotateX(PI/2).translate(0,.06,.04),new T.SphereGeometry(.05,10,8).translate(0,.06,0)].map(g=>g.toNonIndexed()));
      _osMarkMat=new T.MeshBasicMaterial({color:'#ff8a1f',transparent:true,opacity:.85});_osMarkMat.name='VX_MARKER';}
    const m=new T.Mesh(_osArrow,_osMarkMat);m.name='VX_'+role;m.position.set(x,y,z);m.rotation.y=yaw||0;m.userData=Object.assign({vx:role.split('_')[0]},extras||{});return m;
  }
  function vxBox(role,cx,cy,cz,sx,sy,sz,extras){
    if(!_osGuide){_osGuide=new T.BoxGeometry(1,1,1);_osGuideMat=new T.MeshBasicMaterial({color:'#38c8ff',transparent:true,opacity:.14,depthWrite:false});_osGuideMat.name='VX_GUIDE';}
    const m=new T.Mesh(_osGuide,_osGuideMat);m.name='VX_'+role;m.position.set(cx,cy,cz);m.scale.set(sx,sy,sz);m.userData=Object.assign({vx:role.split('_')[0]},extras||{});return m;
  }
  function vxMark(role,mesh,extras){const e=new T.Object3D();e.name='VX_'+role;e.userData=Object.assign({vx:role.split('_')[0]},extras||{});mesh.add(e);return e;}
  const exportable=m=>{if(!m)return m;const map=m.map;
    if(m.userData.vxLocked)return null;
    for(const t of [m.map,m.emissiveMap])if(t&&!m.transparent&&!(m.alphaTest>0)&&!t.userData.mimeType)t.userData.mimeType='image/jpeg';   // smaller files; pictures with see-through parts stay PNG
    if(map&&(map.isRenderTargetTexture||map.isVideoTexture||!(map.image&&(map.image.width||map.image.videoWidth)))){const c=m.clone();c.map=null;return c;}
    return m;};
  // copies the meshes under root that pass `pick` into out, in world coordinates; returns source -> copy
  function addWorld(out,root,pick){
    const made=new Map();root.updateMatrixWorld(true);
    root.traverse(o=>{
      if(!o.isMesh||o.isSkinnedMesh||!pick(o))return;for(let p=o;p;p=p.parent)if(!p.visible)return;
      const mats=[].concat(o.material).map(exportable);if(mats.some(m=>!m))return;
      let g=o.geometry,mat=Array.isArray(o.material)?mats:mats[0];
      if(o.isInstancedMesh){const parts=[],im=new T.Matrix4();const n=Math.min(o.count,4000);
        for(let i=0;i<n;i++){o.getMatrixAt(i,im);const p=g.clone().applyMatrix4(im);for(const k of Object.keys(p.attributes))if(!['position','normal','uv'].includes(k))p.deleteAttribute(k);parts.push(p.index?p.toNonIndexed():p);}
        g=T.BufferGeometryUtils.mergeGeometries(parts,false)||g;if(Array.isArray(mat))mat=mat[0];}
      if(!g.index&&g.attributes.position.count>5000){try{g=T.BufferGeometryUtils.mergeVertices(g,1e-5);}catch(e){}}   // shared corners: a much smaller file
      const c=new T.Mesh(g,mat);c.name=(mats[0]&&mats[0].userData.vxLabel)||o.name||'part';
      o.matrixWorld.decompose(c.position,c.quaternion,c.scale);out.add(c);made.set(o,c);});
    return made;
  }
  function pocketName(p){return (p.x<-.2?'B':p.x>.2?'T':'M')+(p.z<0?'L':'R');}
  function keepClear(out){out.add(vxBox('KEEP_CLEAR',0,FLOOR_Y+1.1,-.2,2*(OUT_X+1.25),2.2,2*OUT_Z+2.9,{note:'Players and the referee walk here: keep it clear'}));}
  function tableBox(out){out.add(vxBox('TABLE',0,(FLOOR_Y+CLOTH_Y)/2,0,2*OUT_X,CLOTH_Y-FLOOR_Y,2*OUT_Z,{note:'The table: your model is moved so this box sits under the game\'s table'}));}
  async function exportItem(id){
    const out=new T.Group(),it=itemOf(id);out.name='VELVET_'+slugOf(it?it.label:id);let file=slugOf(it?it.label:id);
    if(id==='table'||id==='nets'||id==='lamp'){
      const made=addWorld(out,scene,o=>{for(let p=o;p;p=p.parent)if(p.userData.vxObj===id||p.userData.vxRepl===id)return true;return false;});
      tableBox(out);if(id==='table')keepClear(out);
      if(id!=='lamp')for(const p of POCKETS)out.add(vxSpot('POCKET_'+pocketName(p),p.x,CLOTH_Y,p.z,Math.atan2(p.ux,p.uz),{radius:+p.radius.toFixed(4)}));
      for(const [src,c] of made)if(src.userData.vxCloth||src.userData.vxRole==='CLOTH')vxMark('CLOTH',c,{note:'This mesh stretches round the balls that fall into it'});
      if(id==='lamp')out.add(vxSpot('LIGHT_TABLE',0,CANOPY_Y,0,0,{note:'The table light (fixed)'}));
    }else if(id==='balls'){
      for(const [,e] of ballMeshes){if(!e.mesh.visible)continue;const c=new T.Mesh(e.mesh.geometry,e.mesh.material);c.name='BALL_'+e.type.toUpperCase();e.mesh.matrixWorld.decompose(c.position,c.quaternion,c.scale);out.add(c);}
      tableBox(out);
    }else if(id==='cue'){
      for(const k of cueGroup.children){const c=new T.Mesh(k.geometry,k.material);c.name=(k.material.userData.vxLabel||'Cue part');k.updateMatrix();c.applyMatrix4(k.matrix);out.add(c);}
      out.add(vxSpot('CUE_TIP',0,0,0,0,{note:'The tip: the cue lies along +Y'}));
    }else if(id==='seat'){
      const sm=seatModel,c=new T.Mesh(sm?sm.geo:T.BufferGeometryUtils.mergeGeometries([new T.BoxGeometry(.5,.09,.46).translate(0,.42,.02),new T.BoxGeometry(.5,.54,.07).translate(0,.71,-.22),new T.BoxGeometry(.32,.38,.3).translate(0,.19,-.04)]),sm?sm.mat:matsByKey('venue.'+venueId+'.seats')[0]||new T.MeshStandardMaterial({color:'#4c0e18'}));
      c.name='SEAT';out.add(c);out.add(vxSpot('SEAT',0,0,0,0,{note:'Where a spectator sits; the arrow is where they look'}));
    }else if(id==='trophy'||id==='tvcam'){
      addWorld(out,arenaGroup,o=>{for(let p=o;p;p=p.parent)if(p.userData.vxObj===id||p.userData.vxRepl===id)return true;return false;});
      if(id==='trophy'&&stage.trophyAt)out.add(vxSpot('TROPHY',stage.trophyAt[0],FLOOR_Y,stage.trophyAt[2],0,{note:'Where the trophy stands (the TV director films it)'}));
    }else if(id==='venue'){
      const v=VENUES[venueId],made=addWorld(out,arenaGroup,o=>{const m=[].concat(o.material)[0];return !(m&&m.userData.vxLocked)&&!proxyMeshes.includes(o)&&o!==cutouts;});
      tableBox(out);keepClear(out);
      for(const s of venueSpots)out.add(vxSpot('SEAT',+s.x.toFixed(3),+s.y.toFixed(3),+s.z.toFixed(3),s.yaw,{live:seats.includes(s)}));
      const e=introEntrance();out.add(vxSpot('ENTRANCE',e[0],FLOOR_Y,e[1],Math.atan2(-e[0],-e[1]),{note:'Where the players walk on'}));
      if(stage.trophyAt)out.add(vxSpot('TROPHY',stage.trophyAt[0],FLOOR_Y,stage.trophyAt[2],0));
      arenaGroup.traverse(o=>{if(o.userData.vxObj==='tvcam'){const p=new T.Vector3();o.getWorldPosition(p);out.add(vxSpot('TVCAM',p.x,FLOOR_Y,p.z,Math.atan2(-p.x,-p.z)));}});
      const liveSet=new Set([...stage.screens,...(stage.cycle||[]).map(c=>c.mesh)]);
      for(const [src,c] of made)if(liveSet.has(src))vxMark('SCREEN_LIVE',c,{note:'Shows the live picture'});
      arenaGroup.traverse(o=>{if(o.isLight&&!o.isAmbientLight){const p=new T.Vector3();o.getWorldPosition(p);out.add(vxSpot('LIGHT',p.x,p.y,p.z,0,{color:'#'+o.color.getHexString(),intensity:+o.intensity.toFixed(2)}));}});
      out.userData={venue:v.name,event:v.event};file='venue-'+slugOf(v.name);
    }else if(id.startsWith('people/')){
      const P=window.VelvetPeople,cid=id.slice(7),pp=P&&P.templates[cid]&&P.spawn(cid);if(!pp)throw new Error('Character not loaded');
      out.add(pp.obj);file='character-'+slugOf(cid);
      const glb=await new T.GLTFExporter().parseAsync(out,{binary:true,onlyVisible:true,maxTextureSize:2048});freePerson(pp);return saveBlob(file+'.glb',new Blob([glb],{type:'model/gltf-binary'}));
    }else if(id.startsWith('obj/')){
      const e=OD.custom.find(x=>'obj/'+x.id===id);if(e&&e.kind!=='banner'){const r=await mediaLoad(e.media);return saveBlob(slugOf(e.name)+'.glb',new Blob([r.bytes],{type:'model/gltf-binary'}));}
      const g=customObj(e.id);if(g)addWorld(out,g,()=>true);file=slugOf(e.name);
    }
    if(!out.children.length)throw new Error('Nothing to export here');
    const glb=await new T.GLTFExporter().parseAsync(out,{binary:true,onlyVisible:false,maxTextureSize:2048});
    saveBlob('VELVET-'+file+'.glb',new Blob([glb],{type:'model/gltf-binary'}));return glb;
  }
  function saveBlob(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),6000);}

  // ---- saving: objects/objects.js (+ objects/media/*.js), straight into the game folder ----
  function b64Of(bytes){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]||'');fr.onerror=()=>rej(fr.error);fr.readAsDataURL(new Blob([bytes]));});}
  function usedMedia(){const s=new Set();for(const t of Object.values(OD.textures))if(t&&t.map)s.add(t.map);for(const m of Object.values(OD.replace))if(m)s.add(m);
    for(const e of OD.custom)if(e.media)s.add(e.media);for(const v of OD.venues)if(v.media)s.add(v.media);return [...s].filter(id=>OD.media[id]);}
  async function objectsText(inline){
    const d=JSON.parse(JSON.stringify(OD)),keep=new Set(usedMedia());
    for(const id of Object.keys(d.media)){if(!keep.has(id)){delete d.media[id];continue;}delete d.media[id].b64;
      if(inline)d.media[id].b64=await b64Of((await mediaLoad(id)).bytes);else d.media[id].file='media/'+id+'.js';}
    return '/* VELVET Studio · objects & textures. Made in VELVET Studio (index.html#studio).\n   Delete this file (and the media folder) to go back to the original look. */\nwindow.VELVET_OBJECTS='+JSON.stringify(d)+';\n';
  }
  const studioDB=(mode,fn)=>new Promise((res,rej)=>{const r=indexedDB.open('velvet-studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onerror=()=>rej(r.error);
    r.onsuccess=()=>{const tx=r.result.transaction('kv',mode),q=fn(tx.objectStore('kv'));tx.oncomplete=()=>res(q&&q.result);tx.onerror=()=>rej(tx.error);};});
  async function gameFolder(pick){
    if(!window.showDirectoryPicker)return null;
    if(!pick){let d=studio.dir||await studioDB('readonly',s=>s.get('dir')).catch(()=>null);
      if(d){let p=await d.queryPermission({mode:'readwrite'}).catch(()=>'denied');if(p!=='granted')p=await d.requestPermission({mode:'readwrite'}).catch(()=>'denied');if(p==='granted')return studio.dir=d;}}
    const d=await window.showDirectoryPicker({id:'velvet-game',mode:'readwrite'});
    try{await d.getFileHandle('index.html');}catch(e){throw new Error('That is not the game folder. Choose the folder with index.html in it.');}
    studioDB('readwrite',s=>s.put(d,'dir')).catch(()=>{});return studio.dir=d;
  }
  async function saveObjects(how){
    if(!OD)return;studioBusy('SAVING…');
    try{
      if(how!=='download'&&window.showDirectoryPicker){
        const d=await gameFolder(how==='folder'),od=await d.getDirectoryHandle('objects',{create:true}),md=await od.getDirectoryHandle('media',{create:true});
        for(const id of usedMedia()){const fh=await md.getFileHandle(id+'.js',{create:true}),w=await fh.createWritable();
          await w.write('(window.VELVET_MEDIA=window.VELVET_MEDIA||{})['+JSON.stringify(id)+']="'+await b64Of((await mediaLoad(id)).bytes)+'";\n');await w.close();}
        const fh=await od.getFileHandle('objects.js',{create:true}),w=await fh.createWritable();await w.write(await objectsText(false));await w.close();
        studio.dirty=false;studioStatus('Saved to objects/objects.js · '+new Date().toLocaleTimeString());studioToast('Saved. The game uses it the next time it opens.');return;
      }
      saveBlob('objects.js',new Blob([await objectsText(true)],{type:'text/javascript'}));studio.dirty=false;studioStatus('Saved as a download');
      studioModal('<h2>One more step</h2><p>Your browser saved <b>objects.js</b> to your downloads. Put it in the game\'s <b>objects</b> folder (make the folder if it is not there), then open the game again.</p><p class="os-note">In Chrome or Edge the studio saves straight into the game folder.</p>');
    }catch(err){if(!(err&&err.name==='AbortError'))studioToast((err&&err.message)||String(err),true);}
    finally{studioBusy(false);}
  }
  async function exportPack(){studioBusy('PACKING…');try{const t=await objectsText(true);saveBlob('velvet-objects.velvetobjects',new Blob([t.slice(t.indexOf('=')+1).replace(/;\s*$/,'')],{type:'application/json'}));}finally{studioBusy(false);}}
  async function importPack(file){
    const d=odClean(JSON.parse(await file.text()));if(!d)throw new Error('Not a VELVET objects pack');
    for(const [id,m] of Object.entries(d.media))if(m.b64){OD.media[id]=Object.assign({},m);delete mediaP[id];}
    Object.assign(OD.textures,d.textures);Object.assign(OD.replace,d.replace);
    for(const e of d.custom)if(!OD.custom.some(x=>x.id===e.id))OD.custom.push(e);
    for(const v of d.venues)if(!OD.venues.some(x=>x.id===v.id)){OD.venues.push(v);VENUES[v.id]=glbVenueEntry(v);}
    fillVenueSelect();await applyAll();studioChanged();
  }
  function fillVenueSelect(){for(const vs of [$('venue-select'),studio&&studio.el&&studio.el.querySelector('#os-venue')]){if(!vs)continue;
    vs.innerHTML=Object.entries(VENUES).map(([k,v])=>'<option value="'+k+'">'+v.name+(v.mine?' · YOURS':'')+'</option>').join('');vs.value=venueId;}}

  // ---- the catalogue the studio shows ----
  function keysOf(prefixes,exclude){const found=new Map();
    const add=m=>{const k=m&&m.userData&&m.userData.vxKey;if(!k||m.userData.vxLocked||(exclude&&exclude(k)))return;if(!prefixes.some(p=>k===p||k.startsWith(p)))return;
      if(!found.has(k))found.set(k,{key:k,label:m.userData.vxLabel||k,mats:new Set()});found.get(k).mats.add(m);};
    scene.traverse(o=>{if(o.material)for(const m of [].concat(o.material))add(m);});
    const P=window.VelvetPeople;if(P&&P.templates)for(const p of prefixes)if(p.startsWith('people.')){const t=P.templates[p.split('.')[1]];if(t)t.scene.traverse(o=>{if(o.material)for(const m of [].concat(o.material))add(m);});}
    return [...found.values()].sort((a,b)=>a.label.localeCompare(b.label));}
  function catalog(){
    const v=VENUES[venueId],P=window.VelvetPeople,G=[],people={player:[],referee:[],audience:[]};
    const opp=Array.isArray(window.VELVET_OPPONENTS)?window.VELVET_OPPONENTS:[];
    if(P&&P.templates)for(const [cid,t] of Object.entries(P.templates)){const e=t.entry||{},o=opp.find(x=>x.character===cid);
      (people[t.role]||people.audience).push({id:'people/'+cid,label:(o&&o.name)||e.label||e.name||cid.replace(/[_-]+/g,' '),sub:t.role,keys:['people.'+cid+'.'],export:true,
      info:'Everyone made from this character wears these pictures. SAVE PICTURE gives you the current picture to paint over, so your picture fits the model.'});}
    G.push({id:'people',label:'PEOPLE',items:[...people.player,...people.referee,...people.audience]});
    G.push({id:'table',label:'TABLE',items:[
      {id:'table',label:'Table',keys:['table.','repl.table.'],replace:true,export:true,info:'The table you play on. Your model changes only its look: the balls still roll on the official table, with the same pockets and cushions. Keep VX_TABLE where it is.'},
      {id:'nets',label:'Pocket nets',keys:['nets.','table.gold','repl.nets.'],replace:true,export:true,info:'The six pocket nets. The balls really roll inside them, and the net stretches round them like cloth (VX_CLOTH marks the mesh that does that).'},
      {id:'lamp',label:'Table lamp',keys:['lamp.','table.metal','repl.lamp.'],replace:true,export:true,info:'The lamp over the table. The table is lit the same whatever the lamp looks like.'}]});
    G.push({id:'balls',label:'BALLS & CUE',items:[
      {id:'balls',label:'Balls',keys:['balls.'],export:true,info:'The 22 balls. Give them new pictures, for example a logo on the cue ball.'},
      {id:'cue',label:'Cue',keys:['cue.'],export:true,info:'Shaft, splice, butt, ferrule, tip and bumper. Each player\'s own cue colours tint these.'}]});
    const vi=[{id:'venue',label:'Whole venue',keys:['venue.'+venueId+'.'],export:true,venue:true,info:'Everything in '+v.name+'. EXPORT .GLB takes it to Blender with markers for the table, the seats, the entrance, the trophy, the cameras and the screens. Bring it back with + VENUE.'},
      {id:'seat',label:'Seat model',keys:['venue.'+venueId+'.seats','repl.seat.'],replace:true,export:true,info:'The seat in every stand of every venue. Your seat model should sit on the floor at the origin, facing +Z (a VX_SEAT arrow in it sets where and which way).'}];
    if(stage.trophyAt)vi.push({id:'trophy',label:'Trophy',keys:['trophy.','repl.trophy.'],replace:true,export:true,info:'The championship trophy and its plinth. VX_TROPHY in your model marks the point that stands on the trophy\'s spot.'});
    let cams=false;arenaGroup.traverse(o=>{if(o.userData.vxObj==='tvcam')cams=true;});if(cams)vi.push({id:'tvcam',label:'TV cameras',keys:['tvcam.'],export:true,info:'The broadcast cameras round the stage.'});
    G.push({id:'venue',label:'VENUE · '+v.name,items:vi});
    G.push({id:'props',label:'PROPS',items:[{id:'props',label:'Players\' chairs and glasses',keys:['props.','table.dark-wood'],info:'The players\' chairs, the side table and the water glasses, in every venue.'}]});
    G.push({id:'custom',label:'YOUR OBJECTS',items:OD.custom.map(e=>({id:'obj/'+e.id,label:e.name||'Your object',sub:e.kind==='banner'?'banner':'model',keys:['obj.'+e.id+'.'],custom:e,export:true,hidden:!scopeOK(e),
      info:e.kind==='banner'?'A flat screen: give it an image or a video. Move it with the arrows in the view or the numbers below.':'Your model. Move it with the arrows in the view or the numbers below.'}))});
    return G;
  }
  function itemOf(id){for(const g of catalog())for(const it of g.items)if(it.id===id)return it;return null;}
  function boxOfItem(it){
    const bb=new T.Box3(),add=o=>{if(o.isMesh&&o.visible&&!o.userData.vxMarker){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();if(o.isInstancedMesh){if(!o.boundingBox)o.computeBoundingBox();bb.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));}else bb.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}};
    if(!it)return bb;scene.updateMatrixWorld(true);
    if(it.id==='venue')arenaGroup.traverse(add);
    else if(it.id.startsWith('people/')){if(studio.model)studio.model.obj.traverse(add);}
    else if(it.custom){const g=customObj(it.custom.id);if(g)g.traverse(add);}
    else if(it.id==='balls'){for(const [,e] of ballMeshes)add(e.mesh);}
    else if(it.id==='cue'){bb.setFromCenterAndSize(new T.Vector3(-1.3,CLOTH_Y+.3,0),new T.Vector3(1.6,.2,.2));}
    else if(it.id==='seat'){let done=false;arenaGroup.traverse(o=>{if(done||o.userData.vxObj!=='seat'||!o.count)return;done=true;const m=new T.Matrix4();o.getMatrixAt(0,m);
      const p=new T.Vector3().setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);bb.setFromCenterAndSize(p.add(new T.Vector3(0,.5,0)),new T.Vector3(1.6,1.6,1.6));});}
    else if(it.id==='props'){bb.setFromCenterAndSize(new T.Vector3(0,FLOOR_Y+.6,-(OUT_Z+1.1)),new T.Vector3(2.6,1.2,1));}
    else scene.traverse(o=>{for(let p=o;p;p=p.parent)if(p.userData.vxObj===it.id||p.userData.vxRepl===it.id){add(o);break;}});
    return bb;
  }

  // ---- the studio workspace ----
  function addStudioEntry(){
    const help=$('help-button');if(help&&!$('studio-button')){const b=document.createElement('button');b.className='icon-button studio-entry';b.id='studio-button';b.type='button';b.title='VELVET Studio: objects and textures';b.textContent='STUDIO';
      b.addEventListener('click',()=>enterStudio());help.parentNode.insertBefore(b,help);}
  }
  function enterStudio(){
    if(!OD)return;studio=studio||{on:false,sel:'table',undo:[],redo:[],touched:new Set(),dirty:false,open:{}};if(studio.on)return;studio.on=true;
    document.body.classList.add('studio-on');for(const id of ['welcome-screen','menu-screen','help-screen','end-screen','decision-screen','tournament-screen'])try{activeOverlay(id,false);}catch(e){}
    if(cine.on)endCine();
    studio.prevAuto=autoCamera;autoCamera=false;cam.mode=-1;cam.follow=false;cam.zoom=1;cam.fov=45;cam.el=.42;cam.az=-PI/2-.5;
    if(!studio.el)studioBuild();studio.el.hidden=false;fillVenueSelect();resize();
    if(location.hash!=='#studio')history.replaceState(null,'','#studio');
    studioSelect(studio.sel||'table');studioStatus(studio.dirty?'Unsaved changes':'');
  }
  function exitStudio(){
    if(!studio||!studio.on)return;studio.on=false;studioGizmo(null);studioModel(null);studio.el.hidden=true;document.body.classList.remove('studio-on');
    autoCamera=studio.prevAuto!==false;if(location.hash)history.replaceState(null,'',location.pathname+location.search);resize();
    if(!state.started)activeOverlay('welcome-screen',true);
  }
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function studioBuild(){
    const el=document.createElement('div');el.id='ostudio';el.innerHTML=
      '<header class="os-bar"><div class="os-brand"><span class="os-name">VELVET<i>.</i></span><span class="os-sub">STUDIO</span></div>'+
      '<nav class="os-ws"><a href="VELVET Studio.html" title="Players, referees and audience: faces, looks and profiles">CHARACTERS</a><a class="on">OBJECTS &amp; TEXTURES</a></nav>'+
      '<label class="os-venue">VENUE <select id="os-venue"></select></label>'+
      '<div class="os-mid"><button class="os-ghost" data-act="undo" title="Undo (Ctrl+Z)" disabled>↶</button><button class="os-ghost" data-act="redo" title="Redo (Ctrl+Y)" disabled>↷</button><span id="os-status"></span></div>'+
      '<div class="os-actions"><button class="os-ghost" data-act="markers" title="What the VX_ markers in exported .glb files mean">VX MARKERS ?</button><button class="os-ghost" data-act="import" title="Add a .velvetobjects pack">IMPORT</button><button class="os-ghost" data-act="export" title="Everything you made here as one file to share">EXPORT</button>'+
      '<span class="os-save"><button class="os-primary" data-act="save" title="Save into the game folder (Ctrl+S)">SAVE</button><button class="os-primary os-caret" data-act="savemenu">▾</button>'+
      '<span class="os-menu" id="os-savemenu" hidden><button data-act="folder">Choose the game folder…</button><button data-act="download">Download objects.js instead</button><button data-act="resetall" class="os-danger">Reset everything…</button></span></span>'+
      '<button class="os-play" data-act="play" title="Back to the game (your changes stay on)">▶ PLAY</button></div></header>'+
      '<aside class="os-tree"><input id="os-search" type="search" placeholder="Search objects and pictures" autocomplete="off"><div id="os-groups"></div>'+
      '<div class="os-add"><button class="os-primary" data-act="addmodel" title="Add your own .glb model">+ MODEL</button><button class="os-ghost" data-act="addbanner" title="A flat screen for an image or a video">+ BANNER</button><button class="os-ghost" data-act="addvenue" title="A whole venue made in Blender (.glb)">+ VENUE</button></div></aside>'+
      '<section class="os-insp" id="os-insp"></section>'+
      '<div class="os-hint">Drag to turn · right-drag to move · wheel to zoom · drop pictures, videos or .glb files anywhere</div>'+
      '<div class="os-toast" id="os-toast" hidden></div><div class="os-busy" id="os-busy" hidden><i></i><span>Working…</span></div><div class="os-modal" id="os-modal" hidden></div>'+
      '<input type="file" id="os-file-media" accept="image/*,video/*" hidden><input type="file" id="os-file-glb" accept=".glb,.gltf,model/gltf-binary" hidden><input type="file" id="os-file-pack" accept=".velvetobjects,.json" hidden>';
    document.body.appendChild(el);studio.el=el;
    el.addEventListener('click',studioClick);
    el.querySelector('#os-search').addEventListener('input',()=>studioRender());
    el.querySelector('#os-venue').addEventListener('change',e=>{setVenue(e.target.value);studioSelect('venue');});
    el.querySelector('#os-file-media').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f&&studio.pick)studio.pick(f);});
    el.querySelector('#os-file-glb').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f&&studio.pick)studio.pick(f);});
    el.querySelector('#os-file-pack').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{studioBusy('IMPORTING…');await importPack(f);studioToast('Pack added.');}catch(err){studioToast(err.message,true);}finally{studioBusy(false);}});
    el.addEventListener('input',studioInput);el.addEventListener('change',studioChange);
    // drop files: on a picture row it changes that picture; elsewhere a .glb becomes your object, a picture or video a banner
    window.addEventListener('dragover',e=>{if(studio.on){e.preventDefault();}});
    window.addEventListener('drop',async e=>{if(!studio.on)return;e.preventDefault();const f=e.dataTransfer&&e.dataTransfer.files[0];if(!f)return;
      const row=e.target.closest&&e.target.closest('[data-key]'),k=kindOf(f);
      if(row&&(k==='image'||k==='video'))return setPicture(row.dataset.key,f);
      if(k==='glb')return addModel(f);if(k==='image'||k==='video')return addBanner(f);studioToast('Drop an image, a video or a .glb file',true);});
    // the view: an overlay over the game's canvas takes the mouse (the game's own controls rest);
    // drag to turn, right-drag to move, wheel to zoom, click an object to pick it
    const view=document.createElement('div');view.className='os-view';el.prepend(view);studio.view=view;let drag=null;
    view.addEventListener('contextmenu',e=>e.preventDefault());
    view.addEventListener('pointerdown',e=>{if(studio.gizmo&&studio.gizmo.axis)return;drag={x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,b:e.button,shift:e.shiftKey};view.setPointerCapture(e.pointerId);});
    view.addEventListener('pointermove',e=>{if(!drag||studio.gizmoDrag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
      if(drag.b===2||drag.b===1||drag.shift){const d=distFor(cam.radius,cam.fov)*cam.zoom*.0016,sa=Math.sin(cam.az),ca=Math.cos(cam.az),se=Math.sin(cam.el);
        cam.target=[cam.target[0]-dx*ca*d-dy*sa*se*d,cam.target[1]+dy*Math.cos(cam.el)*d,cam.target[2]+dx*sa*d-dy*ca*se*d];}
      else{cam.az-=dx*.006;cam.el=clamp(cam.el+dy*.005,-.35,1.52);}});
    view.addEventListener('pointerup',e=>{const d=drag;drag=null;if(!d||studio.gizmoDrag)return;if(Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<5&&d.b===0)studioPick(e);});
    view.addEventListener('wheel',e=>{e.preventDefault();cam.radius=clamp(cam.radius*Math.exp(e.deltaY*.0011),.08,40);},{passive:false});
    window.addEventListener('keydown',e=>{if(!studio.on)return;const typing=/INPUT|SELECT|TEXTAREA/.test((e.target&&e.target.tagName)||'');
      if((e.ctrlKey||e.metaKey)&&!typing){const k=e.key.toLowerCase();if(k==='z'){e.preventDefault();studioUndo(e.shiftKey?1:-1);}else if(k==='y'){e.preventDefault();studioUndo(1);}else if(k==='s'){e.preventDefault();saveObjects();}}
      else if(e.key==='Escape'&&studio.gizmo)studioGizmo(null);
      if(!typing||e.key==='Escape')e.stopImmediatePropagation();},true);
    window.addEventListener('beforeunload',e=>{if(studio.on&&studio.dirty){e.preventDefault();e.returnValue='';}});
  }
  function studioStatus(t){const s=studio.el&&studio.el.querySelector('#os-status');if(s)s.textContent=t||'';}
  function studioToast(t,bad){const s=studio&&studio.el&&studio.el.querySelector('#os-toast');if(!s)return;s.textContent=t;s.classList.toggle('bad',!!bad);s.hidden=false;clearTimeout(studio.toastT);studio.toastT=setTimeout(()=>{s.hidden=true;},bad?6000:3200);}
  function studioBusy(t){const b=studio&&studio.el&&studio.el.querySelector('#os-busy');if(!b)return;b.hidden=!t;if(t)b.querySelector('span').textContent=t;}
  function studioModal(html,buttons){const m=studio.el.querySelector('#os-modal');m.innerHTML='<div class="os-card">'+html+'<div class="os-btns">'+(buttons||'<button class="os-primary" data-act="closemodal">OK</button>')+'</div></div>';m.hidden=false;}
  function snapshot(){return JSON.stringify(Object.assign({},OD,{media:Object.fromEntries(Object.entries(OD.media).map(([k,v])=>[k,Object.assign({},v,{b64:undefined})]))}));}
  function studioChanged(before){if(before!==undefined){studio.undo.push(before);if(studio.undo.length>80)studio.undo.shift();studio.redo.length=0;}
    for(const k of Object.keys(OD.textures))studio.touched.add(k);studio.dirty=true;studioStatus('Unsaved changes');studioRender();}
  async function studioUndo(dir){const from=dir<0?studio.undo:studio.redo,to=dir<0?studio.redo:studio.undo;if(!from.length)return;
    to.push(snapshot());const d=JSON.parse(from.pop()),media=OD.media;const venuesBefore=OD.venues.map(v=>v.id).join();
    OD=Object.assign(odEmpty(),d);OD.media=Object.assign({},d.media,media);
    if(OD.venues.map(v=>v.id).join()!==venuesBefore){for(const k of Object.keys(VENUES))if(VENUES[k].mine)delete VENUES[k];for(const v of OD.venues)VENUES[v.id]=glbVenueEntry(v);if(!VENUES[venueId])setVenue('velvet');fillVenueSelect();}
    studioBusy('…');try{await applyAll();}finally{studioBusy(false);}studio.dirty=true;studioStatus('Unsaved changes');studioRender();}
  function studioSelect(id){
    studio.sel=id;const it=itemOf(id);if(!it){studio.sel='table';return studioRender();}
    studioModel(it.id.startsWith('people/')?it.id.slice(7):null);
    studioGizmo(it.custom?customObj(it.custom.id):null);
    if(!studio.keepCam)studioFocus(it);studio.keepCam=false;studioRender();
  }
  function studioFocus(it){
    if(it.id.startsWith('people/')&&studio.model){const o=studio.model.obj.position;cam.target=[o.x,FLOOR_Y+.95,o.z];cam.radius=2.6;cam.el=.08;cam.az=PI/2+.35;return;}
    const bb=boxOfItem(it);if(bb.isEmpty())return;const c=bb.getCenter(new T.Vector3()),s=bb.getSize(new T.Vector3());
    cam.target=[c.x,c.y,c.z];cam.radius=clamp(Math.max(s.x,s.y*1.4,s.z)*1.05+.15,it.custom?2.6:.25,40);cam.el=clamp(cam.el,.12,1.2);if(it.id==='venue'){cam.el=.42;cam.radius=Math.max(cam.radius*.55,6);}}
  // a stand-in of the character you picked, in front of the table
  function studioModel(cid){
    if(studio.model){scene.remove(studio.model.obj);freePerson(studio.model);studio.model=null;}
    const P=window.VelvetPeople;if(!cid||!P||!P.templates[cid])return;
    const p=P.spawn(cid);p.obj.position.set(-OUT_X-1.1,FLOOR_Y,-.8);p.obj.rotation.y=PI/2+.35;   // facing the table, beside the baulk end
    try{p.play('idle',{weight:1});}catch(e){}p.obj.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});scene.add(p.obj);studio.model=p;
    studio.modelT=time;
  }
  const _osRay=new T.Raycaster(),_osNdc=new T.Vector2();
  function itemForObject(o){
    for(let p=o;p;p=p.parent){const u=p.userData;if(u.vxCustom)return 'obj/'+u.vxCustom;if(u.vxRepl)return u.vxRepl;if(u.vxObj&&u.vxObj!=='seat')return u.vxObj;if(u.vxObj==='seat')return 'seat';}
    const m=[].concat(o.material)[0],k=m&&m.userData.vxKey||'';
    if(k.startsWith('people.'))return 'people/'+k.split('.')[1];if(k.startsWith('venue.'))return 'venue';if(k.startsWith('balls.'))return 'balls';if(k.startsWith('cue.'))return 'cue';
    if(k.startsWith('props.'))return 'props';if(k.startsWith('trophy.'))return 'trophy';if(k.startsWith('tvcam.'))return 'tvcam';if(k.startsWith('nets.'))return 'nets';if(k.startsWith('lamp.'))return 'lamp';if(k.startsWith('table.'))return 'table';
    for(let p=o;p;p=p.parent)if(p===arenaGroup)return 'venue';return null;}
  function studioPick(e){
    const r=canvas.getBoundingClientRect();_osNdc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);_osRay.setFromCamera(_osNdc,camera);
    const hits=_osRay.intersectObjects(scene.children,true).filter(h=>{for(let p=h.object;p;p=p.parent)if(!p.visible)return false;return !h.object.userData.vxMarker&&!(h.object.isLine||h.object.isPoints)&&!(studio.gizmo&&isGizmoPart(h.object));});
    for(const h of hits){const id=itemForObject(h.object);if(id&&itemOf(id)){if(id!==studio.sel){studio.keepCam=true;studioSelect(id);}return;}
      if(h.object.isSkinnedMesh){for(let p=h.object;p;p=p.parent){const t=crowd.find(c=>c.p.obj===p);if(t&&t.p.tpl){studioSelect('people/'+t.p.tpl.name);return;}}}}
  }
  function isGizmoPart(o){const hp=studio.gizmo.getHelper();for(let p=o;p;p=p.parent)if(p===hp)return true;return false;}
  function studioTick(dt){if(studio&&studio.on&&studio.model)studio.model.mixer.update(dt);}
  // move your objects with arrows in the view (W move · E turn · R size)
  function studioGizmo(obj){
    if(!studio.gizmo&&obj){const tc=new T.TransformControls(camera,studio.view);tc.setSize(.85);tc.addEventListener('dragging-changed',e=>{studio.gizmoDrag=e.value;if(!e.value)gizmoDone();else studio.gizmoBefore=snapshot();});
      tc.addEventListener('objectChange',()=>gizmoMoved());scene.add(tc.getHelper());studio.gizmo=tc;}
    if(!studio.gizmo)return;if(obj){studio.gizmo.attach(obj);studio.gizmo.getHelper().visible=true;}else{studio.gizmo.detach();studio.gizmo.getHelper().visible=false;}
  }
  function gizmoMoved(){const g=studio.gizmo&&studio.gizmo.object,e=g&&OD.custom.find(x=>x.id===g.userData.vxCustom);if(!e)return;
    g.rotation.x=g.rotation.z=0;const s=(g.scale.x+g.scale.y+g.scale.z)/3;g.scale.setScalar(clamp(s,.02,50));
    e.pos=[+g.position.x.toFixed(3),+g.position.y.toFixed(3),+g.position.z.toFixed(3)];e.turn=+(g.rotation.y*180/PI).toFixed(1);e.size=+g.scale.x.toFixed(3);studioFields(e);}
  function gizmoDone(){if(studio.gizmoBefore!==undefined){studioChanged(studio.gizmoBefore);studio.gizmoBefore=undefined;}}
  function studioFields(e){const f=studio.el.querySelector('#os-insp');if(!f)return;for(const [k,v] of [['x',e.pos[0]],['y',e.pos[1]-FLOOR_Y],['z',e.pos[2]],['turn',e.turn||0],['size',(e.size||1)*100]]){const i=f.querySelector('[data-f="'+k+'"]');if(i&&document.activeElement!==i)i.value=+(+v).toFixed(k==='size'||k==='turn'?0:2);}}

  // ---- the lists ----
  function thumbOf(m){
    const t=m&&m.map;if(!t||t.isRenderTargetTexture)return {txt:t?'LIVE':'',col:m&&m.color?'#'+m.color.getHexString():'#222'};
    const im=t.image;if(t.isVideoTexture)return {txt:'VIDEO',col:'#111'};
    if(!im||!(im.width||im.videoWidth))return {txt:'',col:m.color?'#'+m.color.getHexString():'#222'};
    t.userData.vxThumb=t.userData.vxThumb||(()=>{try{const c=document.createElement('canvas');c.width=84;c.height=48;c.getContext('2d').drawImage(im,0,0,84,48);return c.toDataURL('image/jpeg',.7);}catch(e){return '';}})();
    return {img:t.userData.vxThumb,col:m.color?'#'+m.color.getHexString():'#222'};
  }
  function studioRender(){
    if(!studio||!studio.el)return;const q=(studio.el.querySelector('#os-search').value||'').toLowerCase().trim(),groups=catalog();
    const u=studio.el.querySelector('[data-act="undo"]'),r=studio.el.querySelector('[data-act="redo"]');u.disabled=!studio.undo.length;r.disabled=!studio.redo.length;
    let h='';for(const g of groups){const items=g.items.filter(it=>!q||(it.label+' '+(it.sub||'')).toLowerCase().includes(q)||keysOf(it.keys).some(s=>s.label.toLowerCase().includes(q)));
      if(!items.length&&g.id!=='custom')continue;const closed=studio.open[g.id]===false&&!q;
      h+='<div class="os-group'+(closed?' closed':'')+'"><button class="os-gh" data-act="group" data-g="'+g.id+'">'+esc(g.label)+'<span>'+items.length+'</span></button><div class="os-items">';
      for(const it of items){const own=keysOf(it.keys).some(s=>OD.textures[s.key])||(OD.replace[it.id]);
        h+='<button class="os-item'+(it.id===studio.sel?' on':'')+(it.hidden?' dim':'')+'" data-act="sel" data-id="'+esc(it.id)+'"><b>'+esc(it.label)+'</b>'+(it.sub?'<small>'+esc(it.sub)+'</small>':'')+(own?'<i title="Changed">●</i>':'')+'</button>';}
      if(g.id==='custom'&&!items.length)h+='<p class="os-empty">Add your own models (.glb) and banners with the buttons below, or drop files on the view.</p>';
      h+='</div></div>';}
    studio.el.querySelector('#os-groups').innerHTML=h;studioInspector();
  }
  function studioInspector(){
    const box=studio.el.querySelector('#os-insp'),it=itemOf(studio.sel);if(!it){box.innerHTML='';return;}
    const slots=keysOf(it.keys),e=it.custom;let h='<div class="os-ih"><h2>'+esc(it.label)+'</h2><p>'+esc(it.info||'')+'</p></div><div class="os-row os-btnrow">';
    if(it.export)h+='<button class="os-ghost" data-act="exportglb" title="For Blender: with VX_ markers">⤓ EXPORT .GLB</button>';
    if(it.replace)h+='<button class="os-ghost" data-act="replace" title="Use your own .glb for this">⇪ YOUR MODEL</button>'+(OD.replace[it.id]?'<button class="os-ghost" data-act="unreplace">↺ ORIGINAL MODEL</button>':'');
    if(it.venue&&VENUES[venueId].mine)h+='<button class="os-ghost os-danger" data-act="delvenue">DELETE THIS VENUE</button>';
    if(e)h+='<button class="os-ghost os-danger" data-act="delobj">DELETE</button>';
    h+='</div>';
    if(OD.replace[it.id]){const m=OD.media[OD.replace[it.id]];h+='<p class="os-note">Using your model <b>'+esc(m?m.name:'')+'</b>.</p>';}
    if(e){const p=e.pos||[0,FLOOR_Y,0];
      h+='<div class="os-sec">PLACE</div><div class="os-grid5">'+[['x','X',p[0],.05],['y','UP',p[1]-FLOOR_Y,.05],['z','Z',p[2],.05],['turn','TURN°',e.turn||0,5],['size','SIZE %',(e.size||1)*100,5]].map(([k,l,v,st])=>'<label>'+l+'<input type="number" data-f="'+k+'" step="'+st+'" value="'+(+(+v).toFixed(2))+'"></label>').join('')+'</div>'+
        '<div class="os-row"><label class="os-wide">NAME <input type="text" data-f="name" value="'+esc(e.name||'')+'"></label><label>IN <select data-f="scope"><option value="all">every venue</option><option value="'+esc(venueId)+'"'+(e.scope===venueId?' selected':'')+'>this venue only</option></select></label></div>';
      if(e.kind==='banner')h+='<div class="os-row"><label>WIDTH m<input type="number" data-f="w" step=".1" value="'+(e.w||2.4)+'"></label><label>HEIGHT m<input type="number" data-f="h" step=".1" value="'+(e.h||1.35)+'"></label><label>LIFT m<input type="number" data-f="lift" step=".1" value="'+(e.lift||0)+'"></label><label class="os-chk"><input type="checkbox" data-f="twoSided"'+(e.twoSided?' checked':'')+'> BOTH SIDES</label></div>';
      h+='<p class="os-note">In the view: drag the arrows to move · <button class="os-link" data-act="gmode" data-m="rotate">turn</button> · <button class="os-link" data-act="gmode" data-m="scale">size</button> · <button class="os-link" data-act="gmode" data-m="translate">move</button></p>';}
    if(it.id==='venue'){const mk=VENUES[venueId].glb&&glbReady[VENUES[venueId].glb];
      if(mk){const c={};for(const k of mk.markers)c[k.role+(k.sub?'_'+k.sub:'')]=(c[k.role+(k.sub?'_'+k.sub:'')]||0)+1;
        h+='<div class="os-sec">MARKERS IN YOUR MODEL</div><p class="os-note">'+(Object.keys(c).length?Object.entries(c).map(([k,n])=>'VX_'+esc(k)+(n>1?' ×'+n:'')).join(' · '):'none: add VX_SEAT, VX_ENTRANCE and VX_TABLE in Blender')+'</p>';}}
    h+='<div class="os-sec">PICTURES <span>'+slots.length+'</span></div>';
    if(!slots.length)h+='<p class="os-note">'+(it.id.startsWith('people/')?'Loading this character…':'Nothing to dress here yet.')+'</p>';
    for(const s of slots){const o=OD.textures[s.key]||{},m=[...s.mats][0],th=thumbOf(m),med=o.map&&OD.media[o.map];
      h+='<div class="os-slot'+(OD.textures[s.key]?' own':'')+'" data-key="'+esc(s.key)+'"><div class="os-th" style="background:'+th.col+'">'+(th.img?'<img src="'+th.img+'" alt="">':'<span>'+th.txt+'</span>')+'</div>'+
        '<div class="os-sm"><b>'+esc(s.label)+'</b><small>'+(med?(med.kind==='video'?'▶ ':'')+esc(med.name):(m&&m.map?'original picture':'colour only'))+(s.mats.size>1?' · '+s.mats.size+' parts':'')+'</small>'+
        '<div class="os-sbtn"><button data-act="pic" title="An image or a video (drop one here too)">IMAGE / VIDEO</button>'+(m&&m.map&&!m.map.isRenderTargetTexture&&!m.map.isVideoTexture?'<button data-act="savepic" title="The current picture as a PNG, to paint over">SAVE PICTURE</button>':'')+(OD.textures[s.key]?'<button data-act="resetslot" title="Back to how it was">↺</button>':'')+'</div>'+
        '<div class="os-sliders"><label title="Tint">TINT<input type="color" data-t="tint" value="'+(o.tint||(m&&m.color?'#'+(m.color.clone().multiplyScalar(1/Math.max(1,m.color.r,m.color.g,m.color.b))).getHexString():'#ffffff'))+'"></label>'+
        '<label title="Repeat the picture">TILE<input type="range" data-t="tile" min="-2" max="3" step=".05" value="'+Math.log2(o.tile||1)+'"></label><label title="Make it light up">GLOW<input type="range" data-t="glow" min="0" max="3" step=".05" value="'+(o.glow||0)+'"></label></div></div></div>';}
    box.innerHTML=h;
  }
  function slotOf(el){const s=el.closest('[data-key]');return s?s.dataset.key:null;}
  function pickFile(which,cb){studio.pick=cb;studio.el.querySelector(which).click();}
  async function setPicture(key,file){
    const k=kindOf(file);if(k!=='image'&&k!=='video')return studioToast('Use an image (PNG, JPG, WebP…) or a video (MP4, WebM)',true);
    if(file.size>150e6)return studioToast('That file is very big ('+Math.round(file.size/1e6)+' MB). Keep videos under about 150 MB.',true);
    const before=snapshot();studioBusy('LOADING…');
    try{const id=await mediaAdd(file,k);OD.textures[key]=Object.assign({},OD.textures[key],{map:id});await applyTex(key);studioChanged(before);studioToast((k==='video'?'Video':'Picture')+' on '+(keysOf([key])[0]||{label:key}).label+'.');}
    catch(e){studioToast(e.message,true);}finally{studioBusy(false);}
  }
  async function addModel(file){
    if(kindOf(file)!=='glb')return studioToast('Choose a .glb model',true);const before=snapshot();studioBusy('ADDING…');
    try{const id=await mediaAdd(file,'glb'),info=await gltfOf(id),s=info.box.getSize(new T.Vector3());
      const e={id:'o'+Date.now().toString(36),kind:'model',name:file.name.replace(/\.(glb|gltf)$/i,''),media:id,scope:'all',pos:[+(cam.target[0]).toFixed(2),FLOOR_Y,+(cam.target[2]).toFixed(2)],turn:0,size:s.length()>60?+(3/s.length()).toFixed(4):1};
      OD.custom.push(e);await buildCustom(e);studioChanged(before);studio.open.custom=true;studioSelect('obj/'+e.id);
      studioToast('Added '+e.name+(info.markers.length?' · '+info.markers.length+' markers':'')+'.');}
    catch(e){studioToast(e.message,true);}finally{studioBusy(false);}
  }
  async function addBanner(file){
    const before=snapshot();studioBusy('ADDING…');
    try{const e={id:'b'+Date.now().toString(36),kind:'banner',name:'Banner '+(OD.custom.filter(x=>x.kind==='banner').length+1),scope:'all',pos:[+(OUT_X+1.6).toFixed(2),FLOOR_Y,0],turn:-90,size:1,w:2.4,h:1.35,lift:.2,twoSided:false};
      if(file){const k=kindOf(file);if(k!=='image'&&k!=='video')throw new Error('A banner needs an image or a video');const id=await mediaAdd(file,k);OD.textures['obj.'+e.id+'.screen']={map:id};e.name=file.name.replace(/\.[a-z0-9]+$/i,'');}
      OD.custom.push(e);await buildCustom(e);studioChanged(before);studio.open.custom=true;studioSelect('obj/'+e.id);}
    catch(e){studioToast(e.message,true);}finally{studioBusy(false);}
  }
  async function addVenue(file){
    if(kindOf(file)!=='glb')return studioToast('Choose a venue .glb',true);const before=snapshot();studioBusy('READING THE VENUE…');
    try{const id=await mediaAdd(file,'glb'),info=await gltfOf(id),al=alignOf(info),bb=info.box.clone().applyMatrix4(al);
      const name=(file.name.replace(/\.(glb|gltf)$/i,'').replace(/^VELVET-venue-/i,'').replace(/[-_]+/g,' ').trim()||'Your venue').toUpperCase();
      const e={id:'glb-'+slugOf(name)+'-'+Date.now().toString(36).slice(-4),name,event:name+' OPEN',media:id,seats:info.markers.filter(k=>k.role==='SEAT').length,
        walls:[Math.min(-6,Math.round(bb.min.x)),Math.max(6,Math.round(bb.max.x)),Math.max(6,Math.round(Math.max(-bb.min.z,bb.max.z)))]};
      OD.venues.push(e);VENUES[e.id]=glbVenueEntry(e);fillVenueSelect();setVenue(e.id);studioChanged(before);studioSelect('venue');
      const miss=['TABLE','SEAT','ENTRANCE'].filter(r=>!info.markers.some(k=>k.role===r));
      studioToast('Added the venue '+name+' ('+e.seats+' seats).'+(miss.length?' Missing: '+miss.map(r=>'VX_'+r).join(', ')+'.':''),!!miss.length);}
    catch(e){studioToast(e.message,true);}finally{studioBusy(false);}
  }
  async function studioClick(ev){
    const b=ev.target.closest('button,a[data-act]');if(!b||!b.dataset.act)return;const act=b.dataset.act,key=slotOf(b),it=itemOf(studio.sel);
    if(act!=='savemenu')studio.el.querySelector('#os-savemenu').hidden=true;
    try{
      if(act==='sel')studioSelect(b.dataset.id);
      else if(act==='group'){studio.open[b.dataset.g]=studio.open[b.dataset.g]===false;studioRender();}
      else if(act==='pic')pickFile('#os-file-media',f=>setPicture(key,f));
      else if(act==='resetslot'){const before=snapshot();delete OD.textures[key];await applyTex(key);studioChanged(before);}
      else if(act==='savepic'){const m=matsByKey(key)[0],im=m&&m.map&&m.map.image;if(!im)return;const c=document.createElement('canvas');c.width=im.width||im.videoWidth;c.height=im.height||im.videoHeight;c.getContext('2d').drawImage(im,0,0);c.toBlob(bl=>saveBlob(slugOf(key)+'.png',bl),'image/png');}
      else if(act==='exportglb'){studioBusy('EXPORTING…');try{await exportItem(it.id);studioToast('Exported. Open it in Blender: File › Import › glTF 2.0.');}finally{studioBusy(false);}}
      else if(act==='replace')pickFile('#os-file-glb',async f=>{if(kindOf(f)!=='glb')return studioToast('Choose a .glb model',true);const before=snapshot();studioBusy('LOADING…');
        try{const id=await mediaAdd(f,'glb');await gltfOf(id);OD.replace[it.id]=id;await applyReplace(it.id);studioChanged(before);studioToast('Your model is in. ↺ ORIGINAL MODEL undoes it.');}catch(e){studioToast(e.message,true);}finally{studioBusy(false);}});
      else if(act==='unreplace'){const before=snapshot();delete OD.replace[it.id];await applyReplace(it.id);studioChanged(before);}
      else if(act==='delobj'){const before=snapshot(),e=it.custom;OD.custom=OD.custom.filter(x=>x.id!==e.id);for(const k of Object.keys(OD.textures))if(k.startsWith('obj.'+e.id+'.'))delete OD.textures[k];
        const g=customObj(e.id);studioGizmo(null);if(g){clothForget(g);g.removeFromParent();}studio.sel='table';studioChanged(before);studioSelect('table');}
      else if(act==='delvenue'){const before=snapshot(),id=venueId;OD.venues=OD.venues.filter(v=>v.id!==id);delete VENUES[id];setVenue('velvet');fillVenueSelect();studioChanged(before);studioSelect('venue');}
      else if(act==='gmode'){if(studio.gizmo)studio.gizmo.setMode(b.dataset.m);}
      else if(act==='addmodel')pickFile('#os-file-glb',addModel);
      else if(act==='addbanner')addBanner(null);
      else if(act==='addvenue')pickFile('#os-file-glb',addVenue);
      else if(act==='undo')studioUndo(-1);else if(act==='redo')studioUndo(1);
      else if(act==='save')saveObjects();else if(act==='folder')saveObjects('folder');else if(act==='download')saveObjects('download');
      else if(act==='savemenu'){const m=studio.el.querySelector('#os-savemenu');m.hidden=!m.hidden;}
      else if(act==='resetall')studioModal('<h2>Reset everything?</h2><p>All your pictures, models, banners and venues made here go. Your saved file changes only when you press SAVE.</p>','<button class="os-ghost" data-act="closemodal">KEEP THEM</button><button class="os-primary os-danger" data-act="doreset">RESET</button>');
      else if(act==='doreset'){const before=snapshot();for(const v of OD.venues)delete VENUES[v.id];OD=Object.assign(odEmpty(),{media:OD.media});if(!VENUES[venueId])setVenue('velvet');fillVenueSelect();studio.el.querySelector('#os-modal').hidden=true;await applyAll();studioChanged(before);}
      else if(act==='closemodal')studio.el.querySelector('#os-modal').hidden=true;
      else if(act==='markers')studioModal('<h2>Markers in your .glb files</h2><p>Exported models carry small orange arrows and see-through blue boxes named <b>VX_…</b>. In the game they are invisible: they tell the game where things are and what they do.</p><ul class="os-mk">'+
        '<li><b>VX_TABLE</b> box: where the game\'s table stands. Keep it with your model: the game lines your model up by it.</li>'+
        '<li><b>VX_SEAT</b> arrow: a spectator sits here, looking the way the arrow points. Copy it (Shift+D in Blender) to add seats.</li>'+
        '<li><b>VX_ENTRANCE</b> arrow: where the players walk on.</li><li><b>VX_TROPHY</b>, <b>VX_TVCAM</b>: the trophy\'s spot (the TV director films it) and the TV cameras.</li>'+
        '<li><b>VX_SCREEN_LIVE</b> on a flat mesh: it shows the live picture and the score.</li><li><b>VX_CLOTH</b> on a mesh: it behaves like cloth and stretches round the balls (the nets).</li>'+
        '<li><b>VX_POCKET_…</b>, <b>VX_CUE_TIP</b>: where the official pockets and the cue tip are, for lining things up. They never move the physics.</li>'+
        '<li><b>VX_LIGHT</b>: a light (its colour and intensity are custom properties).</li><li><b>VX_KEEP_CLEAR</b> box: players and the referee walk here, so keep it empty.</li></ul>'+
        '<p class="os-note">In Blender: File › Import › glTF 2.0, edit, then File › Export › glTF 2.0 (.glb) with +Y Up. One unit is one metre. Bring it back with YOUR MODEL, + MODEL or + VENUE.</p>');
      else if(act==='import')studio.el.querySelector('#os-file-pack').click();
      else if(act==='export')exportPack();
      else if(act==='play')exitStudio();
    }catch(e){studioToast((e&&e.message)||String(e),true);}
  }
  // sliders and fields: live while you drag, one undo step when you let go
  function studioInput(ev){const t=ev.target,key=slotOf(t);
    if(key&&t.dataset.t){if(studio.slideBefore===undefined)studio.slideBefore=snapshot();const o=OD.textures[key]=Object.assign({},OD.textures[key]);
      if(t.dataset.t==='tint')o.tint=t.value;else if(t.dataset.t==='tile')o.tile=+Math.pow(2,+t.value).toFixed(3);else o.glow=+t.value;applyTex(key);}
    else if(t.dataset.f){const it=itemOf(studio.sel),e=it&&it.custom;if(!e)return;if(studio.slideBefore===undefined)studio.slideBefore=snapshot();customField(e,t);}}
  function studioChange(ev){const t=ev.target;if(!(t.dataset.t||t.dataset.f))return;if(t.dataset.f){const it=itemOf(studio.sel);if(it&&it.custom)customField(it.custom,t,true);}
    if(studio.slideBefore!==undefined){studioChanged(studio.slideBefore);studio.slideBefore=undefined;}}
  function customField(e,t,final){const f=t.dataset.f,v=t.type==='checkbox'?t.checked:t.value,g=customObj(e.id);
    if(f==='name'){e.name=String(v).slice(0,60);if(final)studioRender();return;}
    if(f==='scope'){e.scope=v;if(g)g.visible=scopeOK(e);return;}
    if(f==='x')e.pos[0]=+v;else if(f==='y')e.pos[1]=FLOOR_Y+(+v);else if(f==='z')e.pos[2]=+v;else if(f==='turn')e.turn=+v;else if(f==='size')e.size=Math.max(.01,+v/100);
    else if(['w','h','lift','twoSided'].includes(f)){e[f]=f==='twoSided'?!!v:Math.max(f==='lift'?-20:.05,+v);if(final&&g){studioGizmo(null);clothForget(g);g.removeFromParent();buildCustom(e).then(n=>{studioGizmo(n);});}return;}
    if(g)placeCustom(e,g);}
