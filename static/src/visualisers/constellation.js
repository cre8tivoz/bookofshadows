const VISUALISER_MODE_KEY = 'mnemosyne-dashboard-visualiser-mode';
const CONSTELLATION_MIN_ZOOM = .55;
const CONSTELLATION_MAX_ZOOM = 6;
const CONSTELLATION_DEFAULT_CAMERA = { rotation: 0.55, tilt: 0.78, zoom: 1, panX: 0, panY: 0 };

export function createCanvasConstellationVisualiser({
  $,
  $$,
  api,
  esc,
  openMemoryDetail,
  switchTab,
  visualiserResponsiveFill,
  prefersReducedMotion,
  isActive,
}) {
  let constellationScene = { frame: 0, nodes: [], edges: [], byId: {}, stars: [], ...CONSTELLATION_DEFAULT_CAMERA, paused: false, mode: 'rotate', visualiserMode: localStorage.getItem(VISUALISER_MODE_KEY) || 'constellation', lastFrameTime: 0, lastInteraction: 0, hits: [], selectedNodeId: null, data: null, drag: null, pointers: new Map() };

  function stopCanvasVisualiserLoop(){
    if(constellationScene.frame) cancelAnimationFrame(constellationScene.frame);
    constellationScene.frame = 0;
    constellationScene.drag = null;
    constellationScene.pointers?.clear?.();
    constellationScene.lastFrameTime = 0;
    constellationScene.renderLastTime = 0;
  }

  function constellationInspectorDefault(){
    const neural = constellationScene.visualiserMode === 'neural';
    $('#constellationInspector').innerHTML = neural
      ? `<div class="inspector-kicker">Neural inspector</div><h3>Nothing selected</h3><p class="muted">Pick a neuron hub, memory soma, or synapse to inspect the underlying read-only source.</p>`
      : `<div class="inspector-kicker">Constellation inspector</div><h3>Nothing selected</h3><p class="muted">Pick a star, memory, or link to inspect the underlying read-only source.</p>`;
  }
  function inspectConstellationNode(node){
    constellationScene.selectedNodeId = node.id;
    $('#constellationInspector').innerHTML = `<div class="inspector-kicker">${esc(node.kind || 'entity')}</div><h3>${esc(node.label)}</h3><p class="muted">${esc(node.category || 'Other')} · ${Number(node.count || 0).toLocaleString()} signal(s) · weight ${Number(node.weight || 0).toFixed(2)}</p>${node.preview ? `<p>${esc(node.preview)}</p>` : ''}<div class="inspector-actions">${node.memory_id ? '<button id="constellationMemory" class="primary tiny">Open memory</button>' : ''}<button id="constellationSearch" class="tiny">Search this</button></div>`;
    if(node.memory_id) $('#constellationMemory').onclick = () => openMemoryDetail(node.memory_id);
    $('#constellationSearch').onclick = () => { $('#memoryQuery').value = node.label.replace(/^memory:/,''); switchTab('memories'); };
  }
  function openConstellationNode(node){
    if(!node) return;
    if(node.memory_id) openMemoryDetail(node.memory_id);
    else { $('#memoryQuery').value = String(node.label || '').replace(/^memory:/,''); switchTab('memories'); }
  }
  function constellationColors(){
    const light = document.documentElement.dataset.theme === 'light';
    return light ? { light:true, bg:'#fbf8f3', nebula:'rgba(101,214,255,.11)', star:'#087fa6', memory:'#c9a96e', text:'#2b2927', muted:'rgba(66,58,52,.62)', edge:'rgba(25,65,108,.50)', memoryEdge:'rgba(130,78,18,.48)' } : { light:false, bg:'#050711', nebula:'rgba(101,214,255,.14)', star:'#65d6ff', memory:'#ffe08a', text:'#f7f8ff', muted:'rgba(213,219,239,.64)', edge:'rgba(198,224,255,.44)', memoryEdge:'rgba(255,224,138,.50)' };
  }
  function projectConstellationNode(n, w, h, t){
    const rot = constellationScene.rotation;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const x = n.x * cos - n.z * sin;
    const z0 = n.x * sin + n.z * cos;
    const tilt = constellationScene.tilt;
    const y = n.y * Math.cos(tilt) - z0 * Math.sin(tilt);
    const z = n.y * Math.sin(tilt) + z0 * Math.cos(tilt);
    const depth = 760;
    const scale = depth / (depth + z + 260);
    const fill = visualiserResponsiveFill(w, h);
    const fit = w < 620 ? Math.min(.72, Math.max(.58, (w - 36) / 680)) : Math.min(1.18, Math.max(.62, (w - 72) / 760) * fill);
    const cameraScale = fit * constellationScene.zoom;
    return { x:w/2 + constellationScene.panX + x*scale*cameraScale, y:h/2 + constellationScene.panY + y*scale*cameraScale, z, scale:scale*constellationScene.zoom, visible:scale > .35 };
  }
  function buildConstellationScene(data){
    const nodes = (data.nodes || []).slice(0,160);
    const categories = [...new Set(nodes.map(n => n.category || 'Other'))];
    const catIndex = Object.fromEntries(categories.map((c,i)=>[c,i]));
    nodes.forEach((n,i) => {
      const ci = catIndex[n.category || 'Other'] || 0;
      const angle = (i / Math.max(nodes.length,1)) * Math.PI * 2 + ci * .62;
      const band = n.kind === 'memory' ? 1.28 : .72 + (ci % 4) * .16;
      const radius = 250 * band + (i % 7) * 16;
      n.x = Math.cos(angle) * radius;
      n.y = Math.sin(angle * 1.23) * (100 + (ci % 5) * 24) + (((i * 53) % 131) - 65) * .82;
      n.z = Math.sin(angle) * radius * .82 + (((i * 97) % 181) - 90) * 1.55 + ((ci % 5) - 2) * 42;
      n.size = Math.min(22, 4 + Math.sqrt(Number(n.weight || n.count || 1))*3.4) * (n.kind === 'memory' ? 1.08 : 1);
      n.twinkle = (i % 17) / 17;
      const twinkleTier = i % 11 === 0 ? 2 : (i % 5 === 0 ? 1 : 0);
      n.twinkleFreq = twinkleTier === 2 ? .0062 + ((i * 29) % 70) / 100000 : (twinkleTier === 1 ? .0030 + ((i * 29) % 80) / 100000 : .00115 + ((i * 29) % 95) / 100000);
      n.twinkleAmp = twinkleTier === 2 ? .18 : (twinkleTier === 1 ? .12 : .075 + ((i * 31) % 55) / 1000);
    });
    constellationScene.nodes = nodes;
    constellationScene.edges = (data.edges || []).filter(e => nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target)).slice(0,300);
    constellationScene.byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
    constellationScene.regions = [];
    constellationScene.data = data;
    constellationScene.stars = Array.from({length:140}, (_,i) => {
      const fast = i % 13 === 0;
      const medium = !fast && i % 6 === 0;
      return { x:((i*73)%1000)/1000, y:((i*191)%680)/680, r:.35 + ((i*37)%100)/90, a:.18 + ((i*29)%100)/240, phase:(i*47)%628/100, freq:fast ? .0058 + ((i*41)%80)/100000 : (medium ? .0027 + ((i*41)%90)/100000 : .00048 + ((i*41)%95)/100000) };
    });
  }
  function buildNeuralMapScene(data){
    const nodes = (data.nodes || []).slice(0,170).map(n => ({...n}));
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = (data.edges || []).filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)).slice(0,340);
    const categories = [...new Set(nodes.map(n => n.category || 'Other'))];
    const catIndex = Object.fromEntries(categories.map((c,i)=>[c,i]));
    const regionCount = Math.max(1, categories.length);
    const regions = Object.fromEntries(categories.map((cat, i) => {
      // Place category regions inside a real 3D ellipsoid rather than on a flat ring.
      // Golden-angle distribution gives an organic brain-cloud feel while remaining deterministic.
      const t = regionCount === 1 ? 0 : (i / Math.max(1, regionCount - 1)) * 2 - 1;
      const angle = -Math.PI / 2 + i * 2.399963;
      const radial = Math.sqrt(Math.max(0, 1 - t * t));
      const side = i % 2 === 0 ? -1 : 1;
      return [cat, {
        label:cat,
        angle,
        cx:Math.cos(angle) * radial * 230,
        cy:t * 150 + Math.sin(angle * .7) * 24,
        cz:Math.sin(angle) * radial * 190 + side * 28,
        spread:78 + (i % 4) * 12
      }];
    }));
    const degree = new Map();
    edges.forEach(e => { degree.set(e.source, (degree.get(e.source) || 0) + 1); degree.set(e.target, (degree.get(e.target) || 0) + 1); });
    const hubsByCategory = {};
    nodes.filter(n => n.kind !== 'memory').sort((a,b)=>(Number(b.weight || b.count || 0)+ (degree.get(b.id)||0)) - (Number(a.weight || a.count || 0)+(degree.get(a.id)||0))).forEach(n => {
      const cat = n.category || 'Other';
      if(!hubsByCategory[cat]) hubsByCategory[cat] = [];
      hubsByCategory[cat].push(n);
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
      n.twinkle = (i % 17) / 17;
      n.twinkleFreq = .0017 + ((i * 31) % 80) / 100000;
      n.twinkleAmp = .08 + ((i * 19) % 40) / 1000;
      n.neuralRegion = cat;
    });
    constellationScene.nodes = nodes;
    constellationScene.edges = edges;
    constellationScene.byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
    constellationScene.regions = Object.values(regions);
    constellationScene.data = data;
    constellationScene.stars = Array.from({length:60}, (_,i) => ({ x:((i*89)%1000)/1000, y:((i*157)%680)/680, r:.25 + ((i*17)%100)/120, a:.10 + ((i*23)%100)/340, phase:(i*41)%628/100, freq:.00045 + ((i*29)%70)/100000 }));
  }
  function projectNeuralNode(n, w, h){
    const fit = w < 620 ? Math.min(.88, Math.max(.62, (w - 38) / 620)) : Math.min(1.10, Math.max(.76, (w - 80) / 720));
    const cameraScale = fit * constellationScene.zoom;
    const x = Number(n.x || 0), y = Number(n.y || 0), z = Number(n.z || 0);
    const cosR=Math.cos(constellationScene.rotation || 0), sinR=Math.sin(constellationScene.rotation || 0);
    const xr=x*cosR - z*sinR, zr=x*sinR + z*cosR;
    const cosT=Math.cos(constellationScene.tilt || 0), sinT=Math.sin(constellationScene.tilt || 0);
    const yr=y*cosT - zr*sinT, zt=y*sinT + zr*cosT;
    const cameraDistance = w < 620 ? 760 : 980;
    const perspective = Math.max(.48, Math.min(1.85, cameraDistance / Math.max(260, cameraDistance - zt)));
    const depthAlpha = Math.max(.36, Math.min(1, .58 + zt / 620));
    return {
      x:w/2 + constellationScene.panX + xr*cameraScale*perspective,
      y:h/2 + constellationScene.panY + yr*cameraScale*perspective,
      z:zt,
      scale:cameraScale*perspective,
      alpha:depthAlpha,
      visible:true
    };
  }
  function drawSynapse(ctx, a, b, e, c, t, compactCanvas, pulse=false){
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    const dx=b.x-a.x, dy=b.y-a.y;
    const len=Math.max(1, Math.hypot(dx,dy));
    const curve=Math.min(compactCanvas ? 30 : 48, len*.16) * (((e.id || '').length % 2) ? 1 : -1);
    const cx=mx - dy/len*curve, cy=my + dx/len*curve;
    const depth=Math.min(1, Math.max(.42, ((a.alpha || 1) + (b.alpha || 1)) / 2));
    ctx.strokeStyle=e.kind === 'memory' ? c.memorySynapse : c.synapse;
    ctx.globalAlpha=(compactCanvas ? .24 : .30) * depth;
    ctx.lineWidth=compactCanvas ? .66 : .82;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.quadraticCurveTo(cx,cy,b.x,b.y); ctx.stroke();
    if(!pulse) return;
    const phase=((t*.00012 + ((e.id || '').length % 17)/17) % 1);
    const inv=1-phase;
    const qx=inv*inv*a.x + 2*inv*phase*cx + phase*phase*b.x;
    const qy=inv*inv*a.y + 2*inv*phase*cy + phase*phase*b.y;
    ctx.globalAlpha=(compactCanvas ? .36 : .54) * depth;
    ctx.fillStyle=e.kind === 'memory' ? c.memory : c.star;
    ctx.beginPath(); ctx.arc(qx,qy,compactCanvas ? 1.55 : 2.15,0,Math.PI*2); ctx.fill();
  }
  function drawNeuronSoma(ctx, n, p, c, t, compactCanvas, fast=false){
    const weight=Math.max(1, Number(n.weight || n.count || 1));
    const base=n.kind === 'memory' ? c.memory : c.star;
    const r=Math.min(compactCanvas ? 7.5 : 11, Math.max(compactCanvas ? 3.4 : 4.6, (2.8 + Math.sqrt(weight)*1.15) * p.scale));
    const pulse=1 + Math.sin(t*(n.twinkleFreq || .0017) + n.twinkle*6.28)*(n.twinkleAmp || .07);
    const somaR=r*pulse;
    const halo=somaR*(n.kind === 'memory' ? 2.0 : 2.4);
    const depthAlpha = p.alpha || 1;
    if(fast){
      ctx.globalAlpha=(c.light ? .34 : .48) * depthAlpha;
      ctx.fillStyle=base;
      ctx.beginPath(); ctx.arc(p.x,p.y,somaR*.92,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=.88 * depthAlpha;
      ctx.fillStyle='rgba(255,255,255,.82)';
      ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(.65,somaR*.30),0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      return { r:somaR, halo };
    }
    const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,halo);
    glow.addColorStop(0,'rgba(255,255,255,.82)');
    glow.addColorStop(.20,base);
    glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=(c.light ? .20 : .30) * depthAlpha;
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(p.x,p.y,halo,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate((n.twinkle || 0)*Math.PI*2 + t*.00004);
    ctx.strokeStyle=base; ctx.lineCap='round'; ctx.shadowColor=base; ctx.shadowBlur=compactCanvas ? 5 : 8;
    const dendrites=n.kind === 'memory' ? 3 : 6;
    for(let i=0;i<dendrites;i++){
      const a=(i/dendrites)*Math.PI*2 + Math.sin(t*.00018+i)*.10;
      const length=somaR*(n.kind === 'memory' ? 1.55 : 2.15) + (i%3)*2.5;
      ctx.globalAlpha=(c.light ? .22 : .34) * depthAlpha;
      ctx.lineWidth=Math.max(.55,somaR*.10);
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*somaR*.72, Math.sin(a)*somaR*.72); ctx.lineTo(Math.cos(a)*length, Math.sin(a)*length); ctx.stroke();
      if(n.kind !== 'memory'){
        ctx.globalAlpha=(c.light ? .16 : .24) * depthAlpha;
        const fork=length*.72;
        ctx.beginPath(); ctx.moveTo(Math.cos(a)*fork, Math.sin(a)*fork); ctx.lineTo(Math.cos(a+.38)*length*.96, Math.sin(a+.38)*length*.96); ctx.stroke();
      }
    }
    ctx.globalAlpha=.96 * depthAlpha; ctx.fillStyle='rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(0,0,somaR*.88,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=.78 * depthAlpha; ctx.fillStyle=base; ctx.beginPath(); ctx.arc(0,0,somaR*.58,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=.72 * depthAlpha; ctx.fillStyle=c.bg; ctx.beginPath(); ctx.arc(-somaR*.16,-somaR*.18,somaR*.18,0,Math.PI*2); ctx.fill();
    ctx.restore();
    return { r:somaR, halo };
  }

  function neuralFastMode(t=performance.now()){
    return constellationScene.visualiserMode === 'neural' && (Boolean(constellationScene.drag) || t - (constellationScene.lastInteraction || 0) < 220);
  }
  function visualiserDpr(compactCanvas, mode){
    const raw = window.devicePixelRatio || 1;
    if(mode === 'neural') return Math.min(raw, compactCanvas ? 1.8 : 1.25);
    return Math.min(raw, compactCanvas ? 2 : 1.5);
  }
  function drawNeuralFrame(t=0){
    const canvas = $('#constellationCanvas');
    if(!canvas) return;
    const wrap = canvas.parentElement;
    const w = Math.max(320, wrap.clientWidth || canvas.clientWidth || 1000);
    const h = Math.max(430, wrap.clientHeight || canvas.clientHeight || 680);
    const compactCanvas = w < 620;
    const dpr = visualiserDpr(compactCanvas, 'neural');
    if(canvas.width !== Math.floor(w*dpr) || canvas.height !== Math.floor(h*dpr)){ canvas.width = Math.floor(w*dpr); canvas.height = Math.floor(h*dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const c = neuralColors();
    const fast = false;
    if(!constellationScene.paused && !constellationScene.drag && !prefersReducedMotion()){
      const delta = constellationScene.lastFrameTime ? Math.min(48, t - constellationScene.lastFrameTime) : 16;
      constellationScene.rotation += delta * 0.000032;
    }
    constellationScene.lastFrameTime = t;
    clampConstellationCamera(w, h);
    ctx.clearRect(0,0,w,h);
    const bg = ctx.createRadialGradient(w*.48,h*.44,18,w*.48,h*.44,Math.max(w,h)*.78);
    bg.addColorStop(0, c.core);
    bg.addColorStop(.48, c.mid);
    bg.addColorStop(1, c.bg);
    ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
    constellationScene.stars.forEach((s)=>{ const pulse=.50 + Math.sin(t*s.freq + s.phase)*.30; ctx.globalAlpha=s.a*Math.max(.10, pulse)*(c.light ? .35 : .55); ctx.fillStyle=c.text; ctx.beginPath(); ctx.arc(s.x*w, s.y*h, s.r*(c.light ? .55 : .75), 0, Math.PI*2); ctx.fill(); });
    ctx.globalAlpha=1;
    const projected = new Map();
    constellationScene.nodes.forEach(n => projected.set(n.id, projectNeuralNode(n,w,h)));
    (constellationScene.regions || []).slice(0,10).forEach((region, i) => {
      const rp = projectNeuralNode({x:region.cx,y:region.cy,z:region.cz || 0},w,h);
      const rx = (region.spread || 82) * (compactCanvas ? 1.20 : 1.55) * rp.scale;
      const ry = (region.spread || 82) * (compactCanvas ? .76 : .98) * rp.scale;
      const hue = i % 3;
      const fill = c.light
        ? (hue === 0 ? 'rgba(76,171,158,.075)' : hue === 1 ? 'rgba(101,214,255,.065)' : 'rgba(255,209,102,.060)')
        : (hue === 0 ? 'rgba(76,171,158,.115)' : hue === 1 ? 'rgba(101,214,255,.092)' : 'rgba(255,209,102,.070)');
      ctx.save();
      ctx.translate(rp.x,rp.y);
      ctx.rotate(region.angle*.42);
      ctx.globalAlpha=1;
      ctx.fillStyle=fill;
      ctx.beginPath();
      ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
      ctx.fill();
      ctx.globalAlpha=c.light ? .14 : .18;
      ctx.strokeStyle=hue === 2 ? c.memorySynapse : c.synapseHot;
      ctx.lineWidth=.8;
      ctx.beginPath(); ctx.ellipse(0,0,rx*.72,ry*.72,0,0,Math.PI*2); ctx.stroke();
      if(!compactCanvas && region.label){
        ctx.globalAlpha=c.light ? .32 : .28;
        ctx.fillStyle=c.text;
        ctx.font='10px Inter, system-ui, sans-serif';
        ctx.fillText(region.label.slice(0,22), -rx*.42, -ry*.48);
      }
      ctx.restore();
    });
    const edgeDegree = new Map();
    let edgeDrawn = 0;
    const edgeLimit = fast ? (compactCanvas ? 48 : 112) : (compactCanvas ? 58 : 132);
    const degreeLimit = fast ? (compactCanvas ? 3 : 4) : (compactCanvas ? 3 : 5);
    for(const e of constellationScene.edges){
      const a=projected.get(e.source), b=projected.get(e.target);
      if(!a || !b) continue;
      if(edgeDrawn >= edgeLimit) break;
      const da=edgeDegree.get(e.source) || 0, db=edgeDegree.get(e.target) || 0;
      if(da >= degreeLimit || db >= degreeLimit) continue;
      edgeDegree.set(e.source, da+1); edgeDegree.set(e.target, db+1); edgeDrawn++;
      const pulseStride = compactCanvas ? 4 : 3;
      const pulseLimit = compactCanvas ? 24 : 72;
      const shouldPulse = edgeDrawn <= (fast ? Math.floor(pulseLimit * .75) : pulseLimit) && ((edgeDrawn + ((e.id || '').length % pulseStride)) % pulseStride === 0);
      drawSynapse(ctx,a,b,e,c,t,compactCanvas,shouldPulse);
    }
    ctx.globalAlpha=1; ctx.setLineDash([]);
    const hits=[];
    const labelBoxes=[];
    const nodeDegrees = new Map();
    constellationScene.edges.forEach(e => { nodeDegrees.set(e.source, (nodeDegrees.get(e.source) || 0) + 1); nodeDegrees.set(e.target, (nodeDegrees.get(e.target) || 0) + 1); });
    [...constellationScene.nodes].sort((a,b)=>(Number(a.z||0)-Number(b.z||0))).forEach(n => {
      const p=projected.get(n.id); if(!p) return;
      const drawn=drawNeuronSoma(ctx,n,p,c,t,compactCanvas,fast);
      if(n.id === constellationScene.selectedNodeId){
        ctx.globalAlpha=.92;
        ctx.strokeStyle=c.memory;
        ctx.lineWidth=compactCanvas ? 2 : 2.5;
        ctx.setLineDash([5,4]);
        ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(18, drawn.halo*.72),0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha=1;
      }
      const labelRaw=(n.label || '').replace(/^memory:/,'mem ');
      const compactRaw=labelRaw.trim();
      const alphaChars=(compactRaw.match(/[A-Za-z]/g) || []).length;
      const isHashLike=/^[a-f0-9]{10,}$/i.test(compactRaw) || /^mem\s+[a-f0-9]{6,}$/i.test(compactRaw);
      const isMachineToken=/^[A-Z0-9_:/.-]{14,}$/.test(compactRaw) && /[_:/.-]/.test(compactRaw);
      const degree=nodeDegrees.get(n.id) || 0;
      const weight=Math.max(1, Number(n.weight || n.count || 1));
      const showLabel = !isHashLike && !isMachineToken && alphaChars >= 4 && (compactCanvas ? (n.kind !== 'memory' && (weight > 7.2 || degree > 2)) : (degree > 1 || weight > 4.2 || n.kind !== 'memory'));
      if(showLabel){
        const label=/^[A-Z][A-Z_\s-]{2,}$/.test(labelRaw) ? labelRaw.toLowerCase().replace(/(^|[_\s-])([a-z])/g, (_m, sep, ch) => (sep === '_' ? ' ' : sep) + ch.toUpperCase()) : labelRaw;
        const short=label.length>22?label.slice(0,19)+'…':label;
        ctx.font=`${Math.round((compactCanvas ? 9 : 10) + Math.min(3,Math.sqrt(weight)))}px Inter, system-ui, sans-serif`;
        const lx=p.x+drawn.halo*.55+6, ly=p.y+4, tw=ctx.measureText(short).width;
        const box={x:lx-4,y:ly-14,w:tw+8,h:19};
        const onCanvas=box.x>=10 && box.x+box.w<=w-10 && box.y>=10 && box.y+box.h<=h-10;
        const collides=labelBoxes.some(b => !(box.x+box.w<b.x || b.x+b.w<box.x || box.y+box.h<b.y || b.y+b.h<box.y));
        if(onCanvas && !collides){ labelBoxes.push(box); ctx.lineWidth=5; ctx.strokeStyle=c.bg; ctx.fillStyle=c.text; ctx.globalAlpha=Math.min(.82,.40+p.scale*.32) * (p.alpha || 1); ctx.strokeText(short,lx,ly); ctx.fillText(short,lx,ly); ctx.globalAlpha=1; }
      }
      hits.push({x:p.x,y:p.y,r:Math.max(15,drawn.halo*.75),node:n});
    });
    constellationScene.hits=hits;
    if(!prefersReducedMotion() && !document.hidden && isActive()) constellationScene.frame=requestAnimationFrame(drawVisualiserFrame);
  }
  function neuralColors(){
    const light = document.documentElement.dataset.theme === 'light';
    return light ? { light:true, bg:'#f7f0e7', core:'rgba(24,128,107,.18)', mid:'rgba(185,54,46,.12)', star:'#087f73', memory:'#c63e35', text:'#252220', synapse:'rgba(18,116,100,.34)', synapseHot:'rgba(8,126,106,.62)', memorySynapse:'rgba(190,54,46,.58)' } : { light:false, bg:'#06100f', core:'rgba(34,130,111,.28)', mid:'rgba(95,31,29,.40)', star:'#66e8c6', memory:'#ff5f57', text:'#f6fbf7', synapse:'rgba(82,214,181,.22)', synapseHot:'rgba(90,238,196,.52)', memorySynapse:'rgba(255,95,87,.58)' };
  }
  function updateVisualiserModeUI(){
    const mode = constellationScene.visualiserMode === 'neural' ? 'neural' : 'constellation';
    $$('.visualiser-tabs button[data-visualiser]').forEach(b => { const active = b.dataset.visualiser === mode; b.classList.toggle('active', active); b.setAttribute('aria-selected', String(active)); });
    const wrap = $('#constellationCanvas')?.parentElement;
    if(wrap) wrap.dataset.visualiser = mode;
    const legend = $('.constellation-legend');
    if(legend) legend.innerHTML = mode === 'neural'
      ? '<span><i class="legend-dot entity"></i>Neuron hub</span><span><i class="legend-dot memory"></i>Memory soma</span><span><i class="legend-line"></i>Synapse</span>'
      : '<span><i class="legend-dot entity"></i>Entity/topic</span><span><i class="legend-dot memory"></i>Memory</span><span><i class="legend-line"></i>Link</span>';
    const help = $('#visualiserHelp');
    if(help) help.textContent = mode === 'neural' ? (window.matchMedia('(max-width: 760px)').matches ? 'Drag to orbit · Pan mode to move · pinch to zoom · tap a neuron.' : 'Drag to orbit the neural cloud · Pan mode/Shift-drag to pan · wheel/pinch to zoom.') : 'Drag to rotate · Pan mode/Shift-drag to pan · wheel/pinch to zoom.';
    const pause = $('#constellationPause');
    if(pause){ pause.style.display = ''; pause.textContent = constellationScene.paused ? (mode === 'neural' ? 'Resume drift' : 'Resume rotation') : (mode === 'neural' ? 'Pause drift' : 'Pause rotation'); }
    const pan = $('#constellationPanMode');
    if(pan) pan.textContent = constellationScene.mode === 'pan' ? (mode === 'neural' ? 'Orbit mode' : 'Rotate mode') : 'Pan mode';
  }
  function switchVisualiserMode(mode){
    constellationScene.visualiserMode = mode === 'neural' ? 'neural' : 'constellation';
    localStorage.setItem(VISUALISER_MODE_KEY, constellationScene.visualiserMode);
    constellationScene.drag = null;
    constellationScene.pointers.clear();
    Object.assign(constellationScene, constellationScene.visualiserMode === 'neural' ? { rotation:.34, tilt:.38, zoom:1, panX:0, panY:0, mode:'rotate', lastFrameTime:0, renderLastTime:0 } : { ...CONSTELLATION_DEFAULT_CAMERA, mode:'rotate', lastFrameTime:0, renderLastTime:0 });
    updateVisualiserModeUI();
    if(constellationScene.data) drawConstellation(constellationScene.data);
  }
  function drawVisualiserFrame(t=0){
    if(!isActive()){ stopCanvasVisualiserLoop(); return; }
    const mode = constellationScene.visualiserMode === 'neural' ? 'neural' : 'constellation';
    const interval = 16;
    if(t && constellationScene.renderLastTime && t - constellationScene.renderLastTime < interval){
      constellationScene.frame = isActive() && !document.hidden ? requestAnimationFrame(drawVisualiserFrame) : 0;
      return;
    }
    constellationScene.renderLastTime = t || 0;
    if(mode === 'neural') drawNeuralFrame(t);
    else drawConstellationFrame(t);
  }
  function drawConstellationFrame(t=0){
    const canvas = $('#constellationCanvas');
    if(!canvas) return;
    const wrap = canvas.parentElement;
    // Use content-box dimensions only. getBoundingClientRect() includes the
    // wrapper border; writing that value back to canvas.style.height creates a
    // per-frame growth loop on mobile.
    const w = Math.max(320, wrap.clientWidth || canvas.clientWidth || 1000);
    const h = Math.max(430, wrap.clientHeight || canvas.clientHeight || 680);
    const compactCanvas = w < 620;
    const dpr = visualiserDpr(compactCanvas, 'constellation');
    if(canvas.width !== Math.floor(w*dpr) || canvas.height !== Math.floor(h*dpr)){ canvas.width = Math.floor(w*dpr); canvas.height = Math.floor(h*dpr); }
    const ctx = canvas.getContext('2d');
    if(!constellationScene.paused && !constellationScene.drag){
      const delta = constellationScene.lastFrameTime ? Math.min(48, t - constellationScene.lastFrameTime) : 16;
      constellationScene.rotation += delta * 0.000065;
    }
    constellationScene.lastFrameTime = t;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const c = constellationColors();
    clampConstellationCamera(w, h);
    ctx.clearRect(0,0,w,h);
    const bg = ctx.createRadialGradient(w*.52,h*.44,20,w*.52,h*.44,Math.max(w,h)*.72);
    bg.addColorStop(0, compactCanvas ? 'rgba(101,214,255,.055)' : c.nebula); bg.addColorStop(.45, compactCanvas ? 'rgba(60,110,150,.018)' : 'rgba(72,130,160,.035)'); bg.addColorStop(1,c.bg);
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
    constellationScene.stars.forEach((s)=>{ const pulse=.42 + Math.sin(t*s.freq + s.phase)*.34 + Math.sin(t*s.freq*.37 + s.phase*1.9)*.18; ctx.globalAlpha=s.a*Math.max(.12, Math.min(1, pulse))*(c.light ? .48 : .78); ctx.fillStyle=c.text; ctx.beginPath(); ctx.arc(s.x*w, s.y*h, s.r*(c.light ? .72 : .9), 0, Math.PI*2); ctx.fill(); });
    ctx.globalAlpha=1;
    const projected = new Map();
    constellationScene.nodes.forEach(n => projected.set(n.id, projectConstellationNode(n,w,h,t)));
    const edgeDegree = new Map();
    let edgeDrawn = 0;
    const edgeLimit = compactCanvas ? 44 : 140;
    const degreeLimit = compactCanvas ? 2 : 4;
    for(const e of constellationScene.edges){
      const a=projected.get(e.source), b=projected.get(e.target);
      if(!a || !b || !a.visible || !b.visible) continue;
      if(edgeDrawn >= edgeLimit) break;
      const da=edgeDegree.get(e.source) || 0, db=edgeDegree.get(e.target) || 0;
      if(da >= degreeLimit || db >= degreeLimit) continue;
      edgeDegree.set(e.source, da+1); edgeDegree.set(e.target, db+1); edgeDrawn++;
      const depthAlpha = Math.min(c.light ? .58 : .58, Math.max(c.light ? .24 : .24, (a.scale+b.scale) / (c.light ? 5.4 : 5.2)));
      ctx.strokeStyle = e.kind === 'memory' ? c.memoryEdge : c.edge;
      ctx.globalAlpha = depthAlpha * (compactCanvas ? .74 : .92);
      ctx.lineWidth = (c.light ? .68 : .78) + Math.max(a.scale,b.scale) * (c.light ? .20 : .26);
      ctx.setLineDash(e.kind === 'memory' ? [5,7] : [4,8]);
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
    ctx.globalAlpha=1;
    ctx.setLineDash([]);
    const hits=[];
    const labelBoxes=[];
    const compactLabels = compactCanvas;
    const nodeDegrees = new Map();
    constellationScene.edges.forEach(e => { nodeDegrees.set(e.source, (nodeDegrees.get(e.source) || 0) + 1); nodeDegrees.set(e.target, (nodeDegrees.get(e.target) || 0) + 1); });
    const labelCounts = new Map();
    const categoryCounts = new Map();
    constellationScene.nodes.forEach(n => {
      const key=(n.label || '').replace(/^memory:/,'mem ').trim().toLowerCase();
      if(key) labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
      const category=(n.category || '').trim().toLowerCase();
      if(category) categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });
    [...constellationScene.nodes].sort((a,b)=>projected.get(a.id).z-projected.get(b.id).z).forEach(n => {
      const p=projected.get(n.id); if(!p?.visible) return;
      const base=n.kind === 'memory' ? c.memory : c.star;
      const pulse=1 + Math.sin(t*(n.twinkleFreq || .0017) + n.twinkle*6.28)*(n.twinkleAmp || .09) + Math.sin(t*(n.twinkleFreq || .0017)*.43 + n.twinkle*11.7)*((n.twinkleAmp || .09)*.48);
      const weight = Math.max(1, Number(n.weight || n.count || 1));
      const starR = Math.min(compactCanvas ? 3.2 : 4.6, Math.max(compactCanvas ? .85 : 1.05, (1 + Math.sqrt(weight)) * p.scale * (compactCanvas ? .42 : .54))) * pulse;
      const important = weight > 3.2 || n.kind === 'memory';
      const flare = Math.min(compactCanvas ? 8.5 : 12.5, starR * (important ? 2.45 : 1.65));
      const halo = Math.max(2.4, starR * (important ? 3.2 : 2.35));
      ctx.globalAlpha=Math.max(c.light ? .14 : .10, Math.min(compactCanvas ? .28 : .34, p.scale * (compactCanvas ? .18 : .24)));
      const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,halo);
      glow.addColorStop(0,'rgba(255,255,255,.92)'); glow.addColorStop(.18,base); glow.addColorStop(.62,base); glow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(p.x,p.y,halo,0,Math.PI*2); ctx.fill();
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(t*.00012 + n.twinkle*Math.PI);
      ctx.shadowColor=base;
      ctx.shadowBlur=compactCanvas ? 3 : 5;
      ctx.strokeStyle=base;
      ctx.lineCap='round';
      const majorStar = weight > (compactCanvas ? 7.5 : 6.2) || (n.kind === 'memory' && weight > (compactCanvas ? 5.6 : 4.8));
      if(majorStar){
        ctx.globalAlpha=Math.max(.34, Math.min(.68, p.scale*.60));
        ctx.lineWidth=Math.max(.45, starR*.18);
        ctx.beginPath(); ctx.moveTo(-flare,0); ctx.lineTo(flare,0); ctx.moveTo(0,-flare); ctx.lineTo(0,flare); ctx.stroke();
        ctx.globalAlpha=Math.max(.16, Math.min(.36, p.scale*.32));
        ctx.lineWidth=Math.max(.35, starR*.13);
        const diag=flare*.45;
        ctx.beginPath(); ctx.moveTo(-diag,-diag); ctx.lineTo(diag,diag); ctx.moveTo(-diag,diag); ctx.lineTo(diag,-diag); ctx.stroke();
      }
      ctx.shadowBlur=compactCanvas ? 5 : 7;
      ctx.globalAlpha=.96;
      ctx.fillStyle='rgba(255,255,255,.98)';
      ctx.beginPath(); ctx.arc(0,0,Math.max(.62, starR*.52),0,Math.PI*2); ctx.fill();
      ctx.fillStyle=base;
      ctx.globalAlpha=.72;
      ctx.beginPath(); ctx.arc(0,0,Math.max(.28, starR*.20),0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      ctx.restore();
      if(n.id === constellationScene.selectedNodeId){
        ctx.globalAlpha=.92;
        ctx.strokeStyle=c.memory;
        ctx.lineWidth=compactCanvas ? 2 : 2.5;
        ctx.setLineDash([5,4]);
        ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(16,flare+5),0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha=1;
      }
      const labelRaw=(n.label || '').replace(/^memory:/,'mem ');
      const labelKey=labelRaw.trim().toLowerCase();
      const compactRaw=labelRaw.trim();
      const alphaChars=(compactRaw.match(/[A-Za-z]/g) || []).length;
      const isHashLike=/^[a-f0-9]{10,}$/i.test(compactRaw) || /^mem\s+[a-f0-9]{6,}$/i.test(compactRaw);
      const isMachineToken=/^[A-Z0-9_:/.-]{14,}$/.test(compactRaw) && /[_:/.-]/.test(compactRaw);
      const isDateLike=/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(compactRaw);
      const lowInformation=alphaChars < 4;
      const technicalLabel=isHashLike || isMachineToken || isDateLike || lowInformation;
      const degree = nodeDegrees.get(n.id) || 0;
      const frequency = labelCounts.get(labelKey) || 1;
      const categoryFrequency = categoryCounts.get((n.category || '').trim().toLowerCase()) || 1;
      const dominantCategory = categoryFrequency > constellationScene.nodes.length * .35;
      const shoutingDominantToken = /^[A-Z]{4,}$/.test(compactRaw) && dominantCategory;
      const specificity = Math.max(.35, Math.min(1.15, 1 / Math.sqrt(frequency)));
      const categorySpecificity = Math.max(.05, Math.min(1.10, Math.log1p(constellationScene.nodes.length / categoryFrequency) / 2.4));
      const lengthQuality = Math.max(.25, Math.min(1.1, (alphaChars - 2) / 8));
      const labelScore = (p.scale * 2.05) + (Math.log1p(weight) * .52) + (Math.log1p(degree) * .38) + specificity + categorySpecificity + lengthQuality + (n.kind === 'memory' ? .15 : 0) - (shoutingDominantToken ? 1.25 : 0);
      const showLabel = !technicalLabel && (compactLabels ? labelScore > 4.15 : labelScore > 3.95);
      if(showLabel){
        const label=/^[A-Z][A-Z_\s-]{2,}$/.test(labelRaw) ? labelRaw.toLowerCase().replace(/(^|[_\s-])([a-z])/g, (_m, sep, ch) => (sep === '_' ? ' ' : sep) + ch.toUpperCase()) : labelRaw;
        const short=label.length>22?label.slice(0,19)+'…':label;
        ctx.font=`${Math.round((compactLabels ? 9 : 10) + p.scale*2.5)}px Inter, system-ui, sans-serif`;
        const lx=p.x+flare+6, ly=p.y+4, tw=ctx.measureText(short).width;
        const labelPad = compactLabels ? 4 : 4;
        const box={x:lx-labelPad,y:ly-(compactLabels ? 13 : 14),w:tw+labelPad*2,h:compactLabels ? 18 : 19};
        const onCanvas=box.x>=10 && box.x+box.w<=w-10 && box.y>=10 && box.y+box.h<=h-10;
        const collides=labelBoxes.some(b => !(box.x+box.w<b.x || b.x+b.w<box.x || box.y+box.h<b.y || b.y+b.h<box.y));
        if(onCanvas && !collides){ labelBoxes.push(box); ctx.lineWidth=5; ctx.strokeStyle=c.bg; ctx.fillStyle=c.text; ctx.globalAlpha=Math.min(.78,.30+p.scale*.42); ctx.strokeText(short,lx,ly); ctx.fillText(short,lx,ly); ctx.globalAlpha=1; }
      }
      hits.push({x:p.x,y:p.y,r:Math.max(14,flare+8),node:n});
    });
    constellationScene.hits=hits;
    if(!prefersReducedMotion() && !document.hidden && isActive()) constellationScene.frame=requestAnimationFrame(drawVisualiserFrame);
  }
  function clampConstellationCamera(w, h){
    constellationScene.zoom = Math.max(CONSTELLATION_MIN_ZOOM, Math.min(CONSTELLATION_MAX_ZOOM, Number.isFinite(constellationScene.zoom) ? constellationScene.zoom : 1));
    constellationScene.rotation = Number.isFinite(constellationScene.rotation) ? constellationScene.rotation : 0;
    constellationScene.tilt = Math.max(-1.05, Math.min(1.05, Number.isFinite(constellationScene.tilt) ? constellationScene.tilt : .35));
    const panLimitX = Math.max(80, w * (.24 + constellationScene.zoom * .22));
    const panLimitY = Math.max(90, h * (.16 + constellationScene.zoom * .14));
    constellationScene.panX = Math.max(-panLimitX, Math.min(panLimitX, Number.isFinite(constellationScene.panX) ? constellationScene.panX : 0));
    constellationScene.panY = Math.max(-panLimitY, Math.min(panLimitY, Number.isFinite(constellationScene.panY) ? constellationScene.panY : 0));
  }
  function resetConstellationView(){
    Object.assign(constellationScene, constellationScene.visualiserMode === 'neural' ? { rotation:.34, tilt:.38, zoom:1, panX:0, panY:0, mode:'rotate', drag:null, lastFrameTime:0, renderLastTime:0 } : { ...CONSTELLATION_DEFAULT_CAMERA, mode:'rotate', drag:null, lastFrameTime:0, renderLastTime:0 });
    constellationScene.pointers.clear();
    updateConstellationPauseButton();
    updateConstellationPanButton();
    updateVisualiserModeUI();
  }
  function updateConstellationPauseButton(){
    const btn = $('#constellationPause');
    if(btn) btn.textContent = constellationScene.paused ? (constellationScene.visualiserMode === 'neural' ? 'Resume drift' : 'Resume rotation') : (constellationScene.visualiserMode === 'neural' ? 'Pause drift' : 'Pause rotation');
  }
  function updateConstellationPanButton(){
    const btn = $('#constellationPanMode');
    if(btn) btn.textContent = constellationScene.mode === 'pan' ? (constellationScene.visualiserMode === 'neural' ? 'Orbit mode' : 'Rotate mode') : 'Pan mode';
  }
  function toggleConstellationPanMode(){
    constellationScene.mode = constellationScene.mode === 'pan' ? 'rotate' : 'pan';
    updateConstellationPanButton();
  }
  function toggleConstellationPause(){
    constellationScene.paused = !constellationScene.paused;
    constellationScene.lastFrameTime = 0;
    updateConstellationPauseButton();
  }
  function zoomConstellation(factor, cx, cy){
    constellationScene.lastInteraction = performance.now();
    const canvas = $('#constellationCanvas');
    if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const oldZoom = constellationScene.zoom;
    const nextZoom = Math.max(CONSTELLATION_MIN_ZOOM, Math.min(CONSTELLATION_MAX_ZOOM, oldZoom * factor));
    if(Math.abs(nextZoom - oldZoom) < .001) return;
    const x = cx - rect.left - rect.width/2 - constellationScene.panX;
    const y = cy - rect.top - rect.height/2 - constellationScene.panY;
    const ratio = nextZoom / oldZoom;
    constellationScene.panX -= x * (ratio - 1);
    constellationScene.panY -= y * (ratio - 1);
    constellationScene.zoom = nextZoom;
    clampConstellationCamera(rect.width, rect.height);
  }
  function keyboardSelectableHits(){
    const seen = new Set();
    return (constellationScene.hits || []).filter(hit => {
      const id = hit.node?.id;
      if(!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  function selectConstellationHit(delta=1){
    const hits = keyboardSelectableHits();
    if(!hits.length) return;
    const current = Math.max(0, hits.findIndex(hit => hit.node?.id === constellationScene.selectedNodeId));
    const index = (current + delta + hits.length) % hits.length;
    inspectConstellationNode(hits[index].node);
    redraw();
  }
  function selectedConstellationNode(){
    const hits = keyboardSelectableHits();
    return hits.find(hit => hit.node?.id === constellationScene.selectedNodeId)?.node || hits[0]?.node || null;
  }
  function bindConstellationKeyboard(canvas){
    if(canvas.dataset.keyboardBound === 'true') return;
    canvas.dataset.keyboardBound = 'true';
    canvas.addEventListener('keydown', e => {
      if(e.altKey || e.ctrlKey || e.metaKey) return;
      const key = e.key;
      if(['ArrowRight','ArrowDown'].includes(key)){ e.preventDefault(); selectConstellationHit(1); return; }
      if(['ArrowLeft','ArrowUp'].includes(key)){ e.preventDefault(); selectConstellationHit(-1); return; }
      if(key === 'Enter' || key === ' '){ e.preventDefault(); const node = selectedConstellationNode(); if(node){ inspectConstellationNode(node); openConstellationNode(node); } return; }
      if(key.toLowerCase() === 'r'){ e.preventDefault(); resetConstellationView(); redraw(); return; }
      if(key.toLowerCase() === 'p'){ e.preventDefault(); toggleConstellationPause(); return; }
      if(key.toLowerCase() === 'm'){ e.preventDefault(); toggleConstellationPanMode(); return; }
      if(key === '+' || key === '='){ e.preventDefault(); const rect = canvas.getBoundingClientRect(); zoomConstellation(1.18, rect.left + rect.width/2, rect.top + rect.height/2); redraw(); return; }
      if(key === '-' || key === '_'){ e.preventDefault(); const rect = canvas.getBoundingClientRect(); zoomConstellation(1 / 1.18, rect.left + rect.width/2, rect.top + rect.height/2); redraw(); }
    });
  }
  function bindConstellationControls(canvas){
    if(canvas.dataset.controlsBound === 'true') return;
    canvas.dataset.controlsBound = 'true';
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      zoomConstellation(Math.exp(-e.deltaY * 0.0012), e.clientX, e.clientY);
    }, { passive:false });
    canvas.addEventListener('pointerdown', e => {
      constellationScene.lastInteraction = performance.now();
      if(e.cancelable) e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch(_err) {}
      constellationScene.pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
      if(constellationScene.pointers.size === 2){
        const pts=[...constellationScene.pointers.values()];
        constellationScene.drag = { mode:'pinch', dist:Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y), midX:(pts[0].x+pts[1].x)/2, midY:(pts[0].y+pts[1].y)/2, zoom:constellationScene.zoom, panX:constellationScene.panX, panY:constellationScene.panY };
        return;
      }
      constellationScene.drag = { mode:(constellationScene.mode === 'pan' || e.shiftKey || e.button === 1 || e.button === 2) ? 'pan' : 'rotate', x:e.clientX, y:e.clientY, rotation:constellationScene.rotation, tilt:constellationScene.tilt, panX:constellationScene.panX, panY:constellationScene.panY, moved:false };
    });
    canvas.addEventListener('pointermove', e => {
      if(constellationScene.drag) constellationScene.lastInteraction = performance.now();
      if(constellationScene.drag && e.cancelable) e.preventDefault();
      if(constellationScene.pointers.has(e.pointerId)) constellationScene.pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
      const d = constellationScene.drag;
      if(!d) return;
      if(d.mode === 'pinch'){
        if(constellationScene.pointers.size < 2) return;
        const pts=[...constellationScene.pointers.values()];
        const dist=Math.max(1, Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y));
        const midX=(pts[0].x+pts[1].x)/2, midY=(pts[0].y+pts[1].y)/2;
        constellationScene.zoom = Math.max(CONSTELLATION_MIN_ZOOM, Math.min(CONSTELLATION_MAX_ZOOM, d.zoom * (dist / Math.max(1, d.dist))));
        constellationScene.panX = d.panX + (midX - d.midX);
        constellationScene.panY = d.panY + (midY - d.midY);
        clampConstellationCamera(canvas.clientWidth || canvas.getBoundingClientRect().width, canvas.clientHeight || canvas.getBoundingClientRect().height);
        return;
      }
      const dx=e.clientX-d.x, dy=e.clientY-d.y;
      if(Math.abs(dx)+Math.abs(dy) > 3) d.moved = true;
      if(d.mode === 'pan'){
        constellationScene.panX = d.panX + dx;
        constellationScene.panY = d.panY + dy;
        canvas.style.cursor = 'grabbing';
      } else {
        constellationScene.rotation = d.rotation + dx * 0.008;
        constellationScene.tilt = Math.max(-1.05, Math.min(1.05, d.tilt + dy * 0.006));
        canvas.style.cursor = 'grabbing';
      }
    });
    const endPointer = e => {
      constellationScene.pointers.delete(e.pointerId);
      if(constellationScene.pointers.size === 0){
        if(constellationScene.drag?.moved) canvas.dataset.suppressClick = 'true';
        constellationScene.drag = null;
        constellationScene.lastInteraction = performance.now();
        canvas.style.cursor = 'grab';
      }
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    bindConstellationKeyboard(canvas);
  }
  function drawConstellation(data){
    if(!isActive()) return;
    if(constellationScene.frame) cancelAnimationFrame(constellationScene.frame);
    constellationScene.frame = 0;
    constellationScene.renderLastTime = 0;
    if(constellationScene.visualiserMode === 'neural') buildNeuralMapScene(data); else buildConstellationScene(data);
    updateVisualiserModeUI();
    const canvas = $('#constellationCanvas');
    bindConstellationControls(canvas);
    bindConstellationKeyboard(canvas);
    canvas.onclick = e => { if(canvas.dataset.suppressClick === 'true'){ canvas.dataset.suppressClick = 'false'; return; } const rect=canvas.getBoundingClientRect(); const x=e.clientX-rect.left, y=e.clientY-rect.top; const hit=[...constellationScene.hits].reverse().find(h => Math.hypot(h.x-x,h.y-y) <= h.r); if(hit) inspectConstellationNode(hit.node); };
    canvas.onpointermove = e => { if(constellationScene.drag) return; const rect=canvas.getBoundingClientRect(); const x=e.clientX-rect.left, y=e.clientY-rect.top; canvas.style.cursor = constellationScene.hits.some(h => Math.hypot(h.x-x,h.y-y) <= h.r) ? 'pointer' : 'grab'; };
    $('#constellationClusters').innerHTML = (data.clusters || []).map(c => `<span class="cluster-pill">${esc(c.label)} <strong>${Number(c.count).toLocaleString()}</strong></span>`).join('');
    constellationInspectorDefault();
    drawVisualiserFrame(0);
  }
  async function loadConstellation(){ drawConstellation(await api('/api/constellation?limit=240')); }

  function redraw(){
    if(isActive() && constellationScene.data) drawConstellation(constellationScene.data);
  }

  function resume(){
    if(isActive() && !prefersReducedMotion() && !constellationScene.frame) constellationScene.frame = requestAnimationFrame(drawVisualiserFrame);
  }

  return {
    stop: stopCanvasVisualiserLoop,
    redraw,
    resume,
    isActive,
    constellationColors,
    neuralColors,
    loadConstellation,
    resetConstellationView,
    toggleConstellationPanMode,
    toggleConstellationPause,
    switchVisualiserMode,
    updateVisualiserModeUI,
    updateConstellationPauseButton,
    updateConstellationPanButton,
    drawConstellation,
  };
}
