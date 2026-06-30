import { esc } from '../utils/escape.js';

const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 650;
const GRAPH_LIMIT = 300;

export function graphQueryPath(query = '') {
  return `/api/graph?q=${encodeURIComponent(String(query || '').trim())}&limit=${GRAPH_LIMIT}`;
}

export function graphInspectorDefaultHtml() {
  return `<div class="inspector-kicker">Graph inspector</div><h3>Nothing selected</h3><p class="muted">Pick a node or edge to inspect connected triples, then jump into the Triples table.</p>`;
}

export function graphNodeInspectorHtml(node, edges) {
  const connected = edges.filter(e => e.source === node.id || e.target === node.id);
  const rows = connected.slice(0,12).map(e => `<button class="inspector-row" data-edge="${esc(e.id)}"><strong>${esc(e.predicate)}</strong><span>${esc(e.subject)} → ${esc(e.object)}</span></button>`).join('');
  return `<div class="inspector-kicker">Selected node</div><h3>${esc(node.label)}</h3><p class="muted">${connected.length} connected triple${connected.length === 1 ? '' : 's'}.</p><div class="inspector-actions"><button id="graphFilterTriples" class="primary tiny">Show in Triples</button><button id="graphSearchMemories" class="tiny">Search memories</button></div><div class="inspector-list">${rows || '<p class="muted">No connected edges.</p>'}</div>`;
}

export function graphEdgeInspectorHtml(edge) {
  return `<div class="inspector-kicker">Selected triple</div><h3>${esc(edge.predicate)}</h3><p><strong>${esc(edge.subject)}</strong> → <strong>${esc(edge.object)}</strong></p><p class="muted">Confidence: ${esc(edge.confidence ?? 'n/a')} · ${esc(edge.created_at || edge.valid_from || '')}</p><div class="inspector-actions"><button id="edgeDetail" class="primary tiny">Inspect JSON</button><button id="edgeTriples" class="tiny">Show in Triples</button></div>`;
}

export function graphLayout(g) {
  const cx = GRAPH_WIDTH / 2;
  const cy = GRAPH_HEIGHT / 2;
  const r = 260;
  const rawNodes = g.nodes || [];
  const nodes = rawNodes.slice(0,160).map((n,i,a)=>({...n,x:cx+Math.cos(i/a.length*Math.PI*2)*r*(.65+((i%5)/10)),y:cy+Math.sin(i/a.length*Math.PI*2)*r*(.65+((i%7)/14))}));
  const byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
  const edges = (g.edges || []).filter(e=>byId[e.source]&&byId[e.target]).slice(0,300);
  return { nodes, edges, byId };
}

export function createGraphFeature({ $, $$, api, showDetail, switchTab }) {
  let graphState = { nodes: [], edges: [], byId: {} };
  let graphView = { scale:1, x:0, y:0, dragging:false, sx:0, sy:0, ox:0, oy:0 };

  function graphInspectorDefault(){
    $('#graphInspector').innerHTML = graphInspectorDefaultHtml();
  }

  function inspectNode(node){
    const connected = graphState.edges.filter(e => e.source === node.id || e.target === node.id);
    $$('.node, .edge, .edgeLabel').forEach(x => x.classList.remove('selected','dim'));
    $$('.node').forEach(x => { if(x.dataset.id !== node.id) x.classList.add('dim'); });
    connected.forEach(e => {
      const edgeEl = document.querySelector(`.edge[data-id="${CSS.escape(e.id)}"]`);
      const labelEl = document.querySelector(`.edgeLabel[data-id="${CSS.escape(e.id)}"]`);
      if(edgeEl) edgeEl.classList.add('selected');
      if(labelEl) labelEl.classList.add('selected');
    });
    $('#graphInspector').innerHTML = graphNodeInspectorHtml(node, graphState.edges);
    $('#graphFilterTriples').onclick = () => { $('#tripleQuery').value = node.label; switchTab('triples'); };
    $('#graphSearchMemories').onclick = () => { $('#memoryQuery').value = node.label; switchTab('memories'); };
    $$('#graphInspector .inspector-row').forEach(btn => btn.onclick = () => inspectEdge(graphState.edges.find(e => e.id === btn.dataset.edge)));
  }

  function inspectEdge(edge){
    if(!edge) return;
    $$('.node, .edge, .edgeLabel').forEach(x => x.classList.remove('selected','dim'));
    $$('.edge').forEach(x => { if(x.dataset.id !== edge.id) x.classList.add('dim'); });
    const edgeEl = document.querySelector(`.edge[data-id="${CSS.escape(edge.id)}"]`);
    const labelEl = document.querySelector(`.edgeLabel[data-id="${CSS.escape(edge.id)}"]`);
    if(edgeEl) edgeEl.classList.add('selected');
    if(labelEl) labelEl.classList.add('selected');
    $('#graphInspector').innerHTML = graphEdgeInspectorHtml(edge);
    $('#edgeDetail').onclick = () => showDetail(edge, 'Triple edge detail');
    $('#edgeTriples').onclick = () => { $('#tripleQuery').value = `${edge.subject} ${edge.predicate} ${edge.object}`; switchTab('triples'); };
  }

  function applyGraphView(){
    const vp = $('#graphViewport');
    if(vp) vp.setAttribute('transform', `translate(${graphView.x} ${graphView.y}) scale(${graphView.scale})`);
  }

  function resetGraphView(){
    graphView = { scale:1, x:0, y:0, dragging:false, sx:0, sy:0, ox:0, oy:0 };
    applyGraphView();
  }

  function bindGraphPanZoom(){
    const svg = $('#graphSvg');
    if(!svg || svg.dataset.panzoomBound) return;
    svg.dataset.panzoomBound = '1';
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width * GRAPH_WIDTH;
      const py = (e.clientY - rect.top) / rect.height * GRAPH_HEIGHT;
      const old = graphView.scale;
      const next = Math.max(0.35, Math.min(4, old * (e.deltaY < 0 ? 1.12 : 0.88)));
      graphView.x = px - (px - graphView.x) * (next / old);
      graphView.y = py - (py - graphView.y) * (next / old);
      graphView.scale = next;
      applyGraphView();
    }, { passive:false });
    svg.addEventListener('pointerdown', e => { if(e.target.closest('.node,.edge,.edgeLabel')) return; graphView.dragging = true; graphView.sx = e.clientX; graphView.sy = e.clientY; graphView.ox = graphView.x; graphView.oy = graphView.y; svg.setPointerCapture(e.pointerId); svg.classList.add('panning'); });
    svg.addEventListener('pointermove', e => { if(!graphView.dragging) return; graphView.x = graphView.ox + (e.clientX - graphView.sx); graphView.y = graphView.oy + (e.clientY - graphView.sy); applyGraphView(); });
    svg.addEventListener('pointerup', e => { graphView.dragging = false; svg.classList.remove('panning'); try{ svg.releasePointerCapture(e.pointerId); }catch{} });
    svg.addEventListener('pointerleave', () => { graphView.dragging = false; svg.classList.remove('panning'); });
  }

  function centerGraphOnMobile(){
    const wrap = document.querySelector('.graph-wrap');
    if(!wrap || !window.matchMedia('(max-width: 760px)').matches) return;
    requestAnimationFrame(() => {
      wrap.scrollLeft = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2);
    });
  }

  function drawGraph(g){
    const svg = $('#graphSvg'); svg.innerHTML = '';
    const layout = graphLayout(g);
    graphState = { ...g, ...layout };
    svg.insertAdjacentHTML('afterbegin', `<defs><linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#65d6ff" stop-opacity=".25"/><stop offset="55%" stop-color="#7c7cff" stop-opacity=".78"/><stop offset="100%" stop-color="#ffd166" stop-opacity=".35"/></linearGradient></defs><g id="graphViewport"></g>`);
    const vp = $('#graphViewport');
    if(!layout.nodes.length){ svg.insertAdjacentHTML('beforeend', '<text x="500" y="325" text-anchor="middle" class="nodeText">No triples match this graph filter. Add facts with mnemosyne_triple_add or mnemosyne_remember(... extract=true).</text>'); graphInspectorDefault(); bindGraphPanZoom(); return; }
    for(const e of layout.edges){ const s=layout.byId[e.source], t=layout.byId[e.target];
      const line = document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',s.x);line.setAttribute('y1',s.y);line.setAttribute('x2',t.x);line.setAttribute('y2',t.y);line.setAttribute('class','edge'); line.dataset.id = e.id; line.onclick = () => inspectEdge(e); vp.appendChild(line);
      const label = document.createElementNS('http://www.w3.org/2000/svg','text'); label.textContent=e.predicate; label.setAttribute('x',(s.x+t.x)/2);label.setAttribute('y',(s.y+t.y)/2);label.setAttribute('class','edgeLabel'); label.dataset.id = e.id; label.onclick = () => inspectEdge(e); vp.appendChild(label);
    }
    for(const n of layout.nodes){
      const c=document.createElementNS('http://www.w3.org/2000/svg','circle'); c.setAttribute('cx',n.x);c.setAttribute('cy',n.y);c.setAttribute('r',Math.min(14, 6 + Math.sqrt(n.count || 1)));c.setAttribute('class','node'); c.dataset.id = n.id; c.onclick = () => inspectNode(n); vp.appendChild(c);
      const text=document.createElementNS('http://www.w3.org/2000/svg','text'); text.textContent=n.label.length>38?n.label.slice(0,35)+'…':n.label; text.setAttribute('x',n.x+12);text.setAttribute('y',n.y+4);text.setAttribute('class','nodeText'); text.dataset.id = n.id; text.onclick = () => inspectNode(n); vp.appendChild(text);
    }
    resetGraphView();
    bindGraphPanZoom();
    graphInspectorDefault();
    centerGraphOnMobile();
  }

  async function loadGraph(){
    drawGraph(await api(graphQueryPath($('#graphQuery')?.value || '')));
  }

  return { drawGraph, loadGraph, inspectNode, inspectEdge };
}
