// ==================================================================
// BROKKOM CRM v2 — Mòduls (renders + accions)
// ==================================================================

window.showTab = (tab) => {
  state.currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  const c = document.getElementById('tab-content');
  c.innerHTML = '';
  const renderers = {
    dashboard: renderDashboard,
    clients: renderClients,
    pipeline: renderPipeline,
    consolidats: renderConsolidats,
    seguiments: renderSeguiments,
    oportunitats: renderOpps,
    venciments: renderVenciments,
    tasques: renderTasques,
    asseguradores: renderAsseguradores,
    comunicacio: renderComunicacio,
    usuaris: renderUsuaris,
    ia: renderIA,
    config: renderConfig
  };
  (renderers[tab] || renderDashboard)();
  updateNavBadges();
};

window.updateNavBadges = () => {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('nav-clients', state.clients.length);
  set('nav-pipeline', state.ofertes.filter(o => !['Tancada guanyada','Tancada perduda'].includes(o.estat)).length);
  set('nav-consolidats', state.consolidats.length);
  set('nav-opps', state.oportunitats.filter(o => o.estat !== 'Descartada').length);
  set('nav-venc', state.venciments.length);
  set('nav-tasques', state.tasques.filter(t => t.estat === 'pendent').length);
};

// ==================================================================
// DASHBOARD
// ==================================================================
function renderDashboard() {
  const now = new Date();
  const ofertesObertes = state.ofertes.filter(o => !['Tancada guanyada','Tancada perduda'].includes(o.estat));
  const tancMes = state.consolidats.filter(c => {
    const d = new Date(c.data_tancament);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const primaPipeline = ofertesObertes.reduce((s,o) => s + (parseFloat(o.prima_brokkom)||0), 0);
  const primaTancMes = tancMes.reduce((s,c) => s + (parseFloat(c.prima_anual)||0), 0);

  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div>
        <div class="page-title">Tauler comercial</div>
        <div class="page-sub">${now.toLocaleDateString('ca-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-primary" onclick="openModal('client')">+ Nou client</button>
      </div>
    </div>
    <div class="metrics">
      <div class="metric"><div class="metric-label">Pipeline obert</div><div class="metric-value">${ofertesObertes.length}</div><div class="metric-sub">${fmtEur(primaPipeline)} en valor</div></div>
      <div class="metric"><div class="metric-label">Tancaments mes</div><div class="metric-value">${tancMes.length}</div><div class="metric-sub">${fmtEur(primaTancMes)} primat</div></div>
      <div class="metric"><div class="metric-label">Clients</div><div class="metric-value">${state.clients.length}</div><div class="metric-sub">cartera total</div></div>
      <div class="metric"><div class="metric-label">Oportunitats</div><div class="metric-value">${state.oportunitats.filter(o=>o.estat!=='Descartada').length}</div><div class="metric-sub">detectades</div></div>
      <div class="metric"><div class="metric-label">Tasques pend.</div><div class="metric-value">${state.tasques.filter(t=>t.estat==='pendent').length}</div><div class="metric-sub">a fer</div></div>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
      <div>
        <div class="section-title">Pipeline actiu</div>
        <div class="card" id="dash-pipeline"></div>
      </div>
      <div>
        <div class="section-title">Properes alarmes</div>
        <div class="card" id="dash-alarmes"></div>
      </div>
    </div>
  `;

  // Pipeline summary
  let html = '';
  ESTATS_PIPELINE.slice(0,5).forEach(estat => {
    const items = state.ofertes.filter(o => o.estat === estat);
    const total = items.reduce((s,o) => s + (parseFloat(o.prima_brokkom)||0), 0);
    const pct = ofertesObertes.length > 0 ? (items.length/ofertesObertes.length)*100 : 0;
    html += `<div class="chart-bar"><div class="chart-label">${estat}</div><div class="chart-track"><div class="chart-fill" style="width:${pct}%"></div></div><div class="chart-value">${items.length} · ${fmtEur(total)}</div></div>`;
  });
  document.getElementById('dash-pipeline').innerHTML = html || '<div class="empty-state">No hi ha ofertes obertes</div>';

  // Alarmes
  const alarmes = [];
  state.venciments.forEach(v => {
    [90,30,7].forEach(d => {
      const dataAlarma = new Date(v.data_venciment);
      dataAlarma.setDate(dataAlarma.getDate() - d);
      const diesRest = daysFromNow(dataAlarma);
      if (diesRest >= 0 && diesRest <= 90) {
        alarmes.push({ data: dataAlarma, titol: `${d===90?'Preparar':d===30?'URGENT':'CRÍTIC'} — ${v.empresa}`, sub: `${v.ram||''} · venç ${fmtDate(v.data_venciment)}`, tipus: d });
      }
    });
  });
  alarmes.sort((a,b) => a.data - b.data);
  document.getElementById('dash-alarmes').innerHTML = alarmes.length === 0 ? '<div class="empty-state">Cap alarma</div>' : alarmes.slice(0,5).map(a => `
    <div class="alarm-item">
      <div class="alarm-date"><div class="alarm-day">${a.data.getDate()}</div><div class="alarm-month">${a.data.toLocaleDateString('ca-ES',{month:'short'})}</div></div>
      <div class="alarm-body"><div class="alarm-title">${a.titol}</div><div class="alarm-sub">${a.sub}</div></div>
      <div class="alarm-dot ${a.tipus===7?'dot-r':a.tipus===30?'dot-a':'dot-g'}"></div>
    </div>
  `).join('');
}

// ==================================================================
// CLIENTS
// ==================================================================
function renderClients() {
  const mediadorsList = [...new Set(state.clients.map(c => {
    const u = state.usuaris.find(x => x.id === c.user_id);
    return u?.nom || u?.email || null;
  }).filter(Boolean))];

  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Clients i contactes</div><div class="page-sub">${state.clients.length} clients · ${isAdmin()?'vista admin (tots)':'vista agent'}</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('client')">+ Nou client</button></div>
    </div>
    <div class="toolbar">
      <input type="text" id="search-clients" class="grow" placeholder="Cerca per empresa, CIF, contacte..." oninput="renderClientsList()">
      <select id="filter-clients-sector" onchange="renderClientsList()">
        <option value="">Tots els sectors</option>
        <option>Transport mercaderies</option><option>Logística</option><option>Transport viatgers</option><option>ADR / mercaderies perilloses</option><option>Altres</option>
      </select>
      <select id="filter-clients-mediador" onchange="renderClientsList()">
        <option value="">Tots els mediadors</option>
        ${state.usuaris.map(u => `<option value="${u.id}">${u.nom || u.email}</option>`).join('')}
      </select>
    </div>
    <div id="clients-list"></div>
  `;
  renderClientsList();
}

window.renderClientsList = () => {
  const q = (document.getElementById('search-clients')?.value || '').toLowerCase();
  const sector = document.getElementById('filter-clients-sector')?.value || '';
  const mediador = document.getElementById('filter-clients-mediador')?.value || '';
  const filtered = state.clients.filter(c => {
    if (sector && c.sector !== sector) return false;
    if (mediador && c.user_id !== mediador) return false;
    if (q && !c.empresa.toLowerCase().includes(q) && !(c.cif||'').toLowerCase().includes(q) && !(c.contacte||'').toLowerCase().includes(q)) return false;
    return true;
  });
  if (filtered.length === 0) {
    document.getElementById('clients-list').innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">🏢</div>Cap client trobat<br><br><button class="btn btn-primary" onclick="openModal(\'client\')">+ Crear client</button></div></div>';
    return;
  }
  document.getElementById('clients-list').innerHTML = filtered.map(c => {
    const ofertes = state.ofertes.filter(o => o.client_id === c.id);
    const consolidats = state.consolidats.filter(co => co.client_id === c.id);
    const opps = state.oportunitats.filter(o => o.client_id === c.id && o.estat !== 'Descartada');
    const owner = state.usuaris.find(u => u.id === c.user_id);
    const ownerName = owner ? (owner.nom || owner.email.split('@')[0]) : 'sense propietari';
    return `<div class="card">
      <div class="card-row">
        <div style="flex:1">
          <div class="card-title">${c.empresa}</div>
          <div class="card-sub">${c.cif||'—'} · ${c.sector||'sense sector'} ${c.treballadors?'· '+c.treballadors+' treb.':''} <span class="pill p-gray" style="margin-left:6px">${ownerName}</span></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          ${ofertes.length>0?`<span class="pill p-info">${ofertes.length} ofertes</span>`:''}
          ${consolidats.length>0?`<span class="pill p-success">${consolidats.length} tancades</span>`:''}
          ${opps.length>0?`<span class="pill p-purple">${opps.length} opps</span>`:''}
        </div>
      </div>
      <div class="info-grid">
        ${c.contacte?`<div class="info-row"><span class="info-label">Contacte</span><span class="info-val">${c.contacte}</span></div>`:''}
        ${c.carrec?`<div class="info-row"><span class="info-label">Càrrec</span><span class="info-val">${c.carrec}</span></div>`:''}
        ${c.email?`<div class="info-row"><span class="info-label">Email</span><span class="info-val">${c.email}</span></div>`:''}
        ${c.telefon?`<div class="info-row"><span class="info-label">Telèfon</span><span class="info-val">${c.telefon}</span></div>`:''}
        ${c.facturacio?`<div class="info-row"><span class="info-label">Facturació</span><span class="info-val">${c.facturacio}</span></div>`:''}
      </div>
      ${c.notes?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;color:var(--text-2)">${c.notes}</div>`:''}
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="openModal('oferta',{client_id:'${c.id}'})">+ Oferta</button>
        <button class="btn btn-sm" onclick="openModal('seguiment',{client_id:'${c.id}'})">+ Seguiment</button>
        <button class="btn btn-sm" onclick='openModal("client",${JSON.stringify(c).replace(/'/g,"&#39;")})'>✏️ Editar</button>
        ${(isAdmin() || c.user_id === state.user.id) ? `<button class="btn btn-sm" onclick="deleteRecord('clients','${c.id}','Esborrar aquest client i totes les dades vinculades?')" style="color:var(--danger)">🗑</button>` : ''}
      </div>
    </div>`;
  }).join('');
};

// ==================================================================
// PIPELINE
// ==================================================================
function renderPipeline() {
  const ofertesActives = state.ofertes.filter(o => !['Tancada guanyada','Tancada perduda'].includes(o.estat));
  const totalValor = ofertesActives.reduce((s,o) => s + (parseFloat(o.prima_brokkom)||0), 0);
  const prob = {'Lead':5,'Qualificat':20,'Cotitzant':40,'Oferta enviada':50,'En negociació':75};
  const valorEsp = ofertesActives.reduce((s,o) => s + (parseFloat(o.prima_brokkom)||0) * (prob[o.estat]||0)/100, 0);
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Pipeline potencials</div><div class="page-sub">Cicle de venda — del lead al tancament</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('oferta')">+ Nova oferta</button></div>
    </div>
    <div class="metrics">
      <div class="metric"><div class="metric-label">Ofertes actives</div><div class="metric-value">${ofertesActives.length}</div></div>
      <div class="metric"><div class="metric-label">Valor total</div><div class="metric-value">${fmtEur(totalValor)}</div></div>
      <div class="metric"><div class="metric-label">Valor esperat</div><div class="metric-value" style="color:var(--success)">${fmtEur(valorEsp)}</div><div class="metric-sub">probabilitat × valor</div></div>
    </div>
    <div class="toolbar">
      <select id="filter-pipe-mediador" onchange="renderPipelineBoard()">
        <option value="">Tots els mediadors</option>
        ${state.usuaris.map(u => `<option value="${u.id}">${u.nom || u.email}</option>`).join('')}
      </select>
    </div>
    <div class="pipeline-board" id="pipeline-board"></div>
  `;
  renderPipelineBoard();
}

window.renderPipelineBoard = () => {
  const mediador = document.getElementById('filter-pipe-mediador')?.value || '';
  let html = '';
  ESTATS_PIPELINE.forEach(estat => {
    let items = state.ofertes.filter(o => o.estat === estat);
    if (mediador) items = items.filter(o => o.user_id === mediador);
    html += `<div class="pipeline-col">
      <div class="pipeline-col-title">${estat} <span class="pipeline-col-count">${items.length}</span></div>
      ${items.map(o => {
        const cli = state.clients.find(c => c.id === o.client_id);
        const estalvi = (parseFloat(o.prima_actual)||0) - (parseFloat(o.prima_brokkom)||0);
        return `<div class="pipeline-card" onclick='openModal("oferta",${JSON.stringify(o).replace(/'/g,"&#39;")})'>
          <div class="pipeline-card-title">${cli?cli.empresa:o.empresa||'?'}</div>
          <div class="pipeline-card-sub">${o.ram||''}</div>
          ${o.prima_brokkom?`<div class="pipeline-card-amount">${fmtEur(o.prima_brokkom)}${estalvi>0?' · estalvi '+fmtEur(estalvi):''}</div>`:''}
        </div>`;
      }).join('')}
    </div>`;
  });
  document.getElementById('pipeline-board').innerHTML = html;
};

// ==================================================================
// CONSOLIDATS
// ==================================================================
function renderConsolidats() {
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Pipeline consolidats</div><div class="page-sub">Tancaments guanyats · anàlisi comercial</div></div>
      <div class="topbar-actions"><button class="btn" onclick="exportConsolidats()">📥 CSV</button></div>
    </div>
    <div class="toolbar">
      <select id="filter-c-periode" onchange="renderConsolidatsContent()">
        <option value="all">Tot el període</option><option value="month">Aquest mes</option><option value="quarter">Aquest trimestre</option><option value="year">Aquest any</option>
      </select>
      <select id="filter-c-mediador" onchange="renderConsolidatsContent()">
        <option value="">Tots els mediadors</option>
        ${state.usuaris.map(u => `<option value="${u.id}">${u.nom || u.email}</option>`).join('')}
      </select>
    </div>
    <div id="consolidats-content"></div>
  `;
  renderConsolidatsContent();
}

window.renderConsolidatsContent = () => {
  const periode = document.getElementById('filter-c-periode')?.value || 'all';
  const mediador = document.getElementById('filter-c-mediador')?.value || '';
  const now = new Date();
  let filtered = [...state.consolidats];
  if (periode === 'month') filtered = filtered.filter(c => { const d=new Date(c.data_tancament); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); });
  else if (periode === 'quarter') { const q = Math.floor(now.getMonth()/3); filtered = filtered.filter(c => { const d=new Date(c.data_tancament); return Math.floor(d.getMonth()/3)===q && d.getFullYear()===now.getFullYear(); }); }
  else if (periode === 'year') filtered = filtered.filter(c => new Date(c.data_tancament).getFullYear() === now.getFullYear());
  if (mediador) filtered = filtered.filter(c => c.user_id === mediador);
  const totalPrima = filtered.reduce((s,c) => s + (parseFloat(c.prima_anual)||0), 0);
  document.getElementById('consolidats-content').innerHTML = `
    <div class="metrics">
      <div class="metric"><div class="metric-label">Tancaments</div><div class="metric-value">${filtered.length}</div></div>
      <div class="metric"><div class="metric-label">Prima total</div><div class="metric-value">${fmtEur(totalPrima)}</div></div>
      <div class="metric"><div class="metric-label">Prima mitjana</div><div class="metric-value">${filtered.length>0?fmtEur(totalPrima/filtered.length):'0€'}</div></div>
    </div>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="table">
        <thead><tr><th>Data</th><th>Empresa</th><th>Ram</th><th>Asseguradora</th><th>Núm. pòlissa</th><th>Mediador</th><th class="num">Prima</th></tr></thead>
        <tbody>
          ${filtered.length === 0 ? '<tr><td colspan="7"><div class="empty-state">Cap tancament</div></td></tr>' : filtered.sort((a,b)=>new Date(b.data_tancament)-new Date(a.data_tancament)).map(c => {
            const u = state.usuaris.find(x => x.id === c.user_id);
            return `<tr><td>${fmtDate(c.data_tancament)}</td><td><strong>${c.empresa}</strong></td><td>${c.ram||'—'}</td><td>${c.asseguradora||'—'}</td><td style="font-family:monospace;font-size:12px">${c.num_polissa||'—'}</td><td>${u?(u.nom||u.email.split('@')[0]):(c.mediador||'—')}</td><td class="num"><strong>${fmtEur(c.prima_anual)}</strong></td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
};

window.exportConsolidats = () => {
  const rows = [['Data','Empresa','Ram','Asseguradora','Núm. pòlissa','Prima'], ...state.consolidats.map(c => [c.data_tancament, c.empresa, c.ram||'', c.asseguradora||'', c.num_polissa||'', c.prima_anual||0])];
  const csv = rows.map(r => r.map(v => `"${(v+'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `consolidats-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('Exportat');
};

// ==================================================================
// SEGUIMENTS
// ==================================================================
function renderSeguiments() {
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Seguiments</div><div class="page-sub">Historial d'interaccions</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('seguiment')">+ Nou seguiment</button></div>
    </div>
    <div id="seg-list"></div>
  `;
  const list = [...state.seguiments].sort((a,b) => new Date(b.data) - new Date(a.data));
  document.getElementById('seg-list').innerHTML = list.length === 0 ? '<div class="card"><div class="empty-state"><div class="empty-icon">📞</div>Cap seguiment registrat</div></div>' : list.map(s => {
    const cli = state.clients.find(c => c.id === s.client_id);
    const u = state.usuaris.find(x => x.id === s.user_id);
    return `<div class="card compact">
      <div class="card-row">
        <div><div class="card-title">${cli?cli.empresa:'(client esborrat)'}</div><div class="card-sub">${fmtDate(s.data)} · ${s.canal||'—'}${u?' · '+(u.nom||u.email.split('@')[0]):''}</div></div>
        <span class="pill p-gray">${s.canal||'—'}</span>
      </div>
      ${s.resum?`<div style="margin-top:8px;font-size:13px;line-height:1.6">${s.resum}</div>`:''}
      ${s.proper_pas?`<div style="margin-top:8px;font-size:12px;color:var(--info)">→ ${s.proper_pas}</div>`:''}
      ${(isAdmin() || s.user_id === state.user.id) ? `<div style="margin-top:8px"><button class="btn btn-sm" onclick="deleteRecord('seguiments','${s.id}')" style="color:var(--danger)">🗑</button></div>` : ''}
    </div>`;
  }).join('');
}

// ==================================================================
// OPORTUNITATS
// ==================================================================
function renderOpps() {
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Oportunitats detectades</div><div class="page-sub">Cross-selling sector transport</div></div>
      <div class="topbar-actions"><button class="btn" onclick="regenerarOportunitats()">🤖 Regenerar amb IA</button></div>
    </div>
    <div id="opps-list"></div>
  `;
  let list = [...state.oportunitats];
  list.sort((a,b) => ({'Alta':3,'Mitjana':2,'Baixa':1}[b.prioritat]||0) - ({'Alta':3,'Mitjana':2,'Baixa':1}[a.prioritat]||0));
  document.getElementById('opps-list').innerHTML = list.length === 0 ? '<div class="card"><div class="empty-state"><div class="empty-icon">💡</div>Cap oportunitat detectada</div></div>' : list.map(o => {
    const cli = state.clients.find(c => c.id === o.client_id);
    return `<div class="opp-card ${(o.prioritat||'baixa').toLowerCase()}">
      <div class="card-row">
        <div><div class="card-title">${cli?cli.empresa:o.empresa||'?'}</div><div class="card-sub">${o.producte||''}</div></div>
        <div style="display:flex;gap:6px;flex-direction:column;align-items:flex-end">
          <span class="pill ${o.prioritat==='Alta'?'p-danger':o.prioritat==='Mitjana'?'p-pend':'p-success'}">${o.prioritat||'—'}</span>
          <span class="pill p-gray">${o.estat||'Detectada'}</span>
        </div>
      </div>
      ${o.argument?`<div style="margin-top:6px;font-size:12px;color:var(--text-2)">${o.argument}</div>`:''}
      <div style="margin-top:8px;display:flex;gap:6px">
        <button class="btn btn-sm" onclick="canviarEstatOpp('${o.id}')">Canviar estat</button>
        ${(isAdmin() || o.user_id === state.user.id) ? `<button class="btn btn-sm" onclick="deleteRecord('oportunitats','${o.id}')" style="color:var(--danger)">🗑</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

window.canviarEstatOpp = async (id) => {
  const o = state.oportunitats.find(x => x.id === id);
  const estats = ['Detectada','En treball','Presentada','Descartada'];
  const idx = estats.indexOf(o.estat);
  const nou = estats[(idx+1) % estats.length];
  await supabase.from('oportunitats').update({ estat: nou }).eq('id', id);
  await refreshData('oportunitats');
  renderOpps();
};

// ==================================================================
// VENCIMENTS
// ==================================================================
function renderVenciments() {
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Venciments i alarmes</div><div class="page-sub">Sistema 90/30/7</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('venciment')">+ Nou venciment</button></div>
    </div>
    <div id="venc-list"></div>
  `;
  const sorted = [...state.venciments].sort((a,b) => new Date(a.data_venciment) - new Date(b.data_venciment));
  document.getElementById('venc-list').innerHTML = sorted.length === 0 ? '<div class="card"><div class="empty-state"><div class="empty-icon">📅</div>Cap venciment</div></div>' : sorted.map(v => {
    const dies = daysFromNow(v.data_venciment);
    const urg = dies <= 7 ? 'p-danger' : dies <= 30 ? 'p-pend' : dies <= 90 ? 'p-info' : 'p-gray';
    return `<div class="card">
      <div class="card-row">
        <div><div class="card-title">${v.empresa}</div><div class="card-sub">${v.ram||''}${v.asseguradora?' · '+v.asseguradora:''}</div></div>
        <div style="text-align:right"><span class="pill ${urg}">${fmtDate(v.data_venciment)}</span><div style="font-size:11px;color:var(--text-3);margin-top:3px">${dies>0?'en '+dies+' dies':dies===0?'avui':'fa '+(-dies)+' dies'}</div></div>
      </div>
      ${v.prima_actual?`<div style="margin-top:8px;font-size:12px"><span class="mini-stat">Prima <strong>${fmtEur(v.prima_actual)}</strong></span></div>`:''}
      <div style="margin-top:8px;display:flex;gap:6px">
        <button class="btn btn-sm" onclick="genCalendar('${v.id}')">📅 Google Calendar</button>
        ${(isAdmin() || v.user_id === state.user.id) ? `<button class="btn btn-sm" onclick="deleteRecord('venciments','${v.id}')" style="color:var(--danger)">🗑</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

window.genCalendar = (id) => {
  const v = state.venciments.find(x => x.id === id);
  const d = new Date(v.data_venciment);
  const dt = d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Venciment '+v.empresa+' — '+(v.ram||''))}&dates=${dt}/${dt}&details=${encodeURIComponent('Prima: '+(v.prima_actual?fmtEur(v.prima_actual):'?'))}`;
  window.open(url,'_blank');
};

// ==================================================================
// TASQUES
// ==================================================================
function renderTasques() {
  const pend = state.tasques.filter(t => t.estat === 'pendent').length;
  const done = state.tasques.filter(t => t.estat === 'done').length;
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Tasques</div><div class="page-sub">${pend} pendents · ${done} fetes</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('tasca')">+ Nova tasca</button></div>
    </div>
    <div class="toolbar">
      <select id="filter-tasques-estat" onchange="renderTasquesList()">
        <option value="pendent">Pendents</option><option value="">Totes</option><option value="done">Fetes</option>
      </select>
    </div>
    <div class="card" id="tasques-list"></div>
  `;
  renderTasquesList();
}

window.renderTasquesList = () => {
  const filt = document.getElementById('filter-tasques-estat')?.value;
  const filtre = filt === undefined ? 'pendent' : filt;
  let list = [...state.tasques];
  if (filtre !== '') list = list.filter(t => t.estat === filtre);
  list.sort((a,b) => ({'Alta':3,'Mitjana':2,'Baixa':1}[b.prioritat]||0) - ({'Alta':3,'Mitjana':2,'Baixa':1}[a.prioritat]||0));
  document.getElementById('tasques-list').innerHTML = list.length === 0 ? '<div class="empty-state">Cap tasca</div>' : `<ul class="checklist">${list.map(t => `
    <li>
      <div class="check ${t.estat==='done'?'done':''}" onclick="toggleTasca('${t.id}')"></div>
      <div style="flex:1">
        <div class="text ${t.estat==='done'?'done':''}">${t.titol}</div>
        ${t.descripcio?`<div style="font-size:11px;color:var(--text-3);margin-top:2px">${t.descripcio}</div>`:''}
        <div class="text-meta">
          ${t.prioritat?`<span class="pill ${t.prioritat==='Alta'?'p-danger':t.prioritat==='Mitjana'?'p-pend':'p-success'}">${t.prioritat}</span>`:''}
          ${t.categoria?`<span class="pill p-gray">${t.categoria}</span>`:''}
          ${t.data_limit?`<span class="pill p-info">${fmtDate(t.data_limit)}</span>`:''}
        </div>
      </div>
      <button class="btn btn-sm" onclick="deleteRecord('tasques','${t.id}')" style="color:var(--danger)">🗑</button>
    </li>
  `).join('')}</ul>`;
};

window.toggleTasca = async (id) => {
  const t = state.tasques.find(x => x.id === id);
  const nou = t.estat === 'done' ? 'pendent' : 'done';
  await supabase.from('tasques').update({ estat: nou }).eq('id', id);
  await refreshData('tasques');
  renderTasquesList();
  updateNavBadges();
};

// ==================================================================
// ASSEGURADORES
// ==================================================================
function renderAsseguradores() {
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Asseguradores</div><div class="page-sub">Catàleg corporatiu</div></div>
      ${isAdmin() ? '<div class="topbar-actions"><button class="btn btn-primary" onclick="openModal(\'asseguradora\')">+ Nova</button></div>' : ''}
    </div>
    <div id="assegs-list"></div>
  `;
  document.getElementById('assegs-list').innerHTML = state.asseguradores.map(a => `
    <div class="card">
      <div class="card-row">
        <div><div class="card-title">${a.nom}</div>${a.contacte_intern?`<div class="card-sub">Contacte: ${a.contacte_intern}${a.email?' · '+a.email:''}</div>`:''}</div>
        ${isAdmin() ? `<button class="btn btn-sm" onclick="deleteRecord('asseguradores','${a.id}')" style="color:var(--danger)">🗑</button>` : ''}
      </div>
      ${a.rams?.length>0?`<div style="margin-top:8px">${a.rams.map(r => `<span class="pill p-info" style="margin-right:4px">${r}</span>`).join('')}</div>`:''}
      ${a.notes?`<div style="margin-top:8px;font-size:12px;color:var(--text-2)">${a.notes}</div>`:''}
    </div>
  `).join('') || '<div class="card"><div class="empty-state">Cap asseguradora</div></div>';
}

// ==================================================================
// COMUNICACIÓ (admin only)
// ==================================================================
function renderComunicacio() {
  if (!isAdmin()) { document.getElementById('tab-content').innerHTML = '<div class="card"><div class="empty-state">Aquesta secció és només per a admins</div></div>'; return; }
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Posts LinkedIn</div><div class="page-sub">${TOPICS.length} temes · ${state.posts.length} posts guardats</div></div>
    </div>
    <div class="section-title">Selecciona tema</div>
    <div class="topic-grid">
      ${TOPICS.map(t => `<div class="topic-card" onclick="selectTopic('${t.id}',this)"><div class="topic-icon">${t.i}</div><div class="topic-name">${t.n}</div><div class="topic-hint">${t.sub}</div></div>`).join('')}
    </div>
    <div id="post-gen" class="hidden" style="margin-top:20px"></div>
    <div class="section-title" style="margin-top:24px">Posts guardats</div>
    <div id="saved-posts"></div>
  `;
  document.getElementById('saved-posts').innerHTML = state.posts.length === 0 ? '<div class="card"><div class="empty-state">Cap post guardat</div></div>' : state.posts.map(p => `
    <div class="card compact">
      <div class="card-row"><div><div class="card-title">${p.tema}</div><div class="card-sub">${fmtDate(p.data)}</div></div><button class="btn btn-sm" onclick="deleteRecord('posts','${p.id}')" style="color:var(--danger)">🗑</button></div>
      <details style="margin-top:8px"><summary>Veure post</summary><div style="margin-top:8px;padding:10px;background:var(--surface-2);border-radius:var(--radius);white-space:pre-wrap;font-size:13px">${p.contingut}</div></details>
    </div>
  `).join('');
}

window.selectTopic = (id, el) => {
  const t = TOPICS.find(x => x.id === id);
  if (!t) return;
  document.querySelectorAll('.topic-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('post-gen').classList.remove('hidden');
  document.getElementById('post-gen').innerHTML = `
    <div class="section-title">${t.n} — angle</div>
    <div class="card">
      <ul class="checklist">
        ${t.a.map((a,i) => `<li><input type="radio" name="angle" value="${i}" id="angle-${i}" ${i===0?'checked':''} style="margin-top:4px"><label for="angle-${i}" style="flex:1;cursor:pointer">${a}</label></li>`).join('')}
      </ul>
      <div style="margin-top:14px;display:flex;gap:8px"><button class="btn btn-primary" onclick="generatePost('${id}')">🤖 Generar</button><button class="btn" onclick="document.getElementById('post-gen').classList.add('hidden')">Cancel·lar</button></div>
      <div id="gen-post-output" class="hidden" style="margin-top:14px">
        <div class="section-title">Post generat</div>
        <textarea id="post-output" style="min-height:200px"></textarea>
        <div style="margin-top:8px;display:flex;gap:8px"><button class="btn" onclick="copyPost()">📋 Copiar</button><button class="btn" onclick="savePost('${id}')">💾 Guardar</button></div>
      </div>
    </div>
  `;
};

window.copyPost = () => { navigator.clipboard.writeText(document.getElementById('post-output').value); toast('Copiat'); };
window.savePost = async (topicId) => {
  const t = TOPICS.find(x => x.id === topicId);
  const contingut = document.getElementById('post-output').value;
  await supabase.from('posts').insert({ user_id: state.user.id, tema: t.n, contingut });
  await refreshData('posts');
  renderComunicacio();
  toast('Post guardat');
};

window.generatePost = async (topicId) => {
  const t = TOPICS.find(x => x.id === topicId);
  const angleIdx = parseInt(document.querySelector('input[name=angle]:checked').value);
  const angle = t.a[angleIdx];
  const prompt = `Escriu un post professional de LinkedIn per a Brokkom Correduria de Seguros (sector transport).\n\nTema: ${t.n}\nAngle: ${angle}\n\nRequisits: català, 150-250 paraules, hook inicial, estructura problema→context→solució→CTA, 1-2 emojis màxim, sense hashtags.\n\nRetorna només el text del post.`;
  try {
    const result = await callAnthropicAPI(prompt, state.config.model_smart);
    document.getElementById('post-output').value = result;
    document.getElementById('gen-post-output').classList.remove('hidden');
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
};

// ==================================================================
// USUARIS (admin only)
// ==================================================================
function renderUsuaris() {
  if (!isAdmin()) { document.getElementById('tab-content').innerHTML = '<div class="card"><div class="empty-state">Només admin</div></div>'; return; }
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Usuaris</div><div class="page-sub">${state.usuaris.length} usuaris registrats</div></div>
    </div>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="table">
        <thead><tr><th>Nom</th><th>Email</th><th>Rol</th><th>Accions</th></tr></thead>
        <tbody>${state.usuaris.map(u => `
          <tr>
            <td>${u.nom||'—'}</td>
            <td>${u.email}</td>
            <td><span class="role-badge ${u.rol==='admin'?'role-admin':'role-agent'}">${u.rol}</span></td>
            <td>${u.id !== state.user.id ? `<button class="btn btn-sm" onclick="canviarRol('${u.id}','${u.rol}')">Canviar rol</button>` : '<span style="font-size:11px;color:var(--text-3)">(tu)</span>'}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
}

window.canviarRol = async (id, rolActual) => {
  const nou = rolActual === 'admin' ? 'agent' : 'admin';
  if (!confirm(`Canviar rol a ${nou}?`)) return;
  const { error } = await supabase.from('profiles').update({ rol: nou }).eq('id', id);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  const { data } = await supabase.from('profiles').select('*');
  state.usuaris = data || [];
  renderUsuaris();
  toast('Rol actualitzat');
};

// ==================================================================
// IA
// ==================================================================
function renderIA() {
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Assistent IA <span class="ai-chip">Claude</span></div><div class="page-sub">Processa emails, genera continguts, detecta oportunitats</div></div>
    </div>
    <div class="ai-input-area">
      <div class="ai-input-title">📋 Enganxa qualsevol informació</div>
      <p style="font-size:12px;color:var(--text-2);margin-bottom:10px">Email, notes, propostes... La IA extreu i importa automàticament.</p>
      <textarea id="ia-input" placeholder="Enganxa aquí emails, notes..."></textarea>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
        <button class="btn btn-primary" onclick="processarIA()">🤖 Processar amb IA</button>
        <span style="font-size:11px;color:var(--text-3)">~0,002€ per processament</span>
      </div>
    </div>
    <div id="ia-result" class="hidden">
      <div class="section-title">Resultat</div>
      <div class="card" id="ia-result-content"></div>
    </div>
    <div class="section-title" style="margin-top:24px">Accions ràpides</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <button class="btn" onclick="iaAccio('resum-pipeline')" style="text-align:left;padding:14px">📊 Resum executiu del pipeline</button>
      <button class="btn" onclick="regenerarOportunitats()" style="text-align:left;padding:14px">💡 Detectar oportunitats</button>
      <button class="btn" onclick="iaAccio('clients-fred')" style="text-align:left;padding:14px">🥶 Clients sense contacte 15+ dies</button>
    </div>
  `;
}

// ==================================================================
// CONFIG
// ==================================================================
function renderConfig() {
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar"><div><div class="page-title">Configuració</div><div class="page-sub">Models IA i preferències</div></div></div>
    <div class="section-title">Models d'IA</div>
    <div class="card">
      <div class="form-row"><label>Model tasques simples</label>
        <select id="cfg-fast">
          <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (ràpid, barat)</option>
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
        </select>
      </div>
      <div class="form-row"><label>Model tasques complexes</label>
        <select id="cfg-smart">
          <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
          <option value="claude-opus-4-6">Claude Opus 4.6</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="saveCfg()">💾 Guardar</button>
    </div>
    <div class="section-title" style="margin-top:24px">Sobre</div>
    <div class="card" style="font-size:12px;color:var(--text-2);line-height:1.7">
      <strong style="color:var(--text)">Brokkom CRM v2</strong> · Supabase + Vercel · Especialització sector transport
    </div>
  `;
  document.getElementById('cfg-fast').value = state.config.model_fast || 'claude-haiku-4-5-20251001';
  document.getElementById('cfg-smart').value = state.config.model_smart || 'claude-haiku-4-5-20251001';
}

window.saveCfg = async () => {
  const fast = document.getElementById('cfg-fast').value;
  const smart = document.getElementById('cfg-smart').value;
  const { error } = await supabase.from('user_config').upsert({ user_id: state.user.id, model_fast: fast, model_smart: smart });
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  state.config.model_fast = fast;
  state.config.model_smart = smart;
  toast('Guardat');
};

// ==================================================================
// DELETE GENERIC
// ==================================================================
window.deleteRecord = async (table, id, msg) => {
  if (!confirm(msg || 'Esborrar aquest registre?')) return;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  await refreshData(table);
  showTab(state.currentTab);
  toast('Esborrat');
};
