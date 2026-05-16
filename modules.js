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
    config: renderConfig,
    inbox: renderInbox,
    notes: renderNotes,
    agenda: renderAgenda,
    esborranys: renderEsborranys
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
  set('nav-inbox', state.inbox.filter(i => i.estat === 'pendent').length);
  set('nav-notes', state.notes.length);
  set('nav-esborranys', (state.esborranys || []).filter(e => e.estat !== 'arxivat').length);
  // Agenda: events d'avui i futurs
  const now = new Date(); now.setHours(0,0,0,0);
  set('nav-agenda', state.agenda.filter(e => new Date(e.data_inici) >= now).length);
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
  const allHashtags = [...new Set(state.clients.flatMap(c => c.hashtags || []))].sort();

  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Clients i contactes</div><div class="page-sub">${state.clients.length} clients · ${isAdmin()?'vista admin (tots)':'vista agent'}</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('client')">+ Nou client</button></div>
    </div>
    <div class="toolbar">
      <input type="text" id="search-clients" class="grow" placeholder="Cerca per empresa, CIF, contacte..." oninput="renderClientsList()">
      <select id="filter-clients-estat" onchange="renderClientsList()">
        <option value="">Tots els estats</option>
        <option value="prospect">Prospects</option>
        <option value="actiu">Clients actius</option>
        <option value="ex_client">Ex-clients</option>
      </select>
      <select id="filter-clients-sector" onchange="renderClientsList()">
        <option value="">Tots els sectors</option>
        <option>Transport mercaderies</option><option>Logística</option><option>Transport viatgers</option><option>ADR / mercaderies perilloses</option><option>Altres</option>
      </select>
      <select id="filter-clients-comprum" onchange="renderClientsList()">
        <option value="">Tots</option>
        <option value="si">COMPRUM ✓</option>
        <option value="no">No COMPRUM</option>
      </select>
      <select id="filter-clients-mediador" onchange="renderClientsList()">
        <option value="">Tots els mediadors</option>
        ${state.usuaris.map(u => `<option value="${u.id}">${u.nom || u.email}</option>`).join('')}
      </select>
    </div>
    ${allHashtags.length > 0 ? `
      <div style="margin-bottom:14px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.04em;margin-right:4px">Hashtags:</span>
        <span class="hashtag-pill" data-tag="" onclick="filterByHashtag('')">tots</span>
        ${allHashtags.map(t => `<span class="hashtag-pill" data-tag="${t}" onclick="filterByHashtag('${t}')">#${t}</span>`).join('')}
      </div>
    ` : ''}
    <div id="clients-list"></div>
  `;
  window._activeHashtag = '';
  renderClientsList();
}

window.filterByHashtag = (tag) => {
  window._activeHashtag = tag;
  document.querySelectorAll('.hashtag-pill').forEach(p => p.classList.toggle('selected', p.dataset.tag === tag));
  renderClientsList();
};

window.renderClientsList = () => {
  const q = (document.getElementById('search-clients')?.value || '').toLowerCase();
  const sector = document.getElementById('filter-clients-sector')?.value || '';
  const estat = document.getElementById('filter-clients-estat')?.value || '';
  const comprumF = document.getElementById('filter-clients-comprum')?.value || '';
  const mediador = document.getElementById('filter-clients-mediador')?.value || '';
  const tag = window._activeHashtag || '';
  const filtered = state.clients.filter(c => {
    if (sector && c.sector !== sector) return false;
    if (estat && (c.estat_client || 'prospect') !== estat) return false;
    if (comprumF === 'si' && !c.comprum) return false;
    if (comprumF === 'no' && c.comprum) return false;
    if (mediador && c.user_id !== mediador) return false;
    if (tag && !(c.hashtags || []).includes(tag)) return false;
    if (q && !c.empresa.toLowerCase().includes(q) && !(c.cif||'').toLowerCase().includes(q) && !(c.contacte||'').toLowerCase().includes(q)) return false;
    return true;
  });
  if (filtered.length === 0) {
    document.getElementById('clients-list').innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">🏢</div>Cap client trobat<br><br><button class="btn btn-primary" onclick="openModal(\'client\')">+ Crear client</button></div></div>';
    return;
  }
  const estatLabels = {prospect:'Prospect', actiu:'Client actiu', ex_client:'Ex-client'};
  const estatPills = {prospect:'p-info', actiu:'p-success', ex_client:'p-gray'};
  document.getElementById('clients-list').innerHTML = filtered.map(c => {
    const ofertes = state.ofertes.filter(o => o.client_id === c.id);
    const consolidats = state.consolidats.filter(co => co.client_id === c.id);
    const opps = state.oportunitats.filter(o => o.client_id === c.id && o.estat !== 'Descartada');
    const owner = state.usuaris.find(u => u.id === c.user_id);
    const ownerName = owner ? (owner.nom || owner.email.split('@')[0]) : 'sense propietari';
    const estatKey = c.estat_client || 'prospect';
    const haComprat = c.ha_comprat || consolidats.length > 0;
    return `<div class="card">
      <div class="card-row">
        <div style="flex:1;min-width:0">
          <div class="card-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${c.comprum ? '<span class="badge-comprum sm" title="COMPRUM">C</span>' : ''}
            ${c.empresa}
            ${haComprat ? '<span style="font-size:12px;opacity:0.7" title="Ha comprat alguna vegada">💰</span>' : ''}
          </div>
          <div class="card-sub">${c.cif||'—'}${c.activitat?' · '+c.activitat:c.sector?' · '+c.sector:''}${c.provincia?' · '+c.provincia:''}${c.treballadors?' · '+c.treballadors+' treb.':''} <span class="pill p-gray" style="margin-left:6px">${ownerName}</span></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:flex-start">
          <span class="pill ${estatPills[estatKey]}">${estatLabels[estatKey]}</span>
          ${c.origen?`<span class="pill p-gray" style="font-size:10px">${c.origen}</span>`:''}
          ${ofertes.length>0?`<span class="pill p-info">${ofertes.length} ofertes</span>`:''}
          ${consolidats.length>0?`<span class="pill p-success">${consolidats.length} tancades</span>`:''}
          ${opps.length>0?`<span class="pill p-purple">${opps.length} opps</span>`:''}
        </div>
      </div>
      ${(c.hashtags && c.hashtags.length) ? `<div style="margin-top:8px">${c.hashtags.map(t => `<span class="hashtag-pill" onclick="event.stopPropagation();filterByHashtag('${t}')">#${t}</span>`).join('')}</div>` : ''}
      <div class="info-grid">
        ${c.contacte?`<div class="info-row"><span class="info-label">Contacte</span><span class="info-val">${c.contacte}${c.carrec?' · '+c.carrec:''}</span></div>`:''}
        ${c.email?`<div class="info-row"><span class="info-label">Email</span><span class="info-val">${c.email}</span></div>`:''}
        ${c.telefon?`<div class="info-row"><span class="info-label">Telèfon</span><span class="info-val">${c.telefon} ${c.telefon ? `<a href="https://wa.me/${(c.telefon||'').replace(/[^0-9]/g,'')}" target="_blank" style="color:#25d366;text-decoration:none;margin-left:4px" title="WhatsApp">💬</a>` : ''}</span></div>`:''}
        ${c.facturacio?`<div class="info-row"><span class="info-label">Facturació</span><span class="info-val">${c.facturacio}</span></div>`:''}
        ${c.poblacio?`<div class="info-row"><span class="info-label">Població</span><span class="info-val">${c.poblacio}</span></div>`:''}
        ${c.adreca?`<div class="info-row"><span class="info-label">Adreça</span><span class="info-val">${c.adreca}</span></div>`:''}
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

// ==================================================================
// INBOX
// ==================================================================
function renderInbox() {
  const filtre = window._inboxFiltre || 'pendent';
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">📥 Inbox</div><div class="page-sub">Captura ràpida · revisa quan tinguis temps</div></div>
    </div>

    <div class="inbox-capture">
      <div class="inbox-capture-title">⚡ Captura ràpida</div>
      <div class="inbox-capture-tabs">
        <button class="inbox-capture-tab active" data-mode="text" onclick="switchCaptureMode('text')">📝 Text</button>
        <button class="inbox-capture-tab" data-mode="image" onclick="switchCaptureMode('image')">📷 Imatge / Foto</button>
      </div>

      <div id="capture-mode-text">
        <div class="inbox-capture-sub">Enganxa un email, una nota, una idea. Ctrl+Enter per guardar.</div>
        <textarea id="inbox-quick" placeholder="Enganxa text aquí..."></textarea>
        <div class="inbox-capture-actions">
          <button class="btn btn-primary" onclick="saveInboxQuick()">📥 Arxivar a inbox</button>
          <button class="btn" onclick="saveInboxQuick(true)">🤖 Arxivar i processar amb IA</button>
          <span style="font-size:11px;color:var(--text-3);margin-left:auto">${state.inbox.filter(i=>i.estat==='pendent').length} pendents</span>
        </div>
      </div>

      <div id="capture-mode-image" style="display:none">
        <div class="inbox-capture-sub">Foto de targeta, pòlissa, nota, document... La IA llegirà el text.</div>
        <div id="image-drop" class="image-drop-zone" onclick="document.getElementById('image-file').click()">
          <span class="icon">📷</span>
          <div class="text">Fes una foto o tria un fitxer</div>
          <div class="sub">JPG, PNG, WEBP — màxim 5 MB</div>
        </div>
        <input type="file" id="image-file" accept="image/*" capture="environment" style="display:none" onchange="handleImageSelected(event)">
        <div id="image-preview-area" style="margin-top:14px;display:none">
          <div id="image-preview-wrap"></div>
          <div id="image-titol-row" style="margin-top:10px">
            <input type="text" id="image-titol" placeholder="Títol opcional (ex: targeta fira Logistics 2026)">
          </div>
          <div class="inbox-capture-actions">
            <button class="btn btn-primary" onclick="saveInboxImage(true)">🤖 Pujar i processar amb IA</button>
            <button class="btn" onclick="saveInboxImage(false)">📥 Només arxivar</button>
            <button class="btn" onclick="resetImageCapture()">Cancel·lar</button>
          </div>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <select onchange="window._inboxFiltre=this.value;renderInboxList()">
        <option value="pendent" ${filtre==='pendent'?'selected':''}>Pendents</option>
        <option value="processat" ${filtre==='processat'?'selected':''}>Processats</option>
        <option value="" ${filtre===''?'selected':''}>Tots</option>
      </select>
    </div>

    <div id="inbox-list"></div>
  `;

  // Ctrl+Enter
  const ta = document.getElementById('inbox-quick');
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveInboxQuick();
    }
  });

  // Drag and drop
  const dropZone = document.getElementById('image-drop');
  ['dragover','dragenter'].forEach(ev => dropZone.addEventListener(ev, e => {e.preventDefault();dropZone.classList.add('drag-over')}));
  ['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, e => dropZone.classList.remove('drag-over')));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      document.getElementById('image-file').files = e.dataTransfer.files;
      handleImageSelected({target:{files: e.dataTransfer.files}});
    }
  });

  renderInboxList();
}

window.switchCaptureMode = (mode) => {
  document.querySelectorAll('.inbox-capture-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  document.getElementById('capture-mode-text').style.display = mode === 'text' ? '' : 'none';
  document.getElementById('capture-mode-image').style.display = mode === 'image' ? '' : 'none';
};

window.resetImageCapture = () => {
  document.getElementById('image-file').value = '';
  document.getElementById('image-preview-area').style.display = 'none';
  document.getElementById('image-preview-wrap').innerHTML = '';
  document.getElementById('image-titol').value = '';
  window._currentImageFile = null;
};

window.handleImageSelected = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('Imatge massa gran (màx 5 MB)','error');
    return;
  }
  if (!file.type.startsWith('image/')) {
    toast('Ha de ser una imatge','error');
    return;
  }
  window._currentImageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('image-preview-wrap').innerHTML = `
      <div class="image-preview">
        <img src="${e.target.result}" alt="Preview">
        <button class="remove" onclick="resetImageCapture()" title="Eliminar">×</button>
      </div>
    `;
    document.getElementById('image-preview-area').style.display = '';
  };
  reader.readAsDataURL(file);
};

window.saveInboxImage = async (alsoProcess) => {
  const file = window._currentImageFile;
  if (!file) { toast('Tria primer una imatge','error'); return; }
  const titol = document.getElementById('image-titol').value.trim() || null;

  toast('Pujant imatge...');
  // Path: userId/timestamp_random.ext
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${state.user.id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;

  // Upload to Supabase Storage
  const { error: upErr } = await supabase.storage.from('inbox-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (upErr) { toast('Error pujant: '+upErr.message,'error'); return; }

  // Get signed URL (private bucket)
  const { data: signedData, error: sigErr } = await supabase.storage.from('inbox-images')
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 any

  if (sigErr) { toast('Error URL: '+sigErr.message,'error'); return; }

  // Create inbox item
  const { data: item, error: insErr } = await supabase.from('inbox_items').insert({
    user_id: state.user.id,
    titol,
    contingut: titol || '(imatge — pendent de processar)',
    estat: 'pendent',
    imatge_url: signedData.signedUrl,
    imatge_path: path
  }).select().single();

  if (insErr) { toast('Error: '+insErr.message,'error'); return; }

  resetImageCapture();
  await refreshData('inbox');
  renderInboxList();
  toast('Imatge arxivada ✓');

  if (alsoProcess && item) {
    await processInboxImageIA(item.id);
  }
};

window.renderInboxList = () => {
  const filtre = window._inboxFiltre || 'pendent';
  let list = [...state.inbox].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  if (filtre) list = list.filter(i => i.estat === filtre);

  if (list.length === 0) {
    document.getElementById('inbox-list').innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">📥</div>Inbox buida<br><br><span style="font-size:12px">Captura coses i les revises després</span></div></div>';
    return;
  }

  document.getElementById('inbox-list').innerHTML = list.map(item => {
    const created = new Date(item.created_at);
    const isToday = created.toDateString() === new Date().toDateString();
    const timeStr = isToday ? created.toLocaleTimeString('ca-ES',{hour:'2-digit',minute:'2-digit'}) : created.toLocaleDateString('ca-ES');
    const previewText = (item.contingut||'').slice(0, 400);
    const isLong = (item.contingut||'').length > 400;
    const hasImage = !!item.imatge_url;
    return `<div class="inbox-item ${item.estat==='processat'?'processed':''} ${item.ia_processed?'suggested':''}" id="inbox-${item.id}">
      <div class="inbox-meta">
        <div style="flex:1">
          ${item.titol ? `<strong>${item.titol}</strong> · ` : ''}
          ${hasImage ? '<span class="pill p-purple" style="font-size:10px">📷 amb imatge</span> · ' : ''}
          <span class="inbox-time">${timeStr}</span>
          ${item.estat==='processat' ? '<span class="pill p-success" style="margin-left:6px">processat</span>' : ''}
        </div>
        <button class="btn btn-sm" onclick="deleteInboxItem('${item.id}','${item.imatge_path||''}')" style="color:var(--danger)">🗑</button>
      </div>
      ${hasImage ? `<img src="${item.imatge_url}" class="inbox-item-image" onclick="showImageLightbox('${item.imatge_url}')" alt="Imatge inbox">` : ''}
      <div class="inbox-content">${previewText}${isLong?`<a onclick="this.parentNode.textContent=${JSON.stringify(item.contingut)}" style="color:var(--primary-2);cursor:pointer">... veure tot</a>`:''}</div>
      ${item.ia_summary ? `<div class="inbox-ai-block"><strong>🤖 Resum IA</strong>${item.ia_summary}</div>` : ''}
      ${item.estat !== 'processat' ? `<div class="inbox-actions">
        ${!item.ia_processed ? (hasImage ? `<button class="btn btn-sm" onclick="processInboxImageIA('${item.id}')">🤖 Llegir imatge amb IA</button>` : `<button class="btn btn-sm" onclick="processInboxIA('${item.id}')">🤖 Processar amb IA</button>`) : ''}
        <button class="btn btn-sm" onclick="promoteInbox('${item.id}','client')">→ Client</button>
        <button class="btn btn-sm" onclick="promoteInbox('${item.id}','oferta')">→ Oferta</button>
        <button class="btn btn-sm" onclick="promoteInbox('${item.id}','tasca')">→ Tasca</button>
        <button class="btn btn-sm" onclick="promoteInbox('${item.id}','seguiment')">→ Seguiment</button>
        <button class="btn btn-sm" onclick="promoteInbox('${item.id}','nota')">→ Nota</button>
        <button class="btn btn-sm" onclick="markInboxProcessed('${item.id}','${item.imatge_path||''}')">✓ Marcar com a fet</button>
      </div>` : ''}
    </div>`;
  }).join('');
};

window.showImageLightbox = (url) => {
  const div = document.createElement('div');
  div.className = 'image-lightbox';
  div.onclick = () => div.remove();
  div.innerHTML = `<img src="${url}" alt="Imatge">`;
  document.body.appendChild(div);
};

window.deleteInboxItem = async (id, imagePath) => {
  if (!confirm('Esborrar aquesta entrada de la inbox?')) return;
  // Esborrar imatge del bucket si existeix
  if (imagePath) {
    await supabase.storage.from('inbox-images').remove([imagePath]);
  }
  await supabase.from('inbox_items').delete().eq('id', id);
  await refreshData('inbox');
  renderInboxList();
  toast('Esborrat');
};

window.processInboxImageIA = async (id) => {
  const item = state.inbox.find(i => i.id === id);
  if (!item || !item.imatge_path) return;
  const el = document.getElementById('inbox-'+id);
  const btn = el?.querySelector('.inbox-actions .btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loader"></span> Llegint imatge...'; }
  try {
    // Descarregar imatge i convertir-la a base64
    const { data: blob, error: dlErr } = await supabase.storage.from('inbox-images').download(item.imatge_path);
    if (dlErr) throw new Error('No es pot descarregar imatge: ' + dlErr.message);
    const base64 = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result.split(',')[1]);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const mediaType = blob.type || 'image/jpeg';

    const prompt = `Aquesta imatge ha estat capturada per a Brokkom Correduria de Seguros (sector transport). Analitza-la i retorna NOMÉS un JSON amb aquesta forma:

{
  "tipus_document": "targeta_visita|polissa|nota_manuscrita|factura|email_imprès|proposta_competidor|altre",
  "text_extret": "tot el text llegible de la imatge",
  "tipus_suggerit": "client|oferta|tasca|seguiment|nota|venciment",
  "resum": "2-3 frases del que diu",
  "dades_extretes": {
    "empresa": null,
    "contacte": null,
    "carrec": null,
    "telefon": null,
    "email": null,
    "data": null,
    "import": null,
    "ram": null,
    "asseguradora": null,
    "polissa_num": null
  },
  "alertes": []
}

Si una dada no apareix, posa-la com a null. NO inventis dades. Retorna NOMÉS el JSON.`;

    const resp = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        model: state.config?.model_fast || 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const txt = data.content[0].text;
    let summary = txt;
    let newContent = item.contingut;
    try {
      const cleaned = txt.replace(/```json\n?|\n?```/g,'').trim();
      const parsed = JSON.parse(cleaned);
      summary = `📄 Tipus: ${parsed.tipus_document || '?'}\n\n${parsed.resum || ''}`;
      if (parsed.dades_extretes) {
        const d = parsed.dades_extretes;
        const dades = [];
        if (d.empresa) dades.push(`Empresa: ${d.empresa}`);
        if (d.contacte) dades.push(`Contacte: ${d.contacte}${d.carrec?' ('+d.carrec+')':''}`);
        if (d.email) dades.push(`Email: ${d.email}`);
        if (d.telefon) dades.push(`Telèfon: ${d.telefon}`);
        if (d.ram) dades.push(`Ram: ${d.ram}`);
        if (d.asseguradora) dades.push(`Asseguradora: ${d.asseguradora}`);
        if (d.polissa_num) dades.push(`Pòlissa nº: ${d.polissa_num}`);
        if (d.import) dades.push(`Import: ${d.import}€`);
        if (d.data) dades.push(`Data: ${d.data}`);
        if (dades.length) summary += '\n\n📋 ' + dades.join(' · ');
      }
      if (parsed.alertes?.length) summary += '\n\n⚠️ ' + parsed.alertes.join(' · ');
      if (parsed.tipus_suggerit) summary += `\n\n💡 Suggereix: convertir a ${parsed.tipus_suggerit}`;
      if (parsed.text_extret) newContent = parsed.text_extret;
    } catch(e) {
      summary = txt;
    }
    await supabase.from('inbox_items').update({
      ia_processed: true,
      ia_summary: summary,
      contingut: newContent
    }).eq('id', id);
    await refreshData('inbox');
    renderInboxList();
    toast('Imatge processada ✓');
  } catch (err) {
    toast('Error IA: '+err.message,'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '🤖 Llegir imatge amb IA'; }
  }
};

window.saveInboxQuick = async (alsoProcess = false) => {
  const text = document.getElementById('inbox-quick').value.trim();
  if (!text) { toast('Posa contingut primer','error'); return; }
  const { data, error } = await supabase.from('inbox_items').insert({
    user_id: state.user.id,
    contingut: text,
    estat: 'pendent'
  }).select().single();
  if (error) { toast('Error: '+error.message,'error'); return; }
  document.getElementById('inbox-quick').value = '';
  await refreshData('inbox');
  renderInboxList();
  toast('Arxivat a inbox');
  if (alsoProcess && data) {
    await processInboxIA(data.id);
  }
};

window.processInboxIA = async (id) => {
  const item = state.inbox.find(i => i.id === id);
  if (!item) return;
  const el = document.getElementById('inbox-'+id);
  const btn = el?.querySelector('.inbox-actions .btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loader"></span> Processant...'; }
  try {
    const prompt = `Ets el CRM intel·ligent de Brokkom Correduria de Seguros (sector transport). Analitza aquest text i retorna NOMÉS un JSON amb aquesta forma:

{
  "tipus_suggerit": "client|oferta|tasca|seguiment|nota|venciment",
  "resum": "2-3 frases del que diu el text",
  "dades_extretes": {
    "empresa": "...",
    "contacte": "...",
    "telefon": "...",
    "email": "...",
    "data": "YYYY-MM-DD",
    "import": null,
    "ram": "..."
  },
  "alertes": ["coses importants detectades..."]
}

Si una dada no apareix, posa-la com a null. Si veus convenis col·lectius, marca alerta d'oportunitat RC Patronal. Si veus mencions de venciments amb data, suggereix tipus "venciment".

TEXT:
${item.contingut}

Retorna NOMÉS el JSON.`;

    const resp = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        model: state.config?.model_fast || 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{role:'user', content: prompt}]
      })
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const txt = data.content[0].text;
    let summary = txt;
    try {
      const cleaned = txt.replace(/```json\n?|\n?```/g,'').trim();
      const parsed = JSON.parse(cleaned);
      summary = `${parsed.resum || ''}`;
      if (parsed.dades_extretes) {
        const d = parsed.dades_extretes;
        const dades = [];
        if (d.empresa) dades.push(`Empresa: ${d.empresa}`);
        if (d.contacte) dades.push(`Contacte: ${d.contacte}`);
        if (d.email) dades.push(`Email: ${d.email}`);
        if (d.telefon) dades.push(`Telèfon: ${d.telefon}`);
        if (d.ram) dades.push(`Ram: ${d.ram}`);
        if (d.import) dades.push(`Import: ${d.import}€`);
        if (d.data) dades.push(`Data: ${d.data}`);
        if (dades.length) summary += '\n\n📋 ' + dades.join(' · ');
      }
      if (parsed.alertes?.length) summary += '\n\n⚠️ ' + parsed.alertes.join(' · ');
      if (parsed.tipus_suggerit) summary += `\n\n💡 Suggereix: convertir a ${parsed.tipus_suggerit}`;
    } catch(e) {
      summary = txt;
    }
    await supabase.from('inbox_items').update({
      ia_processed: true,
      ia_summary: summary
    }).eq('id', id);
    await refreshData('inbox');
    renderInboxList();
    toast('Processat amb IA');
  } catch (err) {
    toast('Error IA: '+err.message,'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '🤖 Processar amb IA'; }
  }
};

window.promoteInbox = async (id, target) => {
  const item = state.inbox.find(i => i.id === id);
  if (!item) return;
  if (target === 'client') {
    openModal('client', { notes: item.contingut, _fromInbox: id, _imagePath: item.imatge_path });
  } else if (target === 'oferta') {
    openModal('oferta', { notes: item.contingut, _fromInbox: id, _imagePath: item.imatge_path });
  } else if (target === 'tasca') {
    openModal('tasca', { descripcio: item.contingut, titol: (item.titol || item.contingut.slice(0,60)), _fromInbox: id, _imagePath: item.imatge_path });
  } else if (target === 'seguiment') {
    openModal('seguiment', { resum: item.contingut, _fromInbox: id, _imagePath: item.imatge_path });
  } else if (target === 'nota') {
    // Crear directament una nota
    const { error } = await supabase.from('notes').insert({
      user_id: state.user.id,
      titol: item.titol || item.contingut.slice(0,60),
      contingut: item.contingut
    });
    if (error) { toast('Error: '+error.message,'error'); return; }
    // Esborrar imatge del bucket si existeix
    if (item.imatge_path) {
      await supabase.storage.from('inbox-images').remove([item.imatge_path]);
    }
    await supabase.from('inbox_items').update({ estat: 'processat', imatge_url: null, imatge_path: null }).eq('id', id);
    await refreshData('inbox');
    await refreshData('notes');
    renderInboxList();
    toast('Convertit a nota ✓');
  }
};

window.markInboxProcessed = async (id, imagePath) => {
  // Si té imatge, l'esborrem del bucket (mantenim les dades extretes)
  if (imagePath) {
    await supabase.storage.from('inbox-images').remove([imagePath]);
    await supabase.from('inbox_items').update({ estat: 'processat', imatge_url: null, imatge_path: null }).eq('id', id);
  } else {
    await supabase.from('inbox_items').update({ estat: 'processat' }).eq('id', id);
  }
  await refreshData('inbox');
  renderInboxList();
  toast('Marcat com a fet');
};

// ==================================================================
// NOTES
// ==================================================================
function renderNotes() {
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">💭 Notes / Idees</div><div class="page-sub">Calaix de sastre · ${state.notes.length} notes</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('nota')">+ Nova nota</button></div>
    </div>
    <div class="toolbar">
      <input type="text" id="search-notes" class="grow" placeholder="Cerca per títol o contingut..." oninput="renderNotesList()">
      <select id="filter-notes-fav" onchange="renderNotesList()">
        <option value="">Totes</option>
        <option value="fav">Favorites ⭐</option>
      </select>
    </div>
    <div id="notes-list"></div>
  `;
  renderNotesList();
}

window.renderNotesList = () => {
  const q = (document.getElementById('search-notes')?.value || '').toLowerCase();
  const favF = document.getElementById('filter-notes-fav')?.value || '';
  let list = [...state.notes].sort((a,b) => {
    if (a.favorita && !b.favorita) return -1;
    if (!a.favorita && b.favorita) return 1;
    return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
  });
  if (favF === 'fav') list = list.filter(n => n.favorita);
  if (q) list = list.filter(n => (n.titol||'').toLowerCase().includes(q) || (n.contingut||'').toLowerCase().includes(q));
  if (list.length === 0) {
    document.getElementById('notes-list').innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">💭</div>Cap nota encara<br><br><button class="btn btn-primary" onclick="openModal(\'nota\')">+ Crear primera nota</button></div></div>';
    return;
  }
  document.getElementById('notes-list').innerHTML = list.map(n => {
    const cli = n.client_id ? state.clients.find(c => c.id === n.client_id) : null;
    return `<div class="note-card ${n.favorita?'favorita':''}">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div style="flex:1;min-width:0">
          ${n.titol ? `<div class="note-title">${n.titol}</div>` : ''}
          ${cli ? `<div style="font-size:11px;color:var(--text-3);margin-bottom:4px">📎 ${cli.empresa}</div>` : ''}
          <div class="note-body">${n.contingut}</div>
        </div>
        <span class="note-fav-star ${n.favorita?'on':''}" onclick="toggleFavoritaNota('${n.id}')" title="Favorita">${n.favorita?'⭐':'☆'}</span>
      </div>
      <div class="note-meta">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${(n.hashtags||[]).map(t => `<span class="hashtag-pill">#${t}</span>`).join('')}
          <span class="pill p-gray" style="font-size:10px">${new Date(n.updated_at || n.created_at).toLocaleDateString('ca-ES')}</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick='openModal("nota",${JSON.stringify(n).replace(/'/g,"&#39;")})'>✏️</button>
          <button class="btn btn-sm" onclick="deleteRecord('notes','${n.id}','Esborrar aquesta nota?')" style="color:var(--danger)">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
};

window.toggleFavoritaNota = async (id) => {
  const n = state.notes.find(x => x.id === id);
  if (!n) return;
  await supabase.from('notes').update({ favorita: !n.favorita }).eq('id', id);
  await refreshData('notes');
  renderNotesList();
};

// ==================================================================
// AGENDA
// ==================================================================
function renderAgenda() {
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">📅 Agenda</div><div class="page-sub">Esdeveniments propis + venciments + tasques + seguiments</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('agenda_event')">+ Nou esdeveniment</button></div>
    </div>
    <div class="toolbar">
      <select id="filter-agenda" onchange="renderAgendaList()">
        <option value="setmana">Aquesta setmana</option>
        <option value="mes">Aquest mes</option>
        <option value="tot">Tot el futur</option>
        <option value="passat">Esdeveniments passats</option>
      </select>
    </div>
    <div id="agenda-list"></div>
  `;
  renderAgendaList();
}

window.renderAgendaList = () => {
  const filtre = document.getElementById('filter-agenda')?.value || 'setmana';
  const now = new Date();
  const today = new Date(); today.setHours(0,0,0,0);
  const endWeek = new Date(today); endWeek.setDate(today.getDate()+7);
  const endMonth = new Date(today.getFullYear(), today.getMonth()+1, today.getDate());

  // Construir llista combinada
  let allEvents = [];

  // Esdeveniments propis
  state.agenda.forEach(e => {
    allEvents.push({
      id: 'a_'+e.id,
      origin: 'agenda',
      title: e.titol,
      sub: e.descripcio || (e.client_id ? state.clients.find(c=>c.id===e.client_id)?.empresa : ''),
      date: new Date(e.data_inici),
      raw: e,
      tag: e.tot_el_dia ? 'tot el dia' : null
    });
  });
  // Venciments
  state.venciments.forEach(v => {
    const d = new Date(v.data_venciment);
    allEvents.push({
      id: 'v_'+v.id,
      origin: 'venciment',
      title: '🛡️ Venciment: ' + v.empresa,
      sub: v.ram + (v.asseguradora ? ' · '+v.asseguradora : ''),
      date: d,
      raw: v,
      tag: 'venciment'
    });
  });
  // Tasques amb data
  state.tasques.filter(t => t.data_limit && t.estat === 'pendent').forEach(t => {
    allEvents.push({
      id: 't_'+t.id,
      origin: 'tasca',
      title: '✓ ' + t.titol,
      sub: t.descripcio || '',
      date: new Date(t.data_limit),
      raw: t,
      tag: 'tasca'
    });
  });
  // Seguiments futurs
  state.seguiments.filter(s => new Date(s.data) >= today).forEach(s => {
    const cli = state.clients.find(c => c.id === s.client_id);
    allEvents.push({
      id: 's_'+s.id,
      origin: 'seguiment',
      title: '📞 Seguiment: ' + (cli?.empresa || '?'),
      sub: s.proper_pas || s.resum || '',
      date: new Date(s.data),
      raw: s,
      tag: 'seguiment'
    });
  });

  // Filtrar
  if (filtre === 'setmana') allEvents = allEvents.filter(e => e.date >= today && e.date <= endWeek);
  else if (filtre === 'mes') allEvents = allEvents.filter(e => e.date >= today && e.date <= endMonth);
  else if (filtre === 'tot') allEvents = allEvents.filter(e => e.date >= today);
  else if (filtre === 'passat') allEvents = allEvents.filter(e => e.date < today);

  allEvents.sort((a,b) => a.date - b.date);

  if (allEvents.length === 0) {
    document.getElementById('agenda-list').innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">📅</div>Cap esdeveniment en aquest període</div></div>';
    return;
  }

  // Agrupar per dia
  const grouped = {};
  allEvents.forEach(e => {
    const k = e.date.toISOString().slice(0,10);
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(e);
  });

  let html = '';
  Object.keys(grouped).sort().forEach(k => {
    const d = new Date(k);
    const isToday = d.toDateString() === new Date().toDateString();
    const dayName = d.toLocaleDateString('ca-ES',{weekday:'long', day:'numeric', month:'long'});
    html += `<div class="agenda-day-header ${isToday?'today':''}">${dayName}${isToday?' · avui':''} <span class="day-count">${grouped[k].length} esdeveniments</span></div>`;
    grouped[k].forEach(e => {
      const isPast = e.date < new Date() && !isToday;
      const time = e.tag === 'tot el dia' || (e.origin !== 'agenda') ? '—' : e.date.toLocaleTimeString('ca-ES',{hour:'2-digit',minute:'2-digit'});
      const calBtn = e.origin === 'agenda' ? `<button class="btn btn-sm" onclick="event.stopPropagation();syncToGoogleCalendar('${e.raw.id}')" title="Sincronitzar amb Google Calendar">📅</button>` : '';
      const delBtn = e.origin === 'agenda' ? `<button class="btn btn-sm" onclick="event.stopPropagation();deleteRecord('agenda_events','${e.raw.id}','Esborrar esdeveniment?')" style="color:var(--danger)">🗑</button>` : '';
      const editBtn = e.origin === 'agenda' ? `<button class="btn btn-sm" onclick='event.stopPropagation();openModal("agenda_event",${JSON.stringify(e.raw).replace(/'/g,"&#39;")})'>✏️</button>` : '';
      html += `<div class="agenda-event from-${e.origin} ${isPast?'past':''}">
        <div class="agenda-event-time">${time}</div>
        <div style="flex:1;min-width:0">
          <div class="agenda-event-title">${e.title}<span class="agenda-tag">${e.tag||e.origin}</span></div>
          ${e.sub ? `<div class="agenda-event-sub">${e.sub}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px">${editBtn}${calBtn}${delBtn}</div>
      </div>`;
    });
  });

  document.getElementById('agenda-list').innerHTML = html;
};

window.syncToGoogleCalendar = (eventId) => {
  const e = state.agenda.find(x => x.id === eventId);
  if (!e) return;
  const start = new Date(e.data_inici);
  const end = e.data_fi ? new Date(e.data_fi) : new Date(start.getTime() + 60*60*1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  const cli = e.client_id ? state.clients.find(c=>c.id===e.client_id)?.empresa : '';
  const details = (e.descripcio||'') + (cli?`\n\nClient: ${cli}`:'') + (e.ubicacio?`\n\nUbicació: ${e.ubicacio}`:'');
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.titol)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(details)}${e.ubicacio?'&location='+encodeURIComponent(e.ubicacio):''}`;
  window.open(url,'_blank');
  // Marcar com a sincronitzat
  supabase.from('agenda_events').update({ google_calendar_synced: true }).eq('id', eventId);
  toast('Obrint Google Calendar...');
};
// ==================================================================
// ESBORRANYS
// ==================================================================
const TIPUS_ESBORRANY = [
  {v:'email', n:'📧 Email'},
  {v:'trucada', n:'📞 Trucada'},
  {v:'proposta', n:'💼 Proposta'},
  {v:'post', n:'📰 Post LinkedIn'},
  {v:'whatsapp', n:'💬 WhatsApp'},
  {v:'altre', n:'📝 Altre'}
];
const ESTATS_ESBORRANY = [
  {v:'en_borrador', n:'En borrador'},
  {v:'llest', n:'Llest per enviar'},
  {v:'diferit', n:'Diferit'},
  {v:'arxivat', n:'Arxivat'}
];
window.TIPUS_ESBORRANY = TIPUS_ESBORRANY;
window.ESTATS_ESBORRANY = ESTATS_ESBORRANY;

function renderEsborranys() {
  document.getElementById('tab-content').innerHTML = `
    <div class="topbar">
      <div><div class="page-title">📝 Esborranys</div><div class="page-sub">Coses a mig fer · per recuperar després</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('esborrany')">+ Nou esborrany</button></div>
    </div>
    <div class="toolbar">
      <input type="text" id="search-esborrany" class="grow" placeholder="Cerca per títol o contingut..." oninput="renderEsborranysList()">
      <select id="filter-esborrany-estat" onchange="renderEsborranysList()">
        <option value="">Tots els estats</option>
        ${ESTATS_ESBORRANY.map(e => `<option value="${e.v}">${e.n}</option>`).join('')}
      </select>
      <select id="filter-esborrany-tipus" onchange="renderEsborranysList()">
        <option value="">Tots els tipus</option>
        ${TIPUS_ESBORRANY.map(t => `<option value="${t.v}">${t.n}</option>`).join('')}
      </select>
    </div>
    <div id="esborrany-list"></div>
  `;
  renderEsborranysList();
}

window.renderEsborranysList = () => {
  const q = (document.getElementById('search-esborrany')?.value || '').toLowerCase();
  const estat = document.getElementById('filter-esborrany-estat')?.value || '';
  const tipus = document.getElementById('filter-esborrany-tipus')?.value || '';
  let list = [...(state.esborranys||[])].sort((a,b) => new Date(b.updated_at||b.created_at) - new Date(a.updated_at||a.created_at));
  if (estat) list = list.filter(e => e.estat === estat);
  if (tipus) list = list.filter(e => e.tipus === tipus);
  if (q) list = list.filter(e => (e.titol||'').toLowerCase().includes(q) || (e.contingut||'').toLowerCase().includes(q));

  if (list.length === 0) {
    document.getElementById('esborrany-list').innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">📝</div>Cap esborrany<br><br><button class="btn btn-primary" onclick="openModal(\'esborrany\')">+ Crear primer esborrany</button></div></div>';
    return;
  }

  document.getElementById('esborrany-list').innerHTML = list.map(e => {
    const cli = e.client_id ? state.clients.find(c => c.id === e.client_id) : null;
    const tipusObj = TIPUS_ESBORRANY.find(t => t.v === e.tipus) || TIPUS_ESBORRANY[5];
    const estatObj = ESTATS_ESBORRANY.find(es => es.v === e.estat) || ESTATS_ESBORRANY[0];
    const dataPrevista = e.data_prevista ? new Date(e.data_prevista) : null;
    const dataPrevistaStr = dataPrevista ? dataPrevista.toLocaleDateString('ca-ES',{day:'numeric',month:'short',year:'numeric'}) : null;
    return `<div class="esborrany-card estat-${e.estat}">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <span class="esborrany-tipus">${tipusObj.n}</span>
            <span class="pill ${e.estat==='llest'?'p-success':e.estat==='diferit'?'p-pend':e.estat==='arxivat'?'p-gray':'p-info'}">${estatObj.n}</span>
            ${cli ? `<span class="pill p-gray">📎 ${cli.empresa}</span>` : ''}
            ${dataPrevistaStr ? `<span class="pill p-info">⏰ ${dataPrevistaStr}</span>` : ''}
          </div>
          <div class="card-title">${e.titol}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick='openModal("esborrany",${JSON.stringify(e).replace(/'/g,"&#39;")})'>✏️ Obrir</button>
          <button class="btn btn-sm" onclick="copyEsborrany('${e.id}')">📋 Copiar</button>
          <button class="btn btn-sm" onclick="deleteRecord('esborranys','${e.id}','Esborrar?')" style="color:var(--danger)">🗑</button>
        </div>
      </div>
      ${e.contingut ? `<div class="esborrany-preview collapsed">${e.contingut}</div>` : ''}
    </div>`;
  }).join('');
};

window.copyEsborrany = async (id) => {
  const e = state.esborranys.find(x => x.id === id);
  if (!e || !e.contingut) { toast('Sense contingut','error'); return; }
  await navigator.clipboard.writeText(e.contingut);
  toast('Copiat al portapapers');
};
