export function createThreeVisualiser({
  $,
  $$,
  api,
  esc,
  openMemoryDetail,
  switchTab,
  loadThreeModule,
  constellationColors,
  neuralColors,
  visualiserResponsiveFill,
  prefersReducedMotion,
  isCancelledRequest,
}) {
  let threeVis = {
    mode: 'constellation', data: null, renderer: null, scene: null, camera: null, group: null,
    nodes: [], edgePairs: [], labels: [], pulses: [], frame: 0, paused: false, panMode: false,
    drag: null, pointer: new Map(), yaw: 0, pitch: 0.32, cameraZ: 780, panX: 0, panY: 0, lastT: 0
  };
  function threeInspectorDefault(){
    const neural = threeVis.mode === 'neural';
    $('#threeInspector').innerHTML = neural
      ? `<div class="inspector-kicker">Neural inspector</div><h3>Nothing selected</h3><p class="muted">Pick a neuron hub, memory soma, or synapse to inspect the underlying read-only source.</p>`
      : `<div class="inspector-kicker">Constellation inspector</div><h3>Nothing selected</h3><p class="muted">Pick a star, memory, or link to inspect the underlying read-only source.</p>`;
  }
  function inspectThreeNode(node){
    const mode = threeVis.mode === 'neural' ? 'Neural Map 3D' : 'Constellation 3D';
    $('#threeInspector').innerHTML = `<div class="inspector-kicker">${mode} · ${esc(node.kind || 'entity')}</div><h3>${esc(node.label)}</h3><p class="muted">${esc(node.category || 'Other')} · ${Number(node.count || 0).toLocaleString()} signal(s) · weight ${Number(node.weight || 0).toFixed(2)}</p>${node.preview ? `<p>${esc(node.preview)}</p>` : ''}<div class="inspector-actions">${node.memory_id ? '<button id="threeMemory" class="primary tiny">Open memory</button>' : ''}<button id="threeSearch" class="tiny">Search this</button></div>`;
    if(node.memory_id) $('#threeMemory').onclick = () => openMemoryDetail(node.memory_id);
    $('#threeSearch').onclick = () => { $('#memoryQuery').value = String(node.label || '').replace(/^memory:/,''); switchTab('memories'); };
  }
  function updateThreeUI(){
    $$('.visualiser-tabs button[data-three-mode]').forEach(b => { const active = b.dataset.threeMode === threeVis.mode; b.classList.toggle('active', active); b.setAttribute('aria-selected', String(active)); });
    const viewport = $('#threeViewport'); if(viewport) viewport.dataset.threeMode = threeVis.mode;
    const legend = $('#threeLegend');
    if(legend) legend.innerHTML = threeVis.mode === 'neural'
      ? '<span><i class="legend-dot entity"></i>Neuron hub</span><span><i class="legend-dot memory"></i>Memory soma</span><span><i class="legend-line"></i>Synapse</span>'
      : '<span><i class="legend-dot entity"></i>Entity/topic</span><span><i class="legend-dot memory"></i>Memory</span><span><i class="legend-line"></i>Link</span>';
    const help = $('#threeHelp'); if(help) help.textContent = threeVis.mode === 'neural'
      ? (window.matchMedia('(max-width: 760px)').matches ? 'Drag to orbit · Pan mode to move · pinch to zoom · tap a neuron.' : 'Drag to orbit the neural cloud · Pan mode/Shift-drag to pan · wheel/pinch to zoom.')
      : 'Drag to rotate · Pan mode/Shift-drag to pan · wheel/pinch to zoom.';
    const pause = $('#threePause'); if(pause) pause.textContent = threeVis.paused ? (threeVis.mode === 'neural' ? 'Resume drift' : 'Resume rotation') : (threeVis.mode === 'neural' ? 'Pause drift' : 'Pause rotation');
    const pan = $('#threePanMode'); if(pan) pan.textContent = threeVis.panMode ? 'Orbit mode' : 'Pan mode';
  }
  function resetThreeCamera(){ Object.assign(threeVis, { yaw: threeVis.mode === 'neural' ? .12 : .70, pitch: threeVis.mode === 'neural' ? .10 : .96, cameraZ: threeVis.mode === 'neural' ? 600 : 760, panX:0, panY: threeVis.mode === 'neural' ? -10 : -84, lastT:0 }); }
  function clearThreeScene(){
    if(threeVis.frame) cancelAnimationFrame(threeVis.frame);
    threeVis.frame = 0;
    if(threeVis.renderer){ threeVis.renderer.dispose(); threeVis.renderer.domElement.remove(); }
    $('#threeLabels').innerHTML = '';
    Object.assign(threeVis, { renderer:null, scene:null, camera:null, group:null, nodes:[], edgePairs:[], labels:[], pulses:[] });
  }
  function cssHexToInt(hex){
    const m = String(hex || '').match(/^#([0-9a-f]{6})$/i);
    return m ? parseInt(m[1], 16) : 0xffffff;
  }
  function colorForTheme(){
    const c = threeVis.mode === 'neural' ? neuralColors() : constellationColors();
    return {
      bg: cssHexToInt(c.bg),
      entity: cssHexToInt(c.star),
      memory: cssHexToInt(c.memory),
      link: cssHexToInt(threeVis.mode === 'neural' ? (c.light ? '#127464' : '#52d6b5') : (c.light ? '#19416c' : '#c6e0ff')),
      pulse: cssHexToInt(threeVis.mode === 'neural' ? (c.light ? '#6f6048' : '#fffaf0') : c.memory),
      text: c.text,
      light: c.light
    };
  }
  function makePointTexture(THREE, kind){
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const cx=64, cy=64;
    if(kind === 'star'){
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,60);
      g.addColorStop(0,'rgba(255,255,255,1)');
      g.addColorStop(.28,'rgba(255,255,255,.92)');
      g.addColorStop(.58,'rgba(255,255,255,.38)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,60,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.72)'; ctx.lineWidth=1.3;
      ctx.beginPath(); ctx.moveTo(cx,14); ctx.lineTo(cx,114); ctx.moveTo(14,cy); ctx.lineTo(114,cy); ctx.stroke();
    } else if(kind === 'neuron') {
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,62);
      g.addColorStop(0,'rgba(255,255,255,1)');
      g.addColorStop(.13,'rgba(255,255,255,.94)');
      g.addColorStop(.42,'rgba(255,255,255,.28)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,61,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.70)'; ctx.lineCap='round'; ctx.lineJoin='round';
      for(let i=0;i<9;i++){
        const a=(i/9)*Math.PI*2 + .13;
        const len=22 + (i%4)*4;
        const fork=len*.62;
        const sx=cx+Math.cos(a)*13, sy=cy+Math.sin(a)*13;
        const mx=cx+Math.cos(a+.10*Math.sin(i))*fork, my=cy+Math.sin(a+.10*Math.sin(i))*fork;
        const ex=cx+Math.cos(a)*len, ey=cy+Math.sin(a)*len;
        ctx.lineWidth=i%3===0?2.25:1.45;
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.quadraticCurveTo(mx,my,ex,ey); ctx.stroke();
        ctx.lineWidth=.9;
        ctx.globalAlpha=.72;
        ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(cx+Math.cos(a+.38)*len*.66,cy+Math.sin(a+.38)*len*.66); ctx.stroke();
        if(i%3===0){ ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(cx+Math.cos(a-.34)*len*.60,cy+Math.sin(a-.34)*len*.60); ctx.stroke(); }
        ctx.globalAlpha=1;
      }
      ctx.fillStyle='rgba(255,255,255,.98)'; ctx.beginPath(); ctx.arc(cx,cy,34,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.54)'; ctx.beginPath(); ctx.arc(cx-8,cy-9,8,0,Math.PI*2); ctx.fill();
    } else if(kind === 'soma') {
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,62);
      g.addColorStop(0,'rgba(255,255,255,1)');
      g.addColorStop(.18,'rgba(255,255,255,.96)');
      g.addColorStop(.42,'rgba(255,255,255,.34)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,62,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.68)'; ctx.lineCap='round'; ctx.lineWidth=1.55;
      for(let i=0;i<5;i++){
        const a=(i/5)*Math.PI*2+.22, len=21+(i%2)*4;
        ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*18,cy+Math.sin(a)*18); ctx.lineTo(cx+Math.cos(a)*len,cy+Math.sin(a)*len); ctx.stroke();
      }
      ctx.lineWidth=3.4; ctx.beginPath(); ctx.arc(cx,cy,40,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,1)'; ctx.beginPath(); ctx.arc(cx,cy,35,0,Math.PI*2); ctx.fill();
    } else {
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,60);
      g.addColorStop(0,'rgba(255,255,255,1)');
      g.addColorStop(.44,'rgba(255,255,255,.82)');
      g.addColorStop(.78,'rgba(255,255,255,.22)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,60,0,Math.PI*2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }
  function buildThreePositions(data){
    if(threeVis.mode === 'neural') return buildThreeNeuralPositions(data);
    const nodes = (data.nodes || []).slice(0,160).map(n => ({...n}));
    const categories = [...new Set(nodes.map(n => n.category || 'Other'))];
    const catIndex = Object.fromEntries(categories.map((c,i)=>[c,i]));
    nodes.forEach((n,i) => {
      const cat = n.category || 'Other';
      const ci = catIndex[cat] || 0;
      const weight = Math.max(1, Number(n.weight || n.count || 1));
      const shell = n.kind === 'memory' ? 1.12 : .74 + (ci % 3) * .10;
      const radius = 285 * shell + (i % 7) * 18 + Math.min(46, Math.sqrt(weight) * 5.5);
      const longitude = ((i * 137.508 + ci * 23) % 360) * Math.PI / 180;
      const latitudeSeed = (((i * 53 + ci * 29) % 101) + .5) / 101;
      const latitude = Math.acos(1 - 2 * latitudeSeed) - Math.PI / 2;
      const radial = Math.cos(latitude);
      const orbitBias = Math.sin((i / Math.max(nodes.length,1)) * Math.PI * 2 + ci * .62) * 22;
      n.x = Math.cos(longitude) * radial * radius;
      n.y = Math.sin(latitude) * radius * .92 + orbitBias;
      n.z = Math.sin(longitude) * radial * radius * 1.12 + Math.cos(longitude * 1.7 + ci) * 54;
      const sizeJitter = 1 + (((i * 37) % 11) - 5) * .035;
      n.size = Math.min(42, 9 + Math.sqrt(weight)*6.2 + (n.kind === 'memory' ? 3.5 : 4.5)) * sizeJitter;
      n.twinkle = (i % 23) / 23;
      const twinkleTier = i % 17 === 0 ? 2 : (i % 5 === 0 ? 1 : 0);
      n.twinkleFreq = twinkleTier === 2 ? .0048 + ((i * 41) % 130) / 100000 : (twinkleTier === 1 ? .0024 + ((i * 47) % 120) / 100000 : .00125 + ((i * 53) % 110) / 100000);
      n.twinkleAmp = twinkleTier === 2 ? .34 : (twinkleTier === 1 ? .24 : .15 + ((i * 29) % 70) / 1000);
      n._degree = 0; n._weight = weight;
    });
    return nodes;
  }
  function buildThreeNeuralPositions(data){
    const nodes = (data.nodes || []).slice(0,170).map(n => ({...n}));
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = (data.edges || []).filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)).slice(0,340);
    const categories = [...new Set(nodes.map(n => n.category || 'Other'))];
    const catIndex = Object.fromEntries(categories.map((c,i)=>[c,i]));
    const regionCount = Math.max(1, categories.length);
    const regions = Object.fromEntries(categories.map((cat, i) => {
      const angle = -Math.PI / 2 + (i / regionCount) * Math.PI * 2;
      const radius = regionCount <= 2 ? 86 : (i === regionCount - 1 && regionCount > 5 ? 70 : 142 + (i % 2) * 18);
      const lap = Math.floor(i / Math.max(1, regionCount));
      return [cat, {
        label:cat,
        angle,
        cx:Math.cos(angle) * radius + lap * 18,
        cy:Math.sin(angle) * radius * .96,
        cz:((i * 41) % 89 - 44) * .72,
        spread:94 + (i % 4) * 10
      }];
    }));
    const degree = new Map();
    edges.forEach(e => { degree.set(e.source, (degree.get(e.source) || 0) + 1); degree.set(e.target, (degree.get(e.target) || 0) + 1); });
    const hubsByCategory = {};
    nodes.filter(n => n.kind !== 'memory').sort((a,b)=>(Number(b.weight || b.count || 0)+ (degree.get(b.id)||0)) - (Number(a.weight || a.count || 0)+(degree.get(a.id)||0))).forEach(n => {
      const cat = n.category || 'Other'; if(!hubsByCategory[cat]) hubsByCategory[cat] = []; hubsByCategory[cat].push(n);
    });
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    nodes.forEach((n,i) => {
      const cat = n.category || 'Other';
      const region = regions[cat] || regions.Other || { cx:0, cy:0, cz:0, angle:0, spread:80 };
      const ci = catIndex[cat] || 0;
      const weight = Math.max(1, Number(n.weight || n.count || 1));
      const d = degree.get(n.id) || 0;
      if(n.kind === 'memory'){
        const linked = edges.find(e => e.source === n.id || e.target === n.id);
        const parent = linked ? byId[linked.source === n.id ? linked.target : linked.source] : null;
        const parentX = parent && parent.kind !== 'memory' && Number.isFinite(parent.x) ? parent.x : region.cx;
        const parentY = parent && parent.kind !== 'memory' && Number.isFinite(parent.y) ? parent.y : region.cy;
        const parentZ = parent && parent.kind !== 'memory' && Number.isFinite(parent.z) ? parent.z : region.cz;
        const branch = ((i * 137.508 + ci * 19) % 360) * Math.PI / 180;
        const yUnit = ((((i * 43 + ci * 17) % 97) + .5) / 97) * 2 - 1;
        const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
        const dist = 46 + (i % 6) * 13 + Math.min(48, Math.sqrt(weight) * 10);
        n.x = parentX + Math.cos(branch) * radial * dist;
        n.y = parentY + yUnit * dist * .82;
        n.z = parentZ + Math.sin(branch) * radial * dist * .86;
      } else {
        const rank = Math.max(0, (hubsByCategory[cat] || []).indexOf(n));
        const orbit = rank === 0 ? 0 : 30 + Math.sqrt(rank) * 20;
        const angle = region.angle + rank * 2.399963 + (ci % 3) * .24;
        const yUnit = rank === 0 ? 0 : ((((rank * 37 + ci * 11) % 89) + .5) / 89) * 2 - 1;
        const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
        n.x = region.cx + Math.cos(angle) * radial * orbit;
        n.y = region.cy + yUnit * orbit * .86;
        n.z = region.cz + Math.sin(angle) * radial * orbit * .80;
      }
      n.size = Math.min(30, 8 + Math.sqrt(weight + d) * (n.kind === 'memory' ? 3.2 : 4.1));
      n._degree = d; n._weight = weight; n.neuralRegion = cat;
    });
    threeVis.neuralRegions = Object.values(regions);
    return nodes;
  }
  function limitedThreeEdges(data, byId, mobile=false){
    const degree = new Map(); const out=[];
    const limit = threeVis.mode === 'neural' ? 132 : (mobile ? 92 : 140);
    const degreeLimit = threeVis.mode === 'neural' ? 5 : (mobile ? 3 : 4);
    for(const e of (data.edges || [])){
      const a=byId.get(e.source), b=byId.get(e.target); if(!a || !b) continue;
      const da=degree.get(e.source)||0, db=degree.get(e.target)||0; if(da>=degreeLimit || db>=degreeLimit) continue;
      degree.set(e.source, da+1); degree.set(e.target, db+1); a._degree++; b._degree++; out.push({ ...e, a, b });
      if(out.length >= limit) break;
    }
    return out;
  }
  function neuralAuraOverlay(regions){
    if(threeVis.mode !== 'neural') return '';
    const regionList = (regions || []).slice(0,9);
    return `<div class="three-aura-layer">${regionList.map((r,i)=>`<span class="three-aura-oval" data-region="${esc(r.label || '')}" style="opacity:0;transform:translate(-50%,-50%) rotate(${(Number(r.angle || 0) * 28).toFixed(1)}deg)"></span>`).join('')}</div>`;
  }
  function makeAuraOvalTexture(THREE){
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320;
    const ctx = canvas.getContext('2d'); const cx=256, cy=160;
    const g = ctx.createRadialGradient(cx, cy, 12, cx, cy, 230);
    g.addColorStop(0, 'rgba(102,232,198,.24)');
    g.addColorStop(.52, 'rgba(102,232,198,.13)');
    g.addColorStop(1, 'rgba(102,232,198,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, 238, 142, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(102,232,198,.16)'; ctx.lineWidth=2;
    for(let i=0;i<3;i++){
      ctx.beginPath(); ctx.ellipse(cx, cy, 88+i*48, 46+i*28, 0, 0, Math.PI*2); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true; return tex;
  }
  function addNeuralAuraOvals(THREE, group, regions, colors){
    const texture = makeAuraOvalTexture(THREE);
    (regions || []).slice(0,10).forEach((region, i) => {
      const material = new THREE.SpriteMaterial({ map:texture, color:colors.entity, transparent:true, opacity:colors.light ? .13 : .18, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending, rotation:(region.angle || 0) * .42 });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(region.cx || 0, region.cy || 0, (region.cz || 0) - 18 - i*.8);
      const spread = region.spread || 86;
      sprite.scale.set(spread * (3.9 + (i%3)*.35), spread * (2.35 + (i%2)*.22), 1);
      sprite.renderOrder = -10 + i;
      group.add(sprite);
    });
  }
  function addHaloPoints(THREE, scene, nodes, kind, color, size){
    let selected = nodes.filter(n => (n.kind === 'memory') === (kind === 'memory'));
    if(threeVis.mode !== 'neural'){
      selected = selected
        .filter(n => {
          const weight = Math.max(1, Number(n.weight || n.count || 1));
          return weight > (kind === 'memory' ? 3.6 : 4.4) || Number(n._degree || 0) > 3;
        })
        .sort((a,b)=>(Math.max(1, Number(b.weight || b.count || 1)) + Number(b._degree || 0)) - (Math.max(1, Number(a.weight || a.count || 1)) + Number(a._degree || 0)))
        .slice(0, kind === 'memory' ? 30 : 44);
    }
    const positions = new Float32Array(selected.length * 3);
    selected.forEach((n,i)=>{ positions[i*3]=n.x; positions[i*3+1]=n.y; positions[i*3+2]=n.z; });
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    const themeColors = colorForTheme();
    const isNeural = threeVis.mode === 'neural';
    const opacity = isNeural
      ? (kind === 'memory' ? (themeColors.light ? .16 : .28) : (themeColors.light ? .18 : .34))
      : (kind === 'memory' ? (themeColors.light ? .12 : .24) : (themeColors.light ? .13 : .26));
    const material = new THREE.PointsMaterial({ color, map:makePointTexture(THREE, 'orb'), alphaTest:.015, size, sizeAttenuation:true, transparent:true, opacity, depthWrite:false, blending:themeColors.light ? THREE.NormalBlending : THREE.AdditiveBlending });
    const points = new THREE.Points(geometry, material); scene.add(points); return points;
  }
  function addNeuralDendrites(THREE, group, nodes, colors){
    const trunks=[]; const twigs=[]; const tips=[];
    nodes.slice(0,150).forEach((n,i)=>{
      const arms = n.kind === 'memory' ? 3 : 6;
      const base = n.kind === 'memory' ? 10 : 17;
      for(let a=0;a<arms;a++){
        const theta=(a/arms)*Math.PI*2 + (i%11)*.19;
        const phi=Math.sin(i*.37+a)*.58;
        const len=base + ((i+a*13)%9);
        const mid=[n.x+Math.cos(theta+.16)*Math.cos(phi)*len*.50, n.y+Math.sin(phi)*len*.36, n.z+Math.sin(theta+.16)*Math.cos(phi)*len*.50];
        const end=[n.x+Math.cos(theta)*Math.cos(phi)*len*.78, n.y+Math.sin(phi)*len*.54, n.z+Math.sin(theta)*Math.cos(phi)*len*.78];
        trunks.push(n.x,n.y,n.z, mid[0],mid[1],mid[2], mid[0],mid[1],mid[2], end[0],end[1],end[2]);
        if(n.kind !== 'memory' && a%2===0){
          const side=theta+(a%2?.44:-.40);
          const fork=[mid[0]+Math.cos(side)*len*.18, mid[1]+Math.sin(phi+.25)*len*.12, mid[2]+Math.sin(side)*len*.18];
          twigs.push(mid[0],mid[1],mid[2], fork[0],fork[1],fork[2]);
        }
        if(i%3===0 && a%2===0) tips.push(end[0],end[1],end[2]);
      }
    });
    const trunkGeom = new THREE.BufferGeometry(); trunkGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trunks),3));
    group.add(new THREE.LineSegments(trunkGeom, new THREE.LineBasicMaterial({ color:colors.entity, transparent:true, opacity:colors.light ? .34 : .36, blending:colors.light ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite:false })));
    const twigGeom = new THREE.BufferGeometry(); twigGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(twigs),3));
    group.add(new THREE.LineSegments(twigGeom, new THREE.LineBasicMaterial({ color:colors.link, transparent:true, opacity:colors.light ? .28 : .24, blending:colors.light ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite:false })));
    const tipGeom = new THREE.BufferGeometry(); tipGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tips),3));
    group.add(new THREE.Points(tipGeom, new THREE.PointsMaterial({ color:colors.entity, map:makePointTexture(THREE, 'orb'), alphaTest:.03, size:3.8, transparent:true, opacity:colors.light ? .54 : .72, depthWrite:false, blending:colors.light ? THREE.NormalBlending : THREE.AdditiveBlending })));
  }
  function addPoints(THREE, scene, nodes, kind, color, size){
    const selected = nodes.filter(n => (n.kind === 'memory') === (kind === 'memory'));
    const positions = new Float32Array(selected.length * 3);
    const sizes = new Float32Array(selected.length);
    const phases = new Float32Array(selected.length);
    const freqs = new Float32Array(selected.length);
    const amps = new Float32Array(selected.length);
    const majors = new Float32Array(selected.length);
    selected.forEach((n,i)=>{
      const weight = Math.max(1, Number(n.weight || n.count || 1));
      positions[i*3]=n.x; positions[i*3+1]=n.y; positions[i*3+2]=n.z;
      const degreeBoost = Math.min(10, Number(n._degree || 0) * 1.9);
      const variedSize = (n.size || size) + degreeBoost;
      sizes[i]=Math.max(size * 1.14, Math.min(size * 2.65, variedSize * 1.62));
      phases[i]=(n.twinkle || 0) * Math.PI * 2;
      freqs[i]=n.twinkleFreq || .0012;
      amps[i]=n.twinkleAmp || .12;
      majors[i]=weight > 6.2 || (kind === 'memory' && weight > 4.8) ? 1 : 0;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes,1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases,1));
    geometry.setAttribute('aFreq', new THREE.BufferAttribute(freqs,1));
    geometry.setAttribute('aAmp', new THREE.BufferAttribute(amps,1));
    geometry.setAttribute('aMajor', new THREE.BufferAttribute(majors,1));
    const themeColors = colorForTheme();
    let material;
    if(threeVis.mode === 'neural'){
      material = new THREE.PointsMaterial({ color, map:makePointTexture(THREE, kind === 'memory' ? 'soma' : 'neuron'), alphaTest:.04, size, sizeAttenuation:true, transparent:true, opacity:kind === 'memory' ? (themeColors.light ? .88 : .98) : (themeColors.light ? .76 : .86), depthWrite:false, blending:themeColors.light ? THREE.NormalBlending : THREE.AdditiveBlending });
    } else {
      material = new THREE.ShaderMaterial({
        uniforms:{
          uTime:{value:0},
          uScale:{value:420},
          uColor:{value:new THREE.Color(color)},
          uIsStar:{value:kind === 'memory' ? 0 : 1},
          uOpacity:{value:kind === 'memory' ? .98 : .96}
        },
        vertexShader:`
          attribute float aSize;
          attribute float aPhase;
          attribute float aFreq;
          attribute float aAmp;
          attribute float aMajor;
          uniform float uTime;
          uniform float uScale;
          varying float vPulse;
          varying float vMajor;
          void main(){
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            float wave = sin(uTime * aFreq + aPhase) + sin(uTime * aFreq * 0.43 + aPhase * 1.71) * 0.45;
            vPulse = 1.0 + wave * aAmp;
            vMajor = aMajor;
            gl_PointSize = aSize * (0.98 + (vPulse - 1.0) * 0.32) * (uScale / max(72.0, -mvPosition.z));
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader:`
          uniform vec3 uColor;
          uniform float uIsStar;
          uniform float uOpacity;
          varying float vPulse;
          varying float vMajor;
          void main(){
            vec2 p = gl_PointCoord - vec2(0.5);
            float d = length(p);
            if(d > 0.5) discard;
            float core = 1.0 - smoothstep(0.026, 0.060, d);
            float body = 1.0 - smoothstep(0.060, 0.135, d);
            float halo = (1.0 - smoothstep(0.13, 0.48, d)) * (0.15 + clamp(vPulse - 1.0, -0.30, 0.46) * 0.82);
            float rayH = max(0.0, 1.0 - abs(p.y) / 0.010) * (1.0 - smoothstep(0.07, 0.44, abs(p.x)));
            float rayV = max(0.0, 1.0 - abs(p.x) / 0.010) * (1.0 - smoothstep(0.07, 0.44, abs(p.y)));
            float diag1 = max(0.0, 1.0 - abs(p.x - p.y) / 0.013) * (1.0 - smoothstep(0.06, 0.26, d));
            float diag2 = max(0.0, 1.0 - abs(p.x + p.y) / 0.013) * (1.0 - smoothstep(0.06, 0.26, d));
            float rays = vMajor * (max(rayH, rayV) * 0.50 + max(diag1, diag2) * 0.16);
            float alpha = (body * 0.46 + core * 1.02 + halo + rays) * uOpacity * clamp(0.72 + (vPulse - 1.0) * 0.92, 0.46, 1.35);
            if(alpha < 0.022) discard;
            vec3 starCore = mix(uColor, vec3(1.0), core * 0.88 + rays * 0.38);
            vec3 memoryCore = mix(uColor, vec3(1.0), core * 0.34);
            vec3 crisp = mix(memoryCore, starCore, uIsStar);
            gl_FragColor = vec4(crisp * (0.92 + (vPulse - 1.0) * 0.22), min(alpha, 1.0));
          }
        `,
        transparent:true,
        depthWrite:false,
        blending:THREE.NormalBlending
      });
    }
    const points = new THREE.Points(geometry, material); points.userData.nodes = selected; scene.add(points); return points;
  }
  function buildThreeLinkSegments(THREE, edges){
    const positions = [];
    edges.forEach((e,i)=>{
      if(threeVis.mode === 'neural'){
        const ax=e.a.x, ay=e.a.y, az=e.a.z, bx=e.b.x, by=e.b.y, bz=e.b.z;
        const dx=bx-ax, dy=by-ay, dz=bz-az;
        const len=Math.max(1, Math.hypot(dx,dy,dz));
        const bend=(i%2?1:-1) * Math.min(58, 18 + len*.12);
        const cx=(ax+bx)/2 + (-dy/len)*bend;
        const cy=(ay+by)/2 + (dx/len)*bend*.55 + Math.sin(i*.71)*18;
        const cz=(az+bz)/2 + Math.cos(i*.53)*bend*.72;
        e._curve={cx,cy,cz};
        let px=ax, py=ay, pz=az;
        for(let step=1; step<=7; step++){
          const t=step/7, inv=1-t;
          const x=inv*inv*ax+2*inv*t*cx+t*t*bx;
          const y=inv*inv*ay+2*inv*t*cy+t*t*by;
          const z=inv*inv*az+2*inv*t*cz+t*t*bz;
          positions.push(px,py,pz,x,y,z); px=x; py=y; pz=z;
        }
      } else {
        positions.push(e.a.x,e.a.y,e.a.z,e.b.x,e.b.y,e.b.z);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions),3));
    return geometry;
  }
  async function renderThreeVisualiser(data){
    const THREE = await loadThreeModule();
    clearThreeScene(); threeVis.data = data; updateThreeUI(); threeInspectorDefault();
    const viewport = $('#threeViewport'); if(!viewport) return;
    const colors = colorForTheme();
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' });
    } catch(err) {
      $('#threeViewport').classList.add('three-fallback');
      $('#threeLabels').innerHTML = `<div class="three-fallback-card"><h3>3D visualiser unavailable</h3><p>The original Visualiser remains available for this browser.</p></div>`;
      $('#threeInspector').innerHTML = `<div class="inspector-kicker">Constellation inspector</div><h3>3D visualiser unavailable</h3><p class="muted">Try the original Visualiser, or reopen this page in a browser that supports the 3D view.</p>`;
      return;
    }
    $('#threeViewport').classList.remove('three-fallback');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(colors.bg, 0);
    viewport.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(colors.bg, threeVis.mode === 'neural' ? .0011 : .0009);
    const mobileThree = (viewport.getBoundingClientRect?.().width || 650) < 520;
    const camera = new THREE.PerspectiveCamera(48, 1, 1, 5000);
    const group = new THREE.Group(); scene.add(group);
    const ambient = new THREE.AmbientLight(0xffffff, .55); scene.add(ambient);
    const light = new THREE.PointLight(colors.entity, 1.2, 1200); light.position.set(180,220,260); scene.add(light);
    const nodes = buildThreePositions(data); const byId = new Map(nodes.map(n=>[n.id,n])); const edges = limitedThreeEdges(data, byId, mobileThree);
    const linkGeom = buildThreeLinkSegments(THREE, edges);
    const linkMaterial = threeVis.mode === 'neural'
      ? new THREE.LineBasicMaterial({ color:colors.link, transparent:true, opacity:colors.light ? .30 : .40, blending:colors.light ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite:false })
      : new THREE.LineDashedMaterial({ color:colors.link, transparent:true, opacity:colors.light ? (mobileThree ? .14 : .16) : (mobileThree ? .13 : .12), dashSize:9, gapSize:8, blending:THREE.NormalBlending, depthWrite:false });
    const linkLines = new THREE.LineSegments(linkGeom, linkMaterial);
    if(threeVis.mode !== 'neural') linkLines.computeLineDistances();
    group.add(linkLines);
    if(threeVis.mode === 'neural'){
      addHaloPoints(THREE, group, nodes, 'entity', colors.entity, 50);
      addHaloPoints(THREE, group, nodes, 'memory', colors.memory, 48);
      addNeuralDendrites(THREE, group, nodes, colors);
    } else {
      // Constellation already has per-star shader halos. A separate halo layer made
      // the mobile view read like blurry particles instead of the original star map.
    }
    group.add(addPoints(THREE, group, nodes, 'entity', colors.entity, threeVis.mode === 'neural' ? 30 : 52));
    group.add(addPoints(THREE, group, nodes, 'memory', colors.memory, threeVis.mode === 'neural' ? 26 : 50));
    const starCount = threeVis.mode === 'neural' ? 360 : 420;
    const starPositions = new Float32Array(starCount*3);
    for(let i=0;i<starCount;i++){ const r=600+((i*37)%480), a=i*2.17, b=((i*53)%180-90)*Math.PI/180; starPositions.set([Math.cos(a)*Math.cos(b)*r, Math.sin(b)*r, Math.sin(a)*Math.cos(b)*r], i*3); }
    const starGeom = new THREE.BufferGeometry(); starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions,3));
    scene.add(new THREE.Points(starGeom, new THREE.PointsMaterial({ color:0xffffff, map:makePointTexture(THREE, 'orb'), alphaTest:.04, size:1.25, transparent:true, opacity:threeVis.mode === 'neural' ? .38 : .24, depthWrite:false })));
    const pulseEdges = threeVis.mode === 'neural' ? edges.slice(0, 90) : [];
    const pulseGeom = new THREE.BufferGeometry(); const pulsePositions = new Float32Array(pulseEdges.length*3); pulseGeom.setAttribute('position', new THREE.BufferAttribute(pulsePositions,3));
    const pulsePoints = new THREE.Points(pulseGeom, new THREE.PointsMaterial({ color:colors.pulse, map:makePointTexture(THREE, 'star'), alphaTest:.03, size:threeVis.mode === 'neural' ? 10.5 : 5.2, transparent:true, opacity:threeVis.mode === 'neural' ? (colors.light ? .54 : .98) : .85, depthWrite:false, depthTest:false, blending:colors.light ? THREE.NormalBlending : THREE.AdditiveBlending })); group.add(pulsePoints);
    const labelNodes = nodes.filter(n => !/^[a-f0-9]{10,}$/i.test(String(n.label||''))).sort((a,b)=>(b._degree+b._weight)-(a._degree+a._weight)).slice(0, threeVis.mode === 'neural' ? 72 : 56);
    $('#threeLabels').innerHTML = neuralAuraOverlay(threeVis.neuralRegions) + labelNodes.map((n,i)=>`<span class="three-label ${n.kind === 'memory' ? 'memory' : ''}" data-i="${i}">${esc(String(n.label||'').replace(/^memory:/,'mem ').slice(0,24))}</span>`).join('');
    Object.assign(threeVis, { THREE, renderer, scene, camera, group, nodes, edgePairs:edges, labels:labelNodes, pulses:pulseEdges, pulsePoints, paused:prefersReducedMotion() });
    $('#threeClusters').innerHTML = (data.clusters || []).map(c => `<span class="cluster-pill">${esc(c.label)} <strong>${Number(c.count).toLocaleString()}</strong></span>`).join('');
    resetThreeCamera(); bindThreeControls(); resizeThree(); updateThreeUI(); animateThree(0);
  }
  function resizeThree(){
    if(!threeVis.renderer) return;
    const viewport = $('#threeViewport'); const rect = viewport.getBoundingClientRect();
    const w = Math.max(320, rect.width), h = Math.max(320, rect.height);
    threeVis.renderer.setSize(w,h,false); threeVis.camera.aspect = w/h; threeVis.camera.updateProjectionMatrix();
  }
  function threeEffectiveCameraZ(rect){
    const box = rect || $('#threeViewport')?.getBoundingClientRect?.() || {width:650,height:650};
    const fill = visualiserResponsiveFill(box.width, box.height);
    const mobile = box.width < 760 || box.height < 520;
    return threeVis.cameraZ / (mobile ? 1 : fill);
  }
  function updateThreeAuras(rect, projectVector){
    if(threeVis.mode !== 'neural') return;
    const mobile = rect.width < 520;
    $$('#threeLabels .three-aura-oval').forEach(el => {
      const region = el.dataset.region || '';
      const pts = threeVis.nodes.filter(n => n.neuralRegion === region);
      const screens = [];
      pts.forEach(n => {
        projectVector.set(n.x,n.y,n.z).applyMatrix4(threeVis.group.matrixWorld).project(threeVis.camera);
        if(projectVector.z < 1 && projectVector.z > -1) screens.push({ x:(projectVector.x*.5+.5)*rect.width, y:(-projectVector.y*.5+.5)*rect.height });
      });
      if(screens.length < 2){ el.style.opacity = '0'; return; }
      const xs = screens.map(p=>p.x), ys = screens.map(p=>p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const maxW = mobile ? rect.width * .62 : Math.min(340, rect.width * .34);
      const maxH = mobile ? rect.height * .30 : Math.min(230, rect.height * .26);
      const w = Math.max(mobile ? 92 : 128, Math.min(maxW, (maxX - minX) + (mobile ? 46 : 74)));
      const h = Math.max(mobile ? 58 : 78, Math.min(maxH, (maxY - minY) + (mobile ? 34 : 56)));
      el.style.left = `${cx}px`; el.style.top = `${cy}px`; el.style.width = `${w}px`; el.style.height = `${h}px`; el.style.opacity = screens.length > 4 ? '.42' : '.28';
    });
  }
  function updateThreeLabels(){
    if(!threeVis.camera || !threeVis.group) return;
    const viewport = $('#threeViewport'); const rect = viewport.getBoundingClientRect(); const v = new threeVis.THREE.Vector3();
    updateThreeAuras(rect, v);
    const labelBoxes = [];
    const effectiveCameraZ = threeEffectiveCameraZ(rect);
    const zoomReveal = threeVis.mode === 'neural' ? Math.max(0, Math.min(1, (900 - effectiveCameraZ) / 420)) : Math.max(0, Math.min(1, (760 - effectiveCameraZ) / 520));
    const maxLabels = threeVis.mode === 'neural' ? ((rect.width < 520 ? 14 : 24) + Math.round(zoomReveal * (rect.width < 520 ? 14 : 18))) : (rect.width < 520 ? (12 + Math.round(zoomReveal * 12)) : (20 + Math.round(zoomReveal * 18)));
    let shown = 0;
    $$('#threeLabels .three-label').forEach((el,i)=>{
      const n = threeVis.labels[i]; if(!n) return;
      v.set(n.x,n.y,n.z).applyMatrix4(threeVis.group.matrixWorld).project(threeVis.camera);
      const sx = (v.x*.5+.5)*rect.width, sy = (-v.y*.5+.5)*rect.height;
      const visible = v.z < 1 && v.z > -1 && sx > 8 && sx < rect.width - 8 && sy > 8 && sy < rect.height - 8;
      const pulse = threeVis.mode === 'neural' && i > 3 ? Math.sin((threeVis.lastT || 0) * .00032 + i * 1.73) : 1;
      const box = {x:sx-54,y:sy-13,w:108,h:24};
      const collides = labelBoxes.some(b => !(box.x+box.w<b.x || b.x+b.w<box.x || box.y+box.h<b.y || b.y+b.h<box.y));
      const show = visible && shown < maxLabels && !collides && (threeVis.mode !== 'neural' || i <= 3 || pulse > .08);
      el.style.display = show ? '' : 'none';
      if(show){
        shown++; labelBoxes.push(box);
        el.style.left = `${sx}px`; el.style.top = `${sy}px`;
        const depthAlpha = Math.max(.32, Math.min(.86, 1 - Math.abs(v.z)*.35));
        const pulseAlpha = threeVis.mode === 'neural' && i > 3 ? Math.min(.78, .38 + pulse * .36) : depthAlpha;
        el.style.opacity = String(Math.min(depthAlpha, pulseAlpha));
      }
    });
  }
  function animateThree(t=0){
    if(!threeVis.renderer) return;
    resizeThree();
    const delta = threeVis.lastT ? Math.min(48, t - threeVis.lastT) : 16; threeVis.lastT = t;
    if(!threeVis.paused && !threeVis.drag) threeVis.yaw += delta * (threeVis.mode === 'neural' ? .00009 : .000055);
    clampThreeCamera();
    threeVis.group.rotation.y = threeVis.yaw; threeVis.group.rotation.x = threeVis.pitch;
    const viewport = $('#threeViewport'); const rect = viewport?.getBoundingClientRect?.() || {width:650,height:650};
    const effectiveCameraZ = threeEffectiveCameraZ(rect);
    threeVis.camera.position.set(threeVis.panX, threeVis.panY, effectiveCameraZ); threeVis.camera.lookAt(threeVis.panX, threeVis.panY, 0);
    if(threeVis.pulsePoints && !threeVis.paused){
      const attr = threeVis.pulsePoints.geometry.attributes.position; const arr = attr.array;
      threeVis.pulses.forEach((e,i)=>{ const phase=(t*.00030 + (i%17)/17)%1; const inv=1-phase; if(e._curve){ arr[i*3]=inv*inv*e.a.x+2*inv*phase*e._curve.cx+phase*phase*e.b.x; arr[i*3+1]=inv*inv*e.a.y+2*inv*phase*e._curve.cy+phase*phase*e.b.y; arr[i*3+2]=inv*inv*e.a.z+2*inv*phase*e._curve.cz+phase*phase*e.b.z; } else { arr[i*3]=e.a.x+(e.b.x-e.a.x)*phase; arr[i*3+1]=e.a.y+(e.b.y-e.a.y)*phase; arr[i*3+2]=e.a.z+(e.b.z-e.a.z)*phase; } });
      attr.needsUpdate = true;
    }
    if(!threeVis.paused) threeVis.scene.traverse(obj => {
      if(obj.isPoints && obj.material?.uniforms?.uTime){
        obj.material.uniforms.uTime.value = t;
        obj.material.uniforms.uScale.value = Math.max(360, Math.min(820, threeVis.renderer.domElement.clientHeight || 420));
      }
    });
    threeVis.renderer.render(threeVis.scene, threeVis.camera); updateThreeLabels();
    threeVis.frame = document.hidden ? 0 : requestAnimationFrame(animateThree);
  }
  async function loadThreeVisualiser(){
    const labels = $('#threeLabels');
    if(labels) labels.innerHTML = '<div class="three-loading-card"><h3>Loading 3D visualiser…</h3><p>Fetching the render engine and memory graph.</p></div>';
    try {
      renderThreeVisualiser(await api('/api/constellation?limit=320'));
    } catch(e) {
      if(isCancelledRequest(e)) return;
      if(labels) labels.innerHTML = `<div class="three-fallback-card"><h3>Could not load the 3D visualiser</h3><p>${esc(e.message || 'Try again.')}</p></div>`;
    }
  }
  function switchThreeMode(mode){ threeVis.mode = mode === 'neural' ? 'neural' : 'constellation'; if(threeVis.data) renderThreeVisualiser(threeVis.data); else loadThreeVisualiser(); }
  function clampThreeCamera(){
    const viewport = $('#threeViewport'); const rect = viewport?.getBoundingClientRect?.() || {width:650,height:650};
    const fallbackZ = threeVis.mode === 'neural' ? 600 : 760;
    const minCameraZ = fallbackZ / 10;
    threeVis.cameraZ = Math.max(minCameraZ, Math.min(1800, Number.isFinite(threeVis.cameraZ) ? threeVis.cameraZ : fallbackZ));
    threeVis.yaw = Number.isFinite(threeVis.yaw) ? threeVis.yaw : 0;
    threeVis.pitch = Math.max(-1.15, Math.min(1.15, Number.isFinite(threeVis.pitch) ? threeVis.pitch : .32));
    const zoomFactor = 900 / Math.max(80, threeVis.cameraZ);
    const panLimitX = Math.max(120, rect.width * (.45 + zoomFactor * .18));
    const panLimitY = Math.max(120, rect.height * (.34 + zoomFactor * .12));
    threeVis.panX = Math.max(-panLimitX, Math.min(panLimitX, Number.isFinite(threeVis.panX) ? threeVis.panX : 0));
    threeVis.panY = Math.max(-panLimitY, Math.min(panLimitY, Number.isFinite(threeVis.panY) ? threeVis.panY : 0));
  }
  function bindThreeControls(){
    const viewport = $('#threeViewport'); if(!viewport || viewport.dataset.controlsBound === 'true') return; viewport.dataset.controlsBound = 'true';
    const pointers = threeVis.pointer || new Map(); threeVis.pointer = pointers;
    const dist = () => { const ps=[...pointers.values()]; return ps.length < 2 ? 1 : Math.max(1, Math.hypot(ps[0].x-ps[1].x, ps[0].y-ps[1].y)); };
    const center = () => { const ps=[...pointers.values()]; return ps.length < 2 ? {x:0,y:0} : {x:(ps[0].x+ps[1].x)/2, y:(ps[0].y+ps[1].y)/2}; };
    viewport.addEventListener('contextmenu', e=>e.preventDefault());
    viewport.addEventListener('wheel', e=>{ if(e.cancelable) e.preventDefault(); threeVis.cameraZ *= Math.exp(e.deltaY*.001); clampThreeCamera(); }, {passive:false});
    viewport.addEventListener('pointerdown', e=>{
      if(e.cancelable) e.preventDefault();
      try { viewport.setPointerCapture?.(e.pointerId); } catch(_err) {}
      pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
      if(pointers.size >= 2){ const c=center(); threeVis.drag={mode:'pinch',x:c.x,y:c.y,dist:dist(),cameraZ:threeVis.cameraZ,panX:threeVis.panX,panY:threeVis.panY,moved:false}; }
      else threeVis.drag = {mode:'drag',x:e.clientX,y:e.clientY,yaw:threeVis.yaw,pitch:threeVis.pitch,panX:threeVis.panX,panY:threeVis.panY,moved:false};
      viewport.style.cursor='grabbing';
    }, {passive:false});
    viewport.addEventListener('pointermove', e=>{
      if(!pointers.has(e.pointerId) || !threeVis.drag) return;
      if(e.cancelable) e.preventDefault();
      pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
      const d=threeVis.drag;
      if(d.mode === 'pinch'){
        if(pointers.size < 2) return;
        const c=center(); const scale=dist()/Math.max(1,d.dist);
        threeVis.cameraZ = d.cameraZ / Math.max(.35, Math.min(2.8, scale));
        threeVis.panX = d.panX - (c.x-d.x)*.72;
        threeVis.panY = d.panY + (c.y-d.y)*.72;
        d.moved = d.moved || Math.abs(c.x-d.x)+Math.abs(c.y-d.y)>3 || Math.abs(scale-1)>.015;
        clampThreeCamera(); return;
      }
      const dx=e.clientX-d.x, dy=e.clientY-d.y; if(Math.abs(dx)+Math.abs(dy)>3) d.moved=true;
      if(threeVis.panMode || e.shiftKey){ threeVis.panX=d.panX-dx*.7; threeVis.panY=d.panY+dy*.7; }
      else { threeVis.yaw=d.yaw+dx*.006; threeVis.pitch=d.pitch+dy*.004; }
      clampThreeCamera();
    }, {passive:false});
    const end=e=>{
      pointers.delete(e.pointerId);
      if(threeVis.drag?.moved) viewport.dataset.suppressClick='true';
      if(pointers.size === 1){ const p=[...pointers.values()][0]; threeVis.drag={mode:'drag',x:p.x,y:p.y,yaw:threeVis.yaw,pitch:threeVis.pitch,panX:threeVis.panX,panY:threeVis.panY,moved:true}; }
      else { threeVis.drag=null; viewport.style.cursor='grab'; }
    };
    viewport.addEventListener('pointerup', end); viewport.addEventListener('pointercancel', end); viewport.addEventListener('pointerleave', end);
    viewport.addEventListener('click', e=>{ if(viewport.dataset.suppressClick==='true'){ viewport.dataset.suppressClick='false'; return; } pickThreeNode(e); });
  }
  function pickThreeNode(e){
    if(!threeVis.camera || !threeVis.group) return;
    const rect = $('#threeViewport').getBoundingClientRect(); const mouseX=e.clientX-rect.left, mouseY=e.clientY-rect.top;
    const v = new threeVis.THREE.Vector3(); let best=null, bestD=Infinity;
    for(const n of threeVis.nodes){
      v.set(n.x,n.y,n.z).applyMatrix4(threeVis.group.matrixWorld).project(threeVis.camera);
      if(v.z < -1 || v.z > 1) continue;
      const sx=(v.x*.5+.5)*rect.width, sy=(-v.y*.5+.5)*rect.height; const d=Math.hypot(sx-mouseX, sy-mouseY);
      if(d < bestD && d < 18){ bestD=d; best=n; }
    }
    if(best) inspectThreeNode(best);
  }

  function togglePanMode(){
    threeVis.panMode = !threeVis.panMode;
    updateThreeUI();
  }

  function togglePause(){
    threeVis.paused = !threeVis.paused;
    updateThreeUI();
  }

  return {
    loadThreeVisualiser,
    resetThreeCamera,
    threeInspectorDefault,
    clearThreeScene,
    resizeThree,
    switchThreeMode,
    updateThreeUI,
    togglePanMode,
    togglePause,
    isRendering: () => Boolean(threeVis.renderer),
    resume: () => {
      if(threeVis.renderer && !threeVis.frame) threeVis.frame = requestAnimationFrame(animateThree);
    },
  };
}
