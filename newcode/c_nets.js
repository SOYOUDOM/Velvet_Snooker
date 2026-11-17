  // Pocket nets drawn as dark woven strings that move with the simulation.
  const netEdges=[];
  for(const bag of netBags)for(let j=0;j<NET_ROWS;j++)for(let i=0;i<NET_SIDES;i++){
    const k=j*NET_SIDES+i;netEdges.push([bag,k,j*NET_SIDES+(i+1)%NET_SIDES]);
    if(j<NET_ROWS-1){netEdges.push([bag,k,k+NET_SIDES]);netEdges.push([bag,k,(j+1)*NET_SIDES+(i+1)%NET_SIDES]);}
  }
  const netPositions=new Float32Array(netEdges.length*6);
  const netGeo=new T.BufferGeometry();netGeo.setAttribute('position',new T.BufferAttribute(netPositions,3));
  const netLines=new T.LineSegments(netGeo,new T.LineBasicMaterial({color:0x2b241d,transparent:true,opacity:.85}));
  netLines.frustumCulled=false;scene.add(netLines);
  function syncNets(){
    let o=0;
    for(const [bag,a,b] of netEdges){const A=bag.nodes[a],B=bag.nodes[b];
      netPositions[o++]=A.x;netPositions[o++]=A.y;netPositions[o++]=A.z;netPositions[o++]=B.x;netPositions[o++]=B.y;netPositions[o++]=B.z;}
    netGeo.attributes.position.needsUpdate=true;
  }
