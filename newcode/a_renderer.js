  const canvas = $('world');
  const T = window.THREE;
  function fatal(title, body){$('fatal').hidden=false;$('fatal').innerHTML='<h2>'+title+'</h2><p>'+body+'</p>';}
  if(!T){fatal('3D engine missing','The file js/three.bundle.js could not be loaded. Keep the js folder next to index.html, or open the single-file version of the game.');return;}
  let renderer;
  try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}
  catch(e){fatal('WebGL 2 is required','Use a recent Chrome, Edge or Firefox browser with hardware acceleration enabled. The game does not require internet access.');return;}
