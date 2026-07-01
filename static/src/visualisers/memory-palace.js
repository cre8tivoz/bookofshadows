export function createMemoryPalaceVisualiser({
  $,
  $$,
  api,
  esc,
  openMemoryDetail,
  loadThreeModule,
  cssHexToInt,
  constellationColors,
  prefersReducedMotion,
  isCancelledRequest,
  isActive,
}) {
  const palaceKeys = {};
  let memoryPalace = {
    data:null, renderer:null, scene:null, camera:null, group:null, nodes:[], labels:[], frame:0,
    yaw:0, pitch:-.05, pos:null, velocity:null, raycaster:null, mouse:null, avatar:null, drone:null,
    beacon:null, beaconNode:null, joystick:{x:0,y:0}, lastT:0, pointer:null,
    cullTick:0, lastObjectCount:0, streamedChunks:null, streamTick:0, colors:null, paused:false
  };
  function palaceInspectorDefault(){
    $('#palaceInspector').innerHTML = `<div class="inspector-kicker">Mnemosyne Labyrinth</div><h3>The Archive Gate</h3><p class="muted">Move between artifact rooms, scan relics on pedestals, and use search to summon a golden thread.</p><div class="trust-strip"><span class="trust-chip">WASD / joystick</span><span class="trust-chip">Drag to look</span><span class="trust-chip">Tap relic</span></div>`;
  }
  function clearPalaceScene(){
    if(memoryPalace.frame) cancelAnimationFrame(memoryPalace.frame);
    memoryPalace.frame = 0;
    if(memoryPalace.renderer){ memoryPalace.renderer.dispose(); memoryPalace.renderer.domElement.remove(); }
    $('#palaceLabels').innerHTML = '';
    Object.assign(memoryPalace, { renderer:null, scene:null, camera:null, group:null, nodes:[], labels:[], avatar:null, drone:null, beacon:null, beaconNode:null, lastT:0 });
  }
  function resetMemoryPalaceDiver(){
    if(!memoryPalace.THREE) return;
    memoryPalace.pos = new memoryPalace.THREE.Vector3(0, 118, 940);
    memoryPalace.velocity = new memoryPalace.THREE.Vector3();
    memoryPalace.yaw = 0; memoryPalace.pitch = -.24;
    $('#palaceHudStatus').textContent = 'drifting at palace gate';
  }
  function palaceCreateHammyDrone(THREE){
    const drone = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(5.5, 18, 12), new THREE.MeshStandardMaterial({ color:0xffd1a1, emissive:0x3a1908, roughness:.42 }));
    const glow = new THREE.PointLight(0xffb86b, .9, 120); glow.position.set(0, 0, 0);
    drone.add(body, glow);
    return drone;
  }
  function inspectPalaceNode(node){
    const scanLabel = node.scanLabel || (node.kind === 'memory' ? 'Memory book' : 'Entity obelisk');
    $('#palaceInspector').innerHTML = `<div class="inspector-kicker">${esc(scanLabel)} · ${esc(node.room || node.category || 'Artifact room')}</div><h3>${esc(node.label || 'Memory artifact')}</h3><p class="muted">${Number(node.count || 0).toLocaleString()} signal(s) · weight ${Number(node.weight || node._weight || 0).toFixed(2)}</p>${node.preview ? `<p>${esc(node.preview)}</p>` : ''}<div class="inspector-actions">${node.memory_id ? '<button id="palaceOpenMemory" class="primary tiny">Open memory</button>' : ''}<button id="palaceBeaconHere" class="tiny">Beacon here</button></div>`;
    if(node.memory_id) $('#palaceOpenMemory').onclick = () => openMemoryDetail(node.memory_id);
    $('#palaceBeaconHere').onclick = () => palaceSetBeacon(node);
  }
  function palaceSetBeacon(node){
    if(!node || !memoryPalace.THREE || !memoryPalace.scene) return;
    if(memoryPalace.beacon) memoryPalace.beacon.removeFromParent();
    const THREE = memoryPalace.THREE;
    const beacon = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(24, 1.2, 8, 48), new THREE.MeshBasicMaterial({ color:0xffe08a, transparent:true, opacity:.82 }));
    const light = new THREE.PointLight(0xffe08a, 1.8, 220); light.position.y = 22;
    beacon.add(ring, light); beacon.position.set(node.x, node.y + 28, node.z);
    memoryPalace.scene.add(beacon); memoryPalace.beacon = beacon; memoryPalace.beaconNode = node;
    $('#palaceHudStatus').textContent = `beacon: ${String(node.label || '').slice(0,34)}`;
  }
  function palaceSearchBeacon(){
    const q = $('#palaceSearchQuery').value.trim().toLowerCase();
    if(!q){ $('#palaceHudStatus').textContent = 'type a search to place beacon'; return; }
    const node = memoryPalace.nodes.find(n => [n.label,n.category,n.preview].some(v => String(v || '').toLowerCase().includes(q)));
    if(node){ palaceSetBeacon(node); inspectPalaceNode(node); }
    else $('#palaceHudStatus').textContent = `no artifact found for “${q.slice(0,32)}”`;
  }
  function palaceForwardRight(){
    const THREE = memoryPalace.THREE;
    return { forward:new THREE.Vector3(Math.sin(memoryPalace.yaw), 0, -Math.cos(memoryPalace.yaw)), right:new THREE.Vector3(Math.cos(memoryPalace.yaw), 0, Math.sin(memoryPalace.yaw)) };
  }
  function palaceClampFpsPosition(){
    if(!memoryPalace.pos) return;
    const z = memoryPalace.pos.z;
    let xLimit = 900;
    // Keep the entry path/corridor playable: walking straight should not drift into unbuilt black void.
    if(z > -260) xLimit = 185;
    else if(z > -720) xLimit = 260;
    else if(z > -1320) xLimit = 420;
    memoryPalace.pos.x = Math.max(-xLimit, Math.min(xLimit, memoryPalace.pos.x));
    memoryPalace.pos.y = Math.max(46, Math.min(150, memoryPalace.pos.y));
    memoryPalace.pos.z = Math.max(-1500, Math.min(720, memoryPalace.pos.z));
  }
  function palaceNearestMemory(maxDist=170){
    if(!memoryPalace.pos) return null;
    let best=null, bestD=maxDist;
    memoryPalace.nodes.forEach(n=>{
      if(!n.mesh || n.kind !== 'memory') return;
      const d=Math.hypot(memoryPalace.pos.x-n.x, memoryPalace.pos.z-n.z);
      if(d<bestD){ best=n; bestD=d; }
    });
    return best;
  }
  function updatePalaceNearbyPrompt(){
    const near = palaceNearestMemory(155);
    if(near) $('#palaceHudStatus').textContent = `tap to scan memory: ${String(near.label || '').replace(/^memory:/,'').slice(0,30)}`;
    else if($('#palaceHudStatus').textContent.startsWith('tap to scan memory:')) $('#palaceHudStatus').textContent = 'walk forward — memories are grouped by domain';
  }
  function palaceApplyVisibilityCulling(){
    if(!memoryPalace.scene || !memoryPalace.pos) return;
    memoryPalace.cullTick = (memoryPalace.cullTick || 0) + 1;
    if(memoryPalace.cullTick % 8 !== 0) return;
    let total=0, visible=0;
    const p = memoryPalace.pos;
    // Spatial streaming-lite: keep only nearby scene objects visible/renderable; do not draw the whole labyrinth at once.
    memoryPalace.scene.traverse(obj=>{
      total += 1;
      if(obj === memoryPalace.drone || obj === memoryPalace.beacon || obj.isHemisphereLight || obj.isDirectionalLight){ obj.visible = true; visible += 1; return; }
      if(!obj.parent || obj === memoryPalace.scene){ visible += 1; return; }
      const wp = obj.getWorldPosition ? obj.getWorldPosition(new memoryPalace.THREE.Vector3()) : obj.position;
      const d = Math.hypot(wp.x - p.x, wp.z - p.z);
      const limit = obj.isLight ? 760 : (obj.userData?.node ? 620 : 980);
      obj.visible = d < limit;
      if(obj.visible) visible += 1;
    });
    memoryPalace.lastObjectCount = total;
    memoryPalace.lastVisibleObjectCount = visible;
  }
  function updatePalaceZoneBadge(){
    const badge = $('.palace-zone-badge');
    if(!badge || !memoryPalace.pos) return;
    let best = null, bestD = Infinity;
    const zones = (memoryPalace.pathSections?.length ? memoryPalace.pathSections : memoryPalace.rooms) || [];
    zones.forEach(r => { const d = Math.hypot(memoryPalace.pos.x - r.x, memoryPalace.pos.z - r.z); if(d < bestD){ bestD = d; best = r; } });
    badge.textContent = best?.label || 'The Archive Gate';
  }
  async function loadMemoryPalace(){
    const labels = $('#palaceLabels');
    if(labels) labels.innerHTML = '<div class="three-loading-card"><h3>Loading the labyrinth…</h3><p>Fetching the render engine and memory graph.</p></div>';
    try {
      renderMemoryPalace(await api('/api/constellation?limit=360'));
    } catch(e) {
      if(isCancelledRequest(e)) return;
      if(labels) labels.innerHTML = `<div class="three-fallback-card"><h3>Could not load the labyrinth</h3><p>${esc(e.message || 'Try again.')}</p></div>`;
    }
  }
  function pickPalaceNode(e){
    if(!memoryPalace.raycaster) return;
    const rect = $('#palaceViewport').getBoundingClientRect();
    memoryPalace.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; memoryPalace.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    memoryPalace.raycaster.setFromCamera(memoryPalace.mouse, memoryPalace.camera);
    const meshes = memoryPalace.nodes.map(n=>n.mesh).filter(Boolean);
    const hit = memoryPalace.raycaster.intersectObjects(meshes, false)[0];
    if(hit?.object?.userData?.node){ inspectPalaceNode(hit.object.userData.node); return; }
    const near = palaceNearestMemory(180);
    if(near){ inspectPalaceNode(near); return; }
    $('#palaceHudStatus').textContent = 'walk nearer to a memory book, then tap to scan';
  }
  function stopPalaceJoystickEvent(e){
    e.stopPropagation();
    if(e.cancelable) e.preventDefault();
  }
  function bindPalaceControls(){
    const viewport = $('#palaceViewport'); if(!viewport || viewport.dataset.controlsBound === 'true') return; viewport.dataset.controlsBound = 'true';
    window.addEventListener('keydown', e => { if(isActive()) palaceKeys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true; });
    window.addEventListener('keyup', e => { palaceKeys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
    viewport.addEventListener('pointerdown', e=>{ if(e.target.closest('.fullscreen-exit') || e.target.closest('#palaceJoystick')) return; viewport.setPointerCapture?.(e.pointerId); memoryPalace.pointer={x:e.clientX,y:e.clientY,moved:false}; });
    viewport.addEventListener('pointermove', e=>{ if(!memoryPalace.pointer) return; const dx=e.clientX-memoryPalace.pointer.x, dy=e.clientY-memoryPalace.pointer.y; memoryPalace.pointer.x=e.clientX; memoryPalace.pointer.y=e.clientY; memoryPalace.pointer.moved = memoryPalace.pointer.moved || Math.abs(dx)+Math.abs(dy)>3; memoryPalace.yaw -= dx*.0032; memoryPalace.pitch = Math.max(-1.05, Math.min(.82, memoryPalace.pitch - dy*.0024)); });
    const end=()=>{ setTimeout(()=>{ memoryPalace.pointer=null; }, 0); }; viewport.addEventListener('pointerup', end); viewport.addEventListener('pointercancel', end);
    viewport.addEventListener('click', e=>{ if(e.target.closest('#palaceJoystick') || memoryPalace.pointer?.moved) return; pickPalaceNode(e); });
    const joy = $('#palaceJoystick');
    const updateJoy = e => {
      stopPalaceJoystickEvent(e); if(joy.dataset.active !== 'true') return;
      const r=joy.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, max=r.width*.38;
      let dx=e.clientX-cx, dy=e.clientY-cy; const dist=Math.hypot(dx,dy);
      if(dist > max){ dx = dx/dist*max; dy = dy/dist*max; }
      const rawX = dx/max, rawY = dy/max, mag = Math.min(1, Math.hypot(rawX, rawY));
      const dead = .16, scaled = mag <= dead ? 0 : (mag-dead)/(1-dead);
      const nx = mag ? rawX/mag*scaled : 0, ny = mag ? rawY/mag*scaled : 0;
      memoryPalace.joystick={x:nx, y:ny}; joy.querySelector('span').style.transform=`translate(${rawX*28}px,${rawY*28}px)`;
    };
    joy.addEventListener('pointerdown', e=>{ stopPalaceJoystickEvent(e); joy.setPointerCapture?.(e.pointerId); joy.dataset.active='true'; memoryPalace.pointer=null; updateJoy(e); });
    joy.addEventListener('pointermove', updateJoy);
    const stopJoy=e=>{ stopPalaceJoystickEvent(e); joy.dataset.active='false'; memoryPalace.joystick={x:0,y:0}; joy.querySelector('span').style.transform='translate(0,0)'; }; joy.addEventListener('pointerup', stopJoy); joy.addEventListener('pointercancel', stopJoy);
  }


  function updatePalaceLabels(){
    if(!memoryPalace.camera) return;
    const rect = $('#palaceViewport').getBoundingClientRect(); const v = new memoryPalace.THREE.Vector3(); let shown=0;
    $$('#palaceLabels .three-label').forEach((el,i)=>{
      const n = memoryPalace.labels[i]; if(!n) return;
      v.set(n.x,n.y,n.z).project(memoryPalace.camera);
      const sx=(v.x*.5+.5)*rect.width, sy=(-v.y*.5+.5)*rect.height;
      const visible = v.z > -1 && v.z < 1 && sx > 10 && sx < rect.width-10 && sy > 10 && sy < rect.height-10 && shown < 30;
      el.style.display = visible ? '' : 'none';
      if(visible){ shown++; el.style.left = `${sx}px`; el.style.top = `${sy}px`; el.style.opacity = String(n.room ? .78 : .96); }
    });
  }


  // V7: solid first-person memory dungeon. The Labyrinth must feel like walking inside the
  // memory archive, not viewing a whole strategy/minimap board.
  function palaceFpsRooms(data){
    const raw = (data.nodes || []).map(n => ({...n}));
    const memoryNodes = raw.filter(n => n.kind === 'memory' || n.memory_id);
    const domainSource = (memoryNodes.length ? memoryNodes : raw).slice(0,140);
    const domainGroups = {};
    domainSource.forEach(n => {
      const c = String(n.category || 'Other');
      if(!domainGroups[c]) domainGroups[c] = [];
      domainGroups[c].push(n);
    });
    const countByCat = Object.fromEntries(Object.entries(domainGroups).map(([cat, items]) => [cat, items.length]));
    const cats = Object.keys(countByCat).sort((a,b)=>countByCat[b]-countByCat[a] || a.localeCompare(b));
    const nodes = [];
    for(let round=0; nodes.length < 40 && round < 20; round++){
      cats.forEach(cat => {
        const n = domainGroups[cat]?.[round];
        if(n && nodes.length < 40) nodes.push(n);
      });
    }
    const rooms = [
      { label:'Archive Gate', x:0, z:0, w:420, d:360, color:0xffd166 },
      { label:String(cats[0] || 'Episodic Vault').slice(0,20), x:-520, z:-520, w:380, d:340, color:0x65d6ff },
      { label:String(cats[1] || 'Working Stream').slice(0,20), x:520, z:-520, w:380, d:340, color:0x52d6b5 },
      { label:String(cats[2] || 'Entity Gardens').slice(0,20), x:-520, z:-1120, w:380, d:340, color:0xb9a6ff },
      { label:String(cats[3] || 'Cold Storage').slice(0,20), x:520, z:-1120, w:380, d:340, color:0x8aa0c9 },
      { label:'Review Wing', x:0, z:-1680, w:430, d:360, color:0xff5f87 }
    ];
    const sectionColors = [0xffd166,0x65d6ff,0x52d6b5,0xb9a6ff,0xff9f6e,0x8aa0c9];
    const pathSections = cats.slice(0,6).map((cat,i)=>({
      label:String(cat || 'Other').slice(0,20), category:cat, x:0, y:150, z:245 - i*330,
      kind:'section', chunkId:Math.floor((245 - i*330 + 1600) / 350), color:sectionColors[i % sectionColors.length], count:countByCat[cat] || 0
    }));
    const seenInSection = {};
    let featured = 0;
    nodes.forEach((n,i)=>{
      const contaminated = ['unknown','inferred','imported'].includes(String(n.veracity || '').toLowerCase()) || /contaminat|unknown|untrusted/i.test(String(n.reason || n.preview || ''));
      let room = contaminated ? rooms[5] : rooms[1 + (i % 4)];
      if(!contaminated && n.kind === 'memory' && featured < 24){
        // Group the first playable walk by memory domain so the dungeon reads like a map, not random books.
        const cat = String(n.category || 'Other');
        const section = pathSections.find(s => s.category === cat) || pathSections[0] || { label:'Archive Gate', z:245 };
        const within = seenInSection[cat] || 0; seenInSection[cat] = within + 1;
        room = rooms[0];
        const side = within % 2 === 0 ? -1 : 1;
        const row = Math.floor(within / 2);
        n.x = side * (row < 2 ? 58 : 86);
        n.z = section.z - row * 105;
        n.y = 34; n.room = section.label; n.pathGroup = section.label; n.featuredPath = true;
        featured += 1;
      } else {
        const col = i % 4, row = Math.floor((i % 20) / 4);
        n.x = room.x - room.w*.30 + col * (room.w*.20);
        n.z = room.z - room.d*.22 + row * (room.d*.11);
        n.y = 34; n.room = room.label;
      }
      n.contaminated = contaminated;
      n.size = Math.min(28, 10 + Math.sqrt(Math.max(1, Number(n.weight || n.count || 1))) * 4);
      n.chunkId = Math.floor((n.z + 1600) / 350);
    });
    nodes.pathSections = pathSections;
    nodes.rooms = rooms;
    return nodes;
  }
  function palaceFpsMat(THREE, color, opts={}){
    return new THREE.MeshStandardMaterial({ color, emissive:opts.emissive || 0x05030a, emissiveIntensity:opts.emissiveIntensity ?? .08, roughness:opts.roughness ?? .76, metalness:opts.metalness ?? .04 });
  }
  function palaceFpsBox(THREE, scene, size, pos, mat){
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    return mesh;
  }
  function palaceFpsTexture(THREE, kind, base='#4b344d', line='rgba(255,224,138,.28)'){
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0,0,128,128);
    if(kind === 'stone'){
      g.strokeStyle = line; g.lineWidth = 2;
      for(let y=0;y<=128;y+=32){ g.beginPath(); g.moveTo(0,y+.5); g.lineTo(128,y+.5); g.stroke(); }
      for(let y=0;y<128;y+=32){ for(let x=(y/32)%2?32:0;x<128;x+=64){ g.beginPath(); g.moveTo(x+.5,y); g.lineTo(x+.5,y+32); g.stroke(); } }
      g.fillStyle = 'rgba(255,255,255,.055)'; for(let i=0;i<70;i++) g.fillRect(Math.random()*128, Math.random()*128, 1.5, 1.5);
      g.fillStyle = 'rgba(0,0,0,.16)'; for(let i=0;i<40;i++) g.fillRect(Math.random()*128, Math.random()*128, 2, 1);
    } else if(kind === 'gold'){
      const grad = g.createLinearGradient(0,0,128,128); grad.addColorStop(0,'#f3d589'); grad.addColorStop(.45,base); grad.addColorStop(1,'#7f622b');
      g.fillStyle = grad; g.fillRect(0,0,128,128);
      g.strokeStyle = 'rgba(255,245,190,.34)'; g.lineWidth = 3; for(let y=18;y<128;y+=28){ g.beginPath(); g.moveTo(0,y); g.lineTo(128,y+10); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.10)'; for(let i=0;i<45;i++) g.fillRect(Math.random()*128, Math.random()*128, 2, 2);
    } else if(kind === 'door'){
      const grad = g.createRadialGradient(64,58,5,64,64,78); grad.addColorStop(0,'#ffc078'); grad.addColorStop(.45,base); grad.addColorStop(1,'#2f1f25');
      g.fillStyle = grad; g.fillRect(0,0,128,128);
      g.strokeStyle = 'rgba(255,220,150,.24)'; g.lineWidth = 2; for(let x=18;x<128;x+=24){ g.beginPath(); g.moveTo(x,0); g.lineTo(x+6,128); g.stroke(); }
    }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 2; return tex;
  }
  function palaceFpsTexturedBasic(THREE, kind, color, repeat=[1,1], opacity=1){
    const map = palaceFpsTexture(THREE, kind, color);
    map.repeat.set(...repeat);
    return new THREE.MeshBasicMaterial({ color:0xffffff, map, transparent:opacity < 1, opacity, side:THREE.DoubleSide });
  }
  function palaceFpsAddRoom(THREE, scene, room, i){
    const floorMat = palaceFpsMat(THREE, i === 0 ? 0x3f314a : 0x30243d, { emissive:room.color, emissiveIntensity:.025 });
    const wallMat = palaceFpsMat(THREE, 0x554461, { emissive:room.color, emissiveIntensity:.035, roughness:.82 });
    palaceFpsBox(THREE, scene, [room.w, 16, room.d], [room.x, -8, room.z], floorMat, room.color, .28);
    const wallH = i === 0 ? 150 : 126, t = 24;
    const door = 120;
    [[0,room.d/2,room.w,t,'north'],[0,-room.d/2,room.w,t,'south'],[room.w/2,0,t,room.d,'east'],[-room.w/2,0,t,room.d,'west']].forEach(([ox,oz,w,d,side])=>{
      const isDoorSide = i === 0 && side === 'north';
      if(isDoorSide){
        palaceFpsBox(THREE, scene, [(w-door)/2, wallH, d], [room.x - (w+door)/4, wallH/2, room.z+oz], wallMat, 0xe8d8ff, .16);
        palaceFpsBox(THREE, scene, [(w-door)/2, wallH, d], [room.x + (w+door)/4, wallH/2, room.z+oz], wallMat, 0xe8d8ff, .16);
        palaceFpsBox(THREE, scene, [door+32, 24, d+8], [room.x, wallH+12, room.z+oz], wallMat, 0xffd166, .35);
        return;
      }
      palaceFpsBox(THREE, scene, [w, wallH, d], [room.x+ox, wallH/2, room.z+oz], wallMat, 0xe8d8ff, .13);
    });
    // Keep the FPS view solid, not wireframe/skeletal. Subtle floor blocks give scale without debug grid lines.
    const tileMat = palaceFpsMat(THREE, 0x473854, { emissive:room.color, emissiveIntensity:.018, roughness:.86 });
    for(let x=-room.w/2+64; x<room.w/2-24; x+=96){
      for(let z=-room.d/2+64; z<room.d/2-24; z+=96){
        const inset = new THREE.Mesh(new THREE.BoxGeometry(54, 2, 54), tileMat);
        inset.position.set(room.x+x, 2, room.z+z); inset.receiveShadow = true; scene.add(inset);
      }
    }
    const light = new THREE.PointLight(room.color, i === 0 ? 1.1 : .72, 480); light.position.set(room.x,130,room.z); scene.add(light);
    if(i === 0){
      // Mobile Chrome crushes subtle StandardMaterial lighting; the first screen needs deliberate unlit, high-contrast shapes.
      const gateMat = palaceFpsTexturedBasic(THREE, 'gold', '#caa45c', [2.2,1.1]);
      const sideMat = palaceFpsTexturedBasic(THREE, 'stone', '#4b344d', [1,4]);
      const floorMat = palaceFpsTexturedBasic(THREE, 'stone', '#2f2440', [3,8]);
      const railMat = palaceFpsTexturedBasic(THREE, 'gold', '#d7b36d', [1,5]);
      const doorMat = palaceFpsTexturedBasic(THREE, 'door', '#9b6041', [1.2,1], .62);
      palaceFpsBox(THREE, scene, [360, 14, 660], [room.x, -7, room.z+270], floorMat);
      palaceFpsBox(THREE, scene, [22, 18, 620], [room.x-116, 8, room.z+254], railMat);
      palaceFpsBox(THREE, scene, [22, 18, 620], [room.x+116, 8, room.z+254], railMat);
      for(let z=450; z>-80; z-=90){ palaceFpsBox(THREE, scene, [230, 8, 12], [room.x, 6, room.z+z], railMat); }
      palaceFpsBox(THREE, scene, [46,168,46], [room.x-126,86,room.z-120], gateMat);
      palaceFpsBox(THREE, scene, [46,168,46], [room.x+126,86,room.z-120], gateMat);
      palaceFpsBox(THREE, scene, [298,42,52], [room.x,170,room.z-120], gateMat);
      palaceFpsBox(THREE, scene, [34,132,430], [room.x-210,66,room.z+90], sideMat);
      palaceFpsBox(THREE, scene, [34,132,430], [room.x+210,66,room.z+90], sideMat);
      palaceFpsBox(THREE, scene, [156,122,18], [room.x,76,room.z-152], palaceFpsTexturedBasic(THREE, 'door', '#6f4e3a', [1,1]));
      // No circular portal at the starting view: rings read as bullseyes on real mobile. Use a lit doorway instead.
      const doorway = new THREE.Mesh(new THREE.PlaneGeometry(126, 104), doorMat);
      doorway.position.set(room.x,80,room.z-164); scene.add(doorway);
      [-1,1].forEach(side=>{
        const torch = new THREE.Mesh(new THREE.BoxGeometry(14,46,12), new THREE.MeshBasicMaterial({ color:0xffdf9b }));
        torch.position.set(room.x + side*158, 112, room.z-82); scene.add(torch);
        const flame = new THREE.PointLight(0xffb35c, 2.1, 460); flame.position.copy(torch.position); scene.add(flame);
      });
      const glow = new THREE.PointLight(0xffd166, 2.4, 720); glow.position.set(room.x,112,room.z-150); scene.add(glow);
      // Continue the authored path beyond the entrance so walking straight never drops into blank space.
      const hallFloor = palaceFpsBox(THREE, scene, [240, 10, 1500], [room.x, -5, room.z-860], floorMat);
      hallFloor.userData.walkable = true;
      palaceFpsBox(THREE, scene, [18, 16, 1450], [room.x-112, 5, room.z-840], railMat);
      palaceFpsBox(THREE, scene, [18, 16, 1450], [room.x+112, 5, room.z-840], railMat);
      for(let z=-260; z>-1280; z-=240){
        palaceFpsBox(THREE, scene, [150, 8, 10], [room.x, 8, room.z+z], railMat);
        [-1,1].forEach(side=>{
          palaceFpsBox(THREE, scene, [16, 60, 16], [room.x+side*150, 34, room.z+z], gateMat);
        });
      }
      palaceFpsBox(THREE, scene, [300, 120, 26], [room.x, 60, room.z-1510], sideMat);
      palaceFpsBox(THREE, scene, [170, 88, 18], [room.x, 62, room.z-1494], doorMat);
      const endLight = new THREE.PointLight(0xffd166, 1.1, 360); endLight.position.set(room.x, 92, room.z-1420); scene.add(endLight);
    }
  }
  function palaceFpsAddPathSections(THREE, scene, sections){
    const markerMat = color => new THREE.MeshBasicMaterial({ color, transparent:true, opacity:.82 });
    (sections || []).forEach(section=>{
      const mat = markerMat(section.color || 0xffd166);
      palaceFpsBox(THREE, scene, [250, 8, 18], [0, 12, section.z + 42], mat);
      palaceFpsBox(THREE, scene, [18, 92, 18], [-138, 48, section.z + 42], mat);
      palaceFpsBox(THREE, scene, [18, 92, 18], [138, 48, section.z + 42], mat);
      const glow = new THREE.PointLight(section.color || 0xffd166, .55, 300); glow.position.set(0, 86, section.z + 42); scene.add(glow);
    });
  }
  function palaceFpsAddCorridor(THREE, scene, a, b){
    const dx=b.x-a.x, dz=b.z-a.z, len=Math.hypot(dx,dz), midX=(a.x+b.x)/2, midZ=(a.z+b.z)/2;
    const mat = palaceFpsMat(THREE, 0x372a46, { emissive:0xffd166, emissiveIntensity:.025 });
    const road = palaceFpsBox(THREE, scene, [118, 12, len], [midX, -6, midZ], mat, 0xffd166, .18);
    road.rotation.y = Math.atan2(dx,dz);
    const wallMat = palaceFpsMat(THREE, 0x4a3a58, { emissive:0x140a20, emissiveIntensity:.04 });
    [-1,1].forEach(side=>{
      const wall = new THREE.Mesh(new THREE.BoxGeometry(18,86,len), wallMat);
      wall.position.set(midX + Math.cos(road.rotation.y)*side*68, 43, midZ - Math.sin(road.rotation.y)*side*68);
      wall.rotation.y = road.rotation.y; wall.castShadow = wall.receiveShadow = true; scene.add(wall);
    });
  }
  function palaceFpsAddRelic(THREE, scene, node, colors){
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(17,24,16,7), palaceFpsMat(THREE, 0x21172c));
    plinth.position.set(node.x,10,node.z); plinth.castShadow = plinth.receiveShadow = false; scene.add(plinth);
    const color = node.contaminated ? 0xff4f87 : cssHexToInt(colors.memory);
    if(node.featuredPath){
      const bookMat = new THREE.MeshBasicMaterial({ color:0xffd166 });
      const cover = new THREE.Mesh(new THREE.BoxGeometry(44, 54, 8), bookMat);
      cover.position.set(node.x, 48, node.z); cover.rotation.x = -.18; cover.userData.node = node; node.mesh = cover; scene.add(cover);
      const page = new THREE.Mesh(new THREE.BoxGeometry(34, 40, 4), new THREE.MeshBasicMaterial({ color:0xfff0c2 }));
      page.position.set(node.x, 50, node.z-5); page.rotation.x = -.18; scene.add(page);
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(58, 4, 34), new THREE.MeshBasicMaterial({ color:0x5b3f2d }));
      plaque.position.set(node.x, 23, node.z+18); scene.add(plaque);
      const halo = new THREE.PointLight(color, .55, 220); halo.position.copy(cover.position); scene.add(halo);
      return;
    }
    const geo = node.contaminated ? new THREE.IcosahedronGeometry(node.size,1) : new THREE.OctahedronGeometry(node.size,1);
    const relic = new THREE.Mesh(geo, palaceFpsMat(THREE, color, { emissive:color, emissiveIntensity:node.contaminated ? .48 : .24, roughness:.32, metalness:.08 }));
    relic.position.set(node.x,40 + node.size*.2,node.z); relic.castShadow = false; relic.userData.node = node; node.mesh = relic; scene.add(relic);
    if(node.contaminated){
      const halo = new THREE.PointLight(color, .45, 150); halo.position.copy(relic.position); scene.add(halo); node.scanLabel = 'Needs-review memory';
    }
  }
  function palaceStreamRelicChunks(force=false){
    if(!memoryPalace.scene || !memoryPalace.THREE || !memoryPalace.pos || !memoryPalace.streamedChunks) return;
    memoryPalace.streamTick = (memoryPalace.streamTick || 0) + 1;
    if(!force && memoryPalace.streamTick % 10 !== 0) return;
    const THREE = memoryPalace.THREE, active = new Set();
    const current = Math.floor((memoryPalace.pos.z + 1600) / 350);
    [current-1,current,current+1].forEach(id => active.add(id));
    for(const [id, group] of memoryPalace.streamedChunks.entries()){
      if(!active.has(id)){
        group.traverse(obj => { if(obj.userData?.node) obj.userData.node.mesh = null; });
        group.removeFromParent(); memoryPalace.streamedChunks.delete(id);
      }
    }
    active.forEach(id=>{
      if(memoryPalace.streamedChunks.has(id)) return;
      const group = new THREE.Group(); group.userData.chunkId = id;
      memoryPalace.nodes.filter(n => n.chunkId === id).forEach(n => palaceFpsAddRelic(THREE, group, n, memoryPalace.colors));
      memoryPalace.scene.add(group); memoryPalace.streamedChunks.set(id, group);
    });
  }
  async function renderMemoryPalace(data){
    const THREE = await loadThreeModule();
    clearPalaceScene(); memoryPalace.data = data; memoryPalace.THREE = THREE; palaceInspectorDefault();
    const viewport = $('#palaceViewport'); if(!viewport) return;
    const colors = constellationColors();
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' }); }
    catch(err){ $('#palaceLabels').innerHTML = `<div class="three-fallback-card"><h3>Mnemosyne Labyrinth unavailable</h3><p>This browser could not start WebGL.</p></div>`; return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4)); renderer.setClearColor(cssHexToInt(colors.bg), 0);
    // Performance-first FPS: shadows and high DPR made desktop unplayably laggy.
    renderer.shadowMap.enabled = false;
    viewport.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x08050e, .00115);
    const camera = new THREE.PerspectiveCamera(72, 1, 1, 4200);
    scene.add(new THREE.HemisphereLight(0xcdbaff, 0x07030c, .78));
    const key = new THREE.DirectionalLight(0xffe8c4, .78); key.position.set(260,520,380); scene.add(key);
    const nodes = palaceFpsRooms(data); const rooms = nodes.rooms || [], pathSections = nodes.pathSections || [];
    rooms.slice(1).forEach(room => palaceFpsAddCorridor(THREE, scene, rooms[0], room));
    rooms.forEach((room,i)=>palaceFpsAddRoom(THREE, scene, room, i));
    palaceFpsAddPathSections(THREE, scene, pathSections);
    const drone = palaceCreateHammyDrone(THREE); scene.add(drone);
    const mobilePalace = window.matchMedia('(max-width:760px), (max-width:940px) and (max-height:520px)').matches;
    Object.assign(memoryPalace, { renderer, scene, camera, group:scene, nodes, rooms, pathSections, colors, streamedChunks:new Map(), labels:pathSections.map(s=>({ label:`${s.label} (${s.count})`, x:s.x, y:s.y, z:s.z, kind:'section' })).concat(nodes.filter(n => n.featuredPath || n.contaminated || n.kind === 'memory').filter(n => !/^[a-f0-9]{10,}$/i.test(String(n.label || ''))).slice(0,18)), raycaster:new THREE.Raycaster(), mouse:new THREE.Vector2(), avatar:null, drone, pos:new THREE.Vector3(0,mobilePalace ? 82 : 78,mobilePalace ? 430 : 360), velocity:new THREE.Vector3(), yaw:0, pitch:mobilePalace ? -.14 : -.10, iso:false, paused:prefersReducedMotion() });
    palaceStreamRelicChunks(true);
    $('#palaceLabels').innerHTML = memoryPalace.labels.map((n,i)=>`<span class="three-label ${n.kind === 'memory' ? 'memory' : ''}" data-i="${i}">${esc(String(n.label || '').replace(/^memory:/,'mem ').slice(0,24))}</span>`).join('');
    $('#palaceHudStatus').textContent = 'walk forward — memories are grouped by domain';
    bindPalaceControls(); resizeMemoryPalace(); animateMemoryPalace(0);
  }
  function resizeMemoryPalace(){
    if(!memoryPalace.renderer) return;
    const rect = $('#palaceViewport').getBoundingClientRect(); const w = Math.max(320, rect.width), h = Math.max(320, rect.height);
    memoryPalace.renderer.setSize(w,h,false); memoryPalace.camera.aspect = w/h; memoryPalace.camera.updateProjectionMatrix();
  }
  function animateMemoryPalace(t=0){
    if(!memoryPalace.renderer) return;
    resizeMemoryPalace();
    const delta = memoryPalace.lastT ? Math.min(48, t - memoryPalace.lastT) / 1000 : .016; memoryPalace.lastT = t;
    const {forward,right} = palaceForwardRight(); const move = new memoryPalace.THREE.Vector3();
    if(palaceKeys.w || palaceKeys.ArrowUp) move.add(forward);
    if(palaceKeys.s || palaceKeys.ArrowDown) move.sub(forward);
    if(palaceKeys.d || palaceKeys.ArrowRight) move.add(right);
    if(palaceKeys.a || palaceKeys.ArrowLeft) move.sub(right);
    if(memoryPalace.joystick.x || memoryPalace.joystick.y){ move.addScaledVector(right, memoryPalace.joystick.x); move.addScaledVector(forward, -memoryPalace.joystick.y); }
    if(move.lengthSq() > 1) move.normalize();
    if(move.lengthSq() > 0) move.multiplyScalar((palaceKeys.Shift ? 420 : 235) * delta);
    memoryPalace.pos.add(move);
    palaceClampFpsPosition();
    memoryPalace.camera.rotation.order = 'YXZ'; memoryPalace.camera.position.copy(memoryPalace.pos); memoryPalace.camera.rotation.y = memoryPalace.yaw; memoryPalace.camera.rotation.x = memoryPalace.pitch;
    if(memoryPalace.drone){ const bob = memoryPalace.paused ? 0 : Math.sin(t*.003)*5; const dronePos = memoryPalace.pos.clone().add(right.clone().multiplyScalar(38)).add(forward.clone().multiplyScalar(-46)).add(new memoryPalace.THREE.Vector3(0,14+bob,0)); memoryPalace.drone.position.lerp(dronePos, .16); }
    palaceStreamRelicChunks();
    if(memoryPalace.beacon && !memoryPalace.paused) memoryPalace.beacon.rotation.y += delta * 1.4;
    if(!memoryPalace.paused) memoryPalace.nodes.forEach((n,i)=>{ if(n.mesh && n.mesh.visible && (n.featuredPath || i < 18)){ n.mesh.rotation.y += delta * (.14 + (i%5)*.02); }});
    palaceApplyVisibilityCulling();
    memoryPalace.renderer.render(memoryPalace.scene, memoryPalace.camera); updatePalaceNearbyPrompt(); updatePalaceLabels(); updatePalaceZoneBadge();
    memoryPalace.frame = document.hidden ? 0 : requestAnimationFrame(animateMemoryPalace);
  }

  return {
    loadMemoryPalace,
    resetMemoryPalaceDiver,
    palaceSearchBeacon,
    clearPalaceScene,
    resizeMemoryPalace,
    animateMemoryPalace,
    isRendering: () => Boolean(memoryPalace.renderer),
    resume: () => {
      if(memoryPalace.renderer && !memoryPalace.frame) memoryPalace.frame = requestAnimationFrame(animateMemoryPalace);
    },
  };
}
