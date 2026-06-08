// ==================================================================
// BROKKOM CRM · modules.js v1 — Renderitzadors Notion
// ==================================================================
console.log('📦 modules.js carregat');

// ==================================================================
// HELPERS COMUNS
// ==================================================================
function renderUserAvatar(userId, size='sm') {
  const m = window.getMediadorByUserId ? window.getMediadorByUserId(userId) : null;
  const nom = m?.nom || m?.email || '?';
  const initials = window.getInitials ? window.getInitials(nom) : '?';
  const color = window.getAvatarColor ? window.getAvatarColor(userId) : '#0F766E';
  return `<span class="avatar ${size}" style="background:${color}" title="${nom}">${initials}</span>`;
}
function renderMediadorCell(userId) {
  const m = window.getMediadorByUserId(userId);
  const nom = m?.nom || (userId === state.user?.id ? 'Tu' : '?');
  return `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-2)">
    ${renderUserAvatar(userId)}
    <span>${nom}</span>
  </div>`;
}
function renderSharedAvatars(recursTipus, recursId) {
  const shares = window.getSharedWith(recursTipus, recursId);
  if (shares.length === 0) return '';
  return `<div class="avatar-stack" style="margin-left:4px">
    ${shares.slice(0,3).map(s => renderUserAvatar(s.compartit_amb_id, 'sm')).join('')}
    ${shares.length > 3 ? `<span style="font-size:10px;color:var(--text-3);margin-left:4px">+${shares.length-3}</span>` : ''}
  </div>`;
}
function getClient(id) { return state.clients.find(c => c.id === id); }
function getClientNom(c) {
  if (!c) return '?';
  return c.tipus === 'particular' ? (c.nom || c.empresa || '?') : (c.empresa || c.nom || '?');
}

// ==================================================================
// DASHBOARD
// ==================================================================
window.renderDashboard = function() {
  const c = document.getElementById('tab-content');
  const ofertesObertes = state.ofertes.filter(o => !['Tancada guanyada','Tancada perduda'].includes(o.estat));
  const now = new Date();
  const tancMes = state.consolidats.filter(co => {
    const d = new Date(co.data_tancament);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const primaPipeline = ofertesObertes.reduce((s,o) => s + (parseFloat(o.prima_brokkom)||0), 0);
  const primaTancMes = tancMes.reduce((s,co) => s + (parseFloat(co.prima_anual)||0), 0);
  const totalTanc = state.consolidats.length;
  const totalOfertesFin = state.ofertes.filter(o => ['Tancada guanyada','Tancada perduda'].includes(o.estat)).length + state.consolidats.length;
  const conversio = totalOfertesFin > 0 ? Math.round((totalTanc/totalOfertesFin)*100) : 0;

  // Alarmes properes
  const alarmes = [];
  state.venciments.forEach(v => {
    [90,30,7].forEach(d => {
      const dataAlarma = new Date(v.data_venciment);
      dataAlarma.setDate(dataAlarma.getDate() - d);
      const dies = daysFromNow(dataAlarma);
      if (dies >= 0 && dies <= 90) {
        alarmes.push({
          data: dataAlarma,
          titol: `${d===90?'Preparar oferta':d===30?'URGENT renovació':'CRÍTIC venciment'} — ${v.empresa}`,
          sub: `${v.ram||''} · venç ${fmtDate(v.data_venciment)}`,
          tipus: d
        });
      }
    });
  });
  alarmes.sort((a,b) => a.data - b.data);

  // Accions prioritàries
  const accions = [];
  state.ofertes.filter(o => o.estat === 'Oferta enviada').forEach(o => {
    const ultim = state.seguiments.filter(s => s.client_id === o.client_id).sort((a,b) => new Date(b.data) - new Date(a.data))[0];
    if (!ultim || daysFromNow(ultim.data) < -15) {
      accions.push({
        tipus: 'danger',
        titol: `Seguiment fred: ${o.empresa || getClientNom(getClient(o.client_id))}`,
        sub: ultim ? `Sense contacte ${-daysFromNow(ultim.data)} dies` : 'Sense seguiment',
        accio: () => openModal('seguiment', { client_id: o.client_id })
      });
    }
  });
  state.tasques.filter(t => t.estat === 'pendent' && t.prioritat === 'Alta').slice(0,3).forEach(t => {
    accions.push({ tipus:'warning', titol: t.titol, sub: t.descripcio||'', accio: () => showTab('tasques') });
  });

  const today = new Date().toLocaleDateString('ca-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  c.innerHTML = `
    <div class="topbar">
      <div>
        <div class="page-title">Tauler</div>
        <div class="page-sub">${today}</div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-primary" onclick="openModal('client')">+ Nou client</button>
      </div>
    </div>

    <div class="metrics">
      <div class="metric"><div class="metric-label">Pipeline obert</div><div class="metric-value">${ofertesObertes.length}</div><div class="metric-sub">${fmtEur(primaPipeline)} valor</div></div>
      <div class="metric"><div class="metric-label">Tancaments mes</div><div class="metric-value">${tancMes.length}</div><div class="metric-sub">${fmtEur(primaTancMes)} primat</div></div>
      <div class="metric"><div class="metric-label">Taxa conversió</div><div class="metric-value">${conversio}%</div><div class="metric-sub">històrica</div></div>
      <div class="metric"><div class="metric-label">Clients</div><div class="metric-value">${state.clients.length}</div><div class="metric-sub">a la cartera</div></div>
      <div class="metric"><div class="metric-label">Oportunitats</div><div class="metric-value">${state.oportunitats.filter(o => o.estat !== 'Descartada').length}</div><div class="metric-sub">detectades</div></div>
      <div class="metric"><div class="metric-label">Tasques pend.</div><div class="metric-value" style="${state.tasques.filter(t => t.estat==='pendent').length>0?'color:var(--warning)':''}">${state.tasques.filter(t => t.estat==='pendent').length}</div><div class="metric-sub">a fer</div></div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
      <div>
        <div class="section-title">Pipeline — vista resum</div>
        <div class="card">
          ${(window.ESTATS_PIPELINE||[]).slice(0,5).map(estat => {
            const items = state.ofertes.filter(o => o.estat === estat);
            const tot = items.reduce((s,o) => s + (parseFloat(o.prima_brokkom)||0), 0);
            const pct = ofertesObertes.length>0 ? (items.length/ofertesObertes.length)*100 : 0;
            return `<div class="chart-bar">
              <div class="chart-label">${estat}</div>
              <div class="chart-track"><div class="chart-fill" style="width:${pct}%"></div></div>
              <div class="chart-value">${items.length} · ${fmtEur(tot)}</div>
            </div>`;
          }).join('') || '<div class="empty-state">Sense ofertes obertes</div>'}
        </div>

        <div class="section-title" style="margin-top:24px">Tancaments del mes</div>
        <div class="card">
          ${tancMes.length === 0 ? '<div class="empty-state">Cap tancament aquest mes</div>' :
            tancMes.slice(0,5).map(co => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid var(--border);font-size:13px">
                <div><strong>${co.empresa}</strong> · ${co.ram||''}<br><span style="font-size:11px;color:var(--text-3)">${co.asseguradora||''} · ${fmtDate(co.data_tancament)}</span></div>
                <div style="text-align:right"><strong style="color:var(--success)">${fmtEur(co.prima_anual)}</strong></div>
              </div>
            `).join('')
          }
        </div>
      </div>

      <div>
        <div class="section-title">Properes alarmes</div>
        <div class="card">
          ${alarmes.length === 0 ? '<div class="empty-state">Cap alarma propera</div>' :
            alarmes.slice(0,5).map(a => `
              <div class="alarm-item">
                <div class="alarm-date">
                  <div class="alarm-day">${a.data.getDate()}</div>
                  <div class="alarm-month">${a.data.toLocaleDateString('ca-ES',{month:'short'})}</div>
                </div>
                <div class="alarm-body">
                  <div class="alarm-title">${a.titol}</div>
                  <div class="alarm-sub">${a.sub}</div>
                </div>
                <div class="alarm-dot ${a.tipus===7?'dot-r':a.tipus===30?'dot-a':'dot-g'}"></div>
              </div>
            `).join('')
          }
        </div>

        <div class="section-title" style="margin-top:24px">Accions prioritàries</div>
        ${accions.length === 0 ? '<div class="card"><div class="empty-state">Cap acció urgent</div></div>' :
          accions.slice(0,4).map((a,i) => `
            <div class="card compact" style="border-left:3px solid ${a.tipus==='danger'?'var(--danger)':'var(--warning)'};border-radius:0 var(--r-md) var(--r-md) 0;cursor:pointer" onclick="window._dashActions[${i}]()">
              <div style="font-size:13px;font-weight:500">${a.titol}</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:2px">${a.sub}</div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;
  window._dashActions = accions.map(a => a.accio);
};

// ==================================================================
// CLIENTS — Llistat amb columna Mediador
// ==================================================================
window.renderClients = function() {
  const c = document.getElementById('tab-content');
  if (state._clientObert) { renderFitxaClient(state._clientObert); return; }

  const q = (state._filterClientsQ || '').toLowerCase();
  const tipusF = state._filterClientsTipus || '';
  const sectorF = state._filterClientsSector || '';
  const mediadorF = state._filterClientsMediador || '';

  let filtered = state.clients.filter(c => {
    if (tipusF && (c.tipus||'empresa') !== tipusF) return false;
    if (sectorF && c.sector !== sectorF) return false;
    if (mediadorF && c.user_id !== mediadorF) return false;
    if (q) {
      const nom = getClientNom(c).toLowerCase();
      const cif = (c.cif||c.dni||'').toLowerCase();
      const contacte = (c.contacte||'').toLowerCase();
      if (!nom.includes(q) && !cif.includes(q) && !contacte.includes(q)) return false;
    }
    return true;
  });

  c.innerHTML = `
    <div class="topbar">
      <div>
        <div class="breadcrumb">Workspace · Clients</div>
        <div class="page-title">Clients</div>
        <div class="page-sub">${filtered.length}${filtered.length !== state.clients.length ? ' de '+state.clients.length : ''} clients</div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-primary" onclick="openModal('client')">+ Nou</button>
      </div>
    </div>

    <div class="toolbar">
      <input type="text" placeholder="Cerca per empresa, nom, CIF..." value="${state._filterClientsQ||''}" oninput="state._filterClientsQ=this.value;renderClients()" class="grow">

      <button class="btn btn-pill ${tipusF===''?'active':''}" onclick="state._filterClientsTipus='';renderClients()">Tots</button>
      <button class="btn btn-pill ${tipusF==='empresa'?'active':''}" onclick="state._filterClientsTipus='empresa';renderClients()">🏢 Empreses</button>
      <button class="btn btn-pill ${tipusF==='particular'?'active':''}" onclick="state._filterClientsTipus='particular';renderClients()">👤 Particulars</button>

      ${window.isAdmin() ? `
        <select onchange="state._filterClientsMediador=this.value;renderClients()" style="flex:0 1 auto">
          <option value="">Tots mediadors</option>
          ${state.mediadors.map(m => `<option value="${m.user_id}" ${mediadorF===m.user_id?'selected':''}>${m.nom||m.email}</option>`).join('')}
        </select>
      ` : ''}
    </div>

    ${filtered.length === 0 ? `
      <div class="card"><div class="empty-state">
        <div class="empty-icon">👥</div>
        Cap client troba't<br><br>
        <button class="btn btn-primary" onclick="openModal('client')">+ Crear primer client</button>
      </div></div>
    ` : `
      <div class="db-table">
        <div class="db-header" style="grid-template-columns:24px 2fr 1.2fr ${window.isAdmin()?'1fr':''} 90px 70px">
          <span></span>
          <span>Empresa / Nom</span>
          <span>Contacte</span>
          ${window.isAdmin() ? '<span>Mediador</span>' : ''}
          <span>Tipus</span>
          <span>Estat</span>
        </div>
        ${filtered.map(c => {
          const ofertes = state.ofertes.filter(o => o.client_id === c.id && !['Tancada guanyada','Tancada perduda'].includes(o.estat));
          const consol = state.consolidats.filter(co => co.client_id === c.id);
          const opps = state.oportunitats.filter(o => o.client_id === c.id && o.estat !== 'Descartada');
          const ic = c.tipus === 'particular' ? '👤' : '🏢';
          const estat = consol.length > 0 ? 'actiu' : ofertes.length > 0 ? 'prospect' : 'lead';
          const estatPill = estat === 'actiu' ? 'p-success' : estat === 'prospect' ? 'p-info' : 'p-gray';
          const nom = getClientNom(c);
          const contacteVal = c.tipus === 'particular' ? (c.email || c.telefon || '') : (c.contacte || c.email || '—');
          const subVal = c.tipus === 'particular' ? (c.professio || '') : (c.cif || c.sector || '');

          return `<div class="db-row" style="grid-template-columns:24px 2fr 1.2fr ${window.isAdmin()?'1fr':''} 90px 70px" onclick="state._clientObert='${c.id}';renderClients()">
            <span>${ic}</span>
            <div>
              <div style="color:var(--text);display:flex;align-items:center;gap:6px">
                <span style="font-weight:500">${nom}</span>
                ${consol.length>0 ? `<span class="pill p-success">${consol.length}</span>` : ''}
                ${opps.length>0 ? `<span class="pill p-purple">${opps.length} opps</span>` : ''}
              </div>
              <div style="font-size:11px;color:var(--text-3);margin-top:1px">${subVal}</div>
            </div>
            <div style="font-size:12px;color:var(--text-2);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${contacteVal}</div>
            ${window.isAdmin() ? `<div>${renderMediadorCell(c.user_id)}${renderSharedAvatars('client', c.id)}</div>` : ''}
            <span class="pill ${c.tipus==='particular'?'p-info':'p-gray'}" style="justify-self:start">${c.tipus==='particular'?'particular':'empresa'}</span>
            <span class="pill ${estatPill}" style="justify-self:start">${estat}</span>
          </div>`;
        }).join('')}
      </div>
    `}
  `;
};

window.renderClientsList = window.renderClients;

// ==================================================================
// FITXA CLIENT — estil document Notion
// ==================================================================
function renderFitxaClient(clientId) {
  const c = document.getElementById('tab-content');
  const cli = state.clients.find(x => x.id === clientId);
  if (!cli) {
    state._clientObert = null;
    renderClients();
    return;
  }

  const ofertes = state.ofertes.filter(o => o.client_id === cli.id);
  const consol = state.consolidats.filter(co => co.client_id === cli.id);
  const seguiments = state.seguiments.filter(s => s.client_id === cli.id).sort((a,b) => new Date(b.data) - new Date(a.data));
  const opps = state.oportunitats.filter(o => o.client_id === cli.id);
  const venciments = state.venciments.filter(v => v.client_id === cli.id || (v.empresa && cli.empresa && v.empresa.toLowerCase() === cli.empresa.toLowerCase()));
  const vincus = state.vinculacions ? state.vinculacions.filter(v => v.client_a_id === cli.id || v.client_b_id === cli.id) : [];
  const isParticular = cli.tipus === 'particular';
  const nom = getClientNom(cli);

  // Alerta proactiva: oferta enviada sense seguiment >X dies
  let alertaHtml = '';
  ofertes.filter(o => o.estat === 'Oferta enviada').forEach(o => {
    const ultim = seguiments.find(s => true);
    if (!ultim || daysFromNow(ultim.data) < -(state.config?.llindar_oferta_sense_resposta_dies || 14)) {
      alertaHtml = `<div class="alert-banner">
        <span style="font-size:15px">⚠️</span>
        <span style="flex:1">Oferta ${o.ram||''} enviada${ultim ? ' fa '+(-daysFromNow(ultim.data))+' dies' : ''} sense resposta</span>
        <button class="btn btn-sm" onclick="openModal('seguiment', {client_id:'${cli.id}'})">Registrar seguiment</button>
      </div>`;
    }
  });

  c.innerHTML = `
    <div class="doc">
      <div class="doc-topbar">
        <span style="cursor:pointer" onclick="state._clientObert=null;renderClients()">←</span>
        <span>Clients · ${nom}</span>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
          <div style="display:flex;align-items:center;gap:4px;padding:3px 8px;background:var(--surface-2);border-radius:5px">
            ${renderUserAvatar(cli.user_id, 'sm')}
            ${(window.getSharedWith('client', cli.id) || []).slice(0,3).map(s => renderUserAvatar(s.compartit_amb_id, 'sm')).join('')}
          </div>
          <button class="btn btn-sm" onclick="openShareModal('client','${cli.id}')">↗ Compartir</button>
          <button class="btn btn-sm" onclick="openModal('client',${JSON.stringify(cli).replace(/"/g,'&quot;')})">✏️ Editar</button>
        </div>
      </div>

      <div class="doc-body">
        <h1 class="doc-title">
          <span style="font-size:30px">${isParticular?'👤':'🏢'}</span>
          ${nom}
          ${consol.length>0 ? `<span class="pill p-success">Client ${consol.length}×</span>` : ''}
        </h1>

        <div class="props">
          ${isParticular ? `
            ${cli.dni ? `<div class="key">DNI</div><div class="val">${cli.dni}</div>` : ''}
            ${cli.data_naixement ? `<div class="key">Naixement</div><div class="val">${fmtDate(cli.data_naixement)}</div>` : ''}
            ${cli.professio ? `<div class="key">Professió</div><div class="val">${cli.professio}</div>` : ''}
            ${cli.empresa ? `<div class="key">Empresa on treballa</div><div class="val">${cli.empresa}</div>` : ''}
          ` : `
            ${cli.cif ? `<div class="key">CIF</div><div class="val">${cli.cif}</div>` : ''}
            ${cli.sector ? `<div class="key">Sector</div><div class="val">${cli.sector}</div>` : ''}
            ${cli.facturacio ? `<div class="key">Facturació</div><div class="val">${cli.facturacio}</div>` : ''}
            ${cli.treballadors ? `<div class="key">Dimensió</div><div class="val">${cli.treballadors} treballadors</div>` : ''}
            ${cli.contacte ? `<div class="key">Contacte</div><div class="val">${cli.contacte}${cli.carrec?' · '+cli.carrec:''}</div>` : ''}
          `}
          ${cli.email ? `<div class="key">Email</div><div class="val">${cli.email}</div>` : ''}
          ${cli.telefon ? `<div class="key">Telèfon</div><div class="val">${cli.telefon}</div>` : ''}
          ${cli.adreca ? `<div class="key">Adreça</div><div class="val">${cli.adreca}</div>` : ''}
          ${cli.origen ? `<div class="key">Origen</div><div class="val">${cli.origen}</div>` : ''}
          <div class="key">Mediador</div>
          <div class="val" style="display:flex;align-items:center;gap:6px">
            ${renderUserAvatar(cli.user_id, 'sm')}
            ${(window.getMediadorByUserId(cli.user_id)?.nom || 'Tu')}
            ${(window.getSharedWith('client', cli.id) || []).length > 0 ? `<span style="color:var(--text-3);font-size:11.5px;margin-left:6px">· compartit amb ${(window.getSharedWith('client', cli.id)||[]).map(s => s.mediador?.nom || '?').join(', ')}</span>` : ''}
          </div>
        </div>

        ${alertaHtml}

        <!-- Notes editable inline -->
        <div class="doc-section">
          <div class="doc-section-title">
            <span>📝 Notes</span>
            <span style="color:var(--text-3);font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">· clic per editar</span>
          </div>
          <div id="notes-block-${cli.id}" class="notes-block ${!cli.notes?'empty':''}" onclick="editNotaInline('${cli.id}')">${cli.notes || 'Clica per afegir notes sobre aquest client...'}</div>
        </div>

        <!-- Oportunitats -->
        <div class="doc-section">
          <div class="doc-section-title">
            <span>💡 Oportunitats</span>
            <div class="actions">
              <button onclick="detectarOpsClient('${cli.id}')">🤖 Detectar amb IA</button>
            </div>
          </div>
          ${opps.length === 0 ? `<div style="font-size:12px;color:var(--text-3);padding:8px 0">Cap oportunitat detectada encara. Escriu notes i prem el botó d'IA per generar suggeriments personalitzats.</div>` :
            opps.map(o => `
              <div class="doc-list-item">
                <div class="doc-list-dot" style="background:${o.prioritat==='Alta'?'var(--danger)':o.prioritat==='Mitjana'?'var(--warning)':'var(--success)'}"></div>
                <div class="doc-list-main">
                  <div class="doc-list-title">${o.producte}</div>
                  ${o.argument ? `<div class="doc-list-sub">${o.argument}</div>` : ''}
                </div>
                <span class="pill ${o.prioritat==='Alta'?'p-danger':o.prioritat==='Mitjana'?'p-warning':'p-success'}">${o.prioritat||''}</span>
              </div>
            `).join('')
          }
        </div>

        <!-- Vinculacions -->
        ${vincus.length > 0 ? `
        <div class="doc-section">
          <div class="doc-section-title"><span>🔗 Vinculacions</span></div>
          ${vincus.map(v => {
            const otherId = v.client_a_id === cli.id ? v.client_b_id : v.client_a_id;
            const other = state.clients.find(x => x.id === otherId);
            if (!other) return '';
            return `<div class="doc-list-item">
              <div class="doc-list-main">
                <div class="doc-list-sub">${v.tipus || 'relacionat amb'}</div>
                <div class="doc-list-title" style="cursor:pointer;text-decoration:underline;text-decoration-color:var(--border-2)" onclick="state._clientObert='${other.id}';renderClients()">${getClientNom(other)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}

        <!-- Pòlisses consolidades -->
        ${consol.length > 0 ? `
        <div class="doc-section">
          <div class="doc-section-title"><span>🏆 Pòlisses contractades</span></div>
          ${consol.map(co => `
            <div class="doc-list-item">
              <div class="doc-list-main">
                <div class="doc-list-title">${co.ram||'Pòlissa'}</div>
                <div class="doc-list-sub">${co.asseguradora||''} · pòlissa ${co.num_polissa||'—'} · ${fmtDate(co.data_tancament)}</div>
              </div>
              <div class="doc-list-meta" style="color:var(--success);font-weight:500">${fmtEur(co.prima_anual)}</div>
            </div>
          `).join('')}
        </div>` : ''}

        <!-- Ofertes obertes -->
        ${ofertes.filter(o => !['Tancada guanyada','Tancada perduda'].includes(o.estat)).length > 0 ? `
        <div class="doc-section">
          <div class="doc-section-title"><span>🎯 Ofertes obertes</span></div>
          ${ofertes.filter(o => !['Tancada guanyada','Tancada perduda'].includes(o.estat)).map(o => `
            <div class="doc-list-item" style="cursor:pointer" onclick="openModal('oferta',${JSON.stringify(o).replace(/"/g,'&quot;')})">
              <div class="doc-list-main">
                <div class="doc-list-title">${o.ram||''}</div>
                <div class="doc-list-sub">${o.asseguradora||''} · ${o.estat}</div>
              </div>
              <div class="doc-list-meta">${o.prima_brokkom ? fmtEur(o.prima_brokkom) : ''}</div>
            </div>
          `).join('')}
        </div>` : ''}

        <!-- Venciments -->
        ${venciments.length > 0 ? `
        <div class="doc-section">
          <div class="doc-section-title"><span>📆 Venciments</span></div>
          ${venciments.map(v => {
            const dies = daysFromNow(v.data_venciment);
            return `<div class="doc-list-item">
              <div class="doc-list-main">
                <div class="doc-list-title">${v.ram||'Pòlissa'} ${v.asseguradora?'· '+v.asseguradora:''}</div>
                <div class="doc-list-sub">${fmtDate(v.data_venciment)} · ${dies>=0?'en '+dies+' dies':'fa '+(-dies)+' dies'}</div>
              </div>
              <div class="doc-list-meta">${v.prima_actual ? fmtEur(v.prima_actual) : ''}</div>
            </div>`;
          }).join('')}
        </div>` : ''}

        <!-- Timeline seguiments -->
        <div class="doc-section">
          <div class="doc-section-title"><span>🕒 Activitat</span></div>
          ${seguiments.length === 0 ? `<div style="font-size:12px;color:var(--text-3);padding:8px 0">Cap interacció registrada. <a style="color:var(--brand);cursor:pointer" onclick="openModal('seguiment',{client_id:'${cli.id}'})">+ Afegir seguiment</a></div>` :
            seguiments.slice(0,10).map(s => `
              <div class="doc-list-item">
                <div class="doc-list-meta" style="min-width:54px;font-size:11.5px;color:var(--text-3)">${fmtDate(s.data)}</div>
                <div class="doc-list-main">
                  <div class="doc-list-title">${renderUserAvatar(s.user_id,'sm')} <strong style="font-weight:500">${window.getMediadorByUserId(s.user_id)?.nom || 'Tu'}</strong> · ${s.canal||''}${s.resum ? ' — '+s.resum : ''}</div>
                  ${s.proper_pas ? `<div class="doc-list-sub" style="color:var(--info)">→ ${s.proper_pas}</div>` : ''}
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>

      <div class="doc-footer">
        <button class="btn btn-primary btn-sm" onclick="openModal('seguiment',{client_id:'${cli.id}'})">+ Seguiment</button>
        <button class="btn btn-sm" onclick="openModal('oferta',{client_id:'${cli.id}'})">+ Oferta</button>
        <button class="btn btn-sm" onclick="openModal('tasca',{client_id:'${cli.id}'})">+ Tasca</button>
        <button class="btn btn-sm" onclick="openModal('venciment',{client_id:'${cli.id}',empresa:cli.empresa})">+ Venciment</button>
        <button class="btn btn-sm" onclick="deleteRecord('clients','${cli.id}')" style="color:var(--danger);margin-left:auto">🗑 Esborrar</button>
      </div>
    </div>
  `;
}

// Edit notes inline
window.editNotaInline = function(clientId) {
  if (!window.canEditClient(clientId)) { toast('No tens permís per editar aquest client','error'); return; }
  const cli = state.clients.find(c => c.id === clientId);
  const block = document.getElementById('notes-block-' + clientId);
  if (!block) return;
  const current = cli.notes || '';
  block.outerHTML = `
    <div id="notes-edit-${clientId}">
      <textarea class="notes-editor" id="notes-textarea-${clientId}" autofocus>${current}</textarea>
      <div class="notes-editor-actions">
        <button class="btn btn-primary btn-sm" onclick="saveNotaInline('${clientId}')">Guardar</button>
        <button class="btn btn-sm" onclick="cancelNotaInline('${clientId}',${JSON.stringify(current).replace(/"/g,'&quot;')})">Cancel·lar</button>
      </div>
    </div>
  `;
  document.getElementById('notes-textarea-' + clientId).focus();
};

window.saveNotaInline = async function(clientId) {
  const txt = document.getElementById('notes-textarea-' + clientId).value;
  try {
    const { error } = await supabase.from('clients').update({ notes: txt }).eq('id', clientId);
    if (error) throw error;
    const cli = state.clients.find(c => c.id === clientId);
    if (cli) cli.notes = txt;
    toast('Notes guardades');
    renderFitxaClient(clientId);
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
};

window.cancelNotaInline = function(clientId) {
  renderFitxaClient(clientId);
};

// Detectar oportunitats per a aquest client amb IA
window.detectarOpsClient = async function(clientId) {
  const cli = state.clients.find(c => c.id === clientId);
  if (!cli) return;
  toast('Detectant oportunitats amb IA...', 'success');
  const consol = state.consolidats.filter(co => co.client_id === clientId);
  const vincus = state.vinculacions ? state.vinculacions.filter(v => v.client_a_id === clientId || v.client_b_id === clientId) : [];

  const prompt = `Per al següent client de Brokkom Correduria (sector transport principalment, però també particulars), detecta oportunitats de venda creuada o complementària.

Tipus: ${cli.tipus || 'empresa'}
${cli.tipus === 'particular' ? `Nom: ${cli.nom||cli.empresa}` : `Empresa: ${cli.empresa}`}
${cli.sector ? 'Sector: '+cli.sector : ''}
${cli.professio ? 'Professió: '+cli.professio : ''}
${cli.treballadors ? 'Treballadors: '+cli.treballadors : ''}
${cli.facturacio ? 'Facturació: '+cli.facturacio : ''}
${cli.carrec ? 'Càrrec contacte: '+cli.carrec : ''}

NOTES DEL MEDIADOR:
${cli.notes || '(sense notes)'}

PÒLISSES JA CONTRACTADES:
${consol.length > 0 ? consol.map(c => '- ' + (c.ram||'?') + ' a ' + (c.asseguradora||'?')).join('\n') : '(cap)'}

Regla clau: NO proposis productes que ja tenen.

Per al sector transport considera: RC Patronal, RC Mediambiental ADR si flota, telemàtica Dossier de Risc, complement IT, pèrdua de carnet, CAP, multiriscos i avaria frigorífic, pla pensions directius, vida risc, ICC A i crèdit a exportació si CMR internacional, retribució flexible, salut col·lectiva.

Per a particulars considera: vida risc si hipoteca, ILT si autònom, accidents, salut individual, pla pensions, llar, decés, dependència, auto.

Retorna NOMÉS un array JSON, sense res més:
[{"producte":"","argument":"","prioritat":"Alta|Mitjana|Baixa"}]`;

  try {
    const result = await callAnthropicAPI(prompt, state.config?.model_smart);
    const cleaned = result.replace(/```json\n?|\n?```/g,'').trim();
    const opps = JSON.parse(cleaned);
    let added = 0;
    for (const o of opps) {
      const ja = state.oportunitats.find(x => x.client_id === clientId && x.producte === o.producte);
      if (!ja) {
        const { error } = await supabase.from('oportunitats').insert({
          client_id: clientId, empresa: cli.empresa || cli.nom,
          producte: o.producte, argument: o.argument, prioritat: o.prioritat,
          estat: 'Detectada', user_id: state.user.id
        });
        if (!error) added++;
      }
    }
    await refreshData('oportunitats');
    toast(`${added} oportunitats noves`);
    renderFitxaClient(clientId);
  } catch (err) {
    toast('Error IA: ' + err.message, 'error');
  }
};

// ==================================================================
// PIPELINE Kanban
// ==================================================================
window.renderPipeline = function() {
  const c = document.getElementById('tab-content');
  const ofertesActives = state.ofertes.filter(o => !['Tancada guanyada','Tancada perduda'].includes(o.estat));
  const totalValor = ofertesActives.reduce((s,o) => s + (parseFloat(o.prima_brokkom)||0), 0);
  const probs = {'Lead':5,'Qualificat':20,'Cotitzant':40,'Oferta enviada':50,'En negociació':75};
  const valorEsperat = ofertesActives.reduce((s,o) => s + (parseFloat(o.prima_brokkom)||0) * (probs[o.estat]||0)/100, 0);

  c.innerHTML = `
    <div class="topbar">
      <div>
        <div class="page-title">Pipeline</div>
        <div class="page-sub">Lead → Tancament</div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-primary" onclick="openModal('oferta')">+ Nova oferta</button>
      </div>
    </div>

    <div class="metrics">
      <div class="metric"><div class="metric-label">Ofertes actives</div><div class="metric-value">${ofertesActives.length}</div></div>
      <div class="metric"><div class="metric-label">Valor total</div><div class="metric-value">${fmtEur(totalValor)}</div></div>
      <div class="metric"><div class="metric-label">Valor esperat</div><div class="metric-value" style="color:var(--success)">${fmtEur(valorEsperat)}</div></div>
      <div class="metric"><div class="metric-label">Mitjana</div><div class="metric-value">${ofertesActives.length>0?fmtEur(totalValor/ofertesActives.length):'0€'}</div></div>
    </div>

    <div class="section-title">Kanban</div>
    <div class="pipeline-board">
      ${(window.ESTATS_PIPELINE||[]).map(estat => {
        const items = state.ofertes.filter(o => o.estat === estat);
        return `<div class="pipeline-col">
          <div class="pipeline-col-title">${estat}<span class="pipeline-col-count">${items.length}</span></div>
          ${items.map(o => {
            const cli = getClient(o.client_id);
            const estalvi = (parseFloat(o.prima_actual)||0) - (parseFloat(o.prima_brokkom)||0);
            return `<div class="pipeline-card" onclick="openModal('oferta',${JSON.stringify(o).replace(/"/g,'&quot;')})">
              <div class="pipeline-card-title">${cli ? getClientNom(cli) : o.empresa || '?'}</div>
              <div class="pipeline-card-sub">${o.ram||''}</div>
              ${o.prima_brokkom ? `<div class="pipeline-card-amount">${fmtEur(o.prima_brokkom)}${estalvi>0?' · estalvi '+fmtEur(estalvi):''}</div>` : ''}
            </div>`;
          }).join('')}
        </div>`;
      }).join('')}
    </div>
  `;
};
window.renderPipelineBoard = window.renderPipeline;

// ==================================================================
// CONSOLIDATS
// ==================================================================
window.renderConsolidats = function() {
  const c = document.getElementById('tab-content');
  const filtered = state.consolidats;
  const totalPrima = filtered.reduce((s,co) => s + (parseFloat(co.prima_anual)||0), 0);
  const mitjana = filtered.length>0 ? totalPrima/filtered.length : 0;

  const perAsseg = {};
  filtered.forEach(co => {
    const k = co.asseguradora || '?';
    if (!perAsseg[k]) perAsseg[k] = {n:0, prima:0};
    perAsseg[k].n++;
    perAsseg[k].prima += parseFloat(co.prima_anual)||0;
  });
  const sortedA = Object.entries(perAsseg).sort((a,b) => b[1].prima - a[1].prima);
  const maxA = sortedA[0]?.[1].prima || 1;

  const perRam = {};
  filtered.forEach(co => {
    const k = co.ram || '?';
    if (!perRam[k]) perRam[k] = {n:0, prima:0};
    perRam[k].n++;
    perRam[k].prima += parseFloat(co.prima_anual)||0;
  });
  const sortedR = Object.entries(perRam).sort((a,b) => b[1].prima - a[1].prima);
  const maxR = sortedR[0]?.[1].prima || 1;

  c.innerHTML = `
    <div class="topbar">
      <div>
        <div class="page-title">Consolidats</div>
        <div class="page-sub">${filtered.length} tancaments · ${fmtEur(totalPrima)}</div>
      </div>
      <div class="topbar-actions">
        <button class="btn" onclick="exportConsolidats()">📥 CSV</button>
      </div>
    </div>

    <div class="metrics">
      <div class="metric"><div class="metric-label">Tancaments</div><div class="metric-value">${filtered.length}</div></div>
      <div class="metric"><div class="metric-label">Prima total</div><div class="metric-value">${fmtEur(totalPrima)}</div></div>
      <div class="metric"><div class="metric-label">Mitjana</div><div class="metric-value">${fmtEur(mitjana)}</div></div>
      <div class="metric"><div class="metric-label">Asseguradores</div><div class="metric-value">${Object.keys(perAsseg).length}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div>
        <div class="section-title">Per asseguradora</div>
        <div class="card">
          ${sortedA.length === 0 ? '<div class="empty-state">Sense dades</div>' : sortedA.map(([a,d]) => `
            <div class="chart-bar">
              <div class="chart-label">${a}</div>
              <div class="chart-track"><div class="chart-fill" style="width:${(d.prima/maxA)*100}%"></div></div>
              <div class="chart-value">${d.n} · ${fmtEur(d.prima)}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div>
        <div class="section-title">Per ram</div>
        <div class="card">
          ${sortedR.length === 0 ? '<div class="empty-state">Sense dades</div>' : sortedR.map(([r,d]) => `
            <div class="chart-bar">
              <div class="chart-label">${r}</div>
              <div class="chart-track"><div class="chart-fill" style="width:${(d.prima/maxR)*100}%;background:var(--brand)"></div></div>
              <div class="chart-value">${d.n} · ${fmtEur(d.prima)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="section-title">Tancaments registrats</div>
    <div class="card" style="padding:0;overflow-x:auto">
      ${filtered.length === 0 ? '<div class="empty-state">Cap tancament encara</div>' :
        `<table class="table">
          <thead><tr><th>Data</th><th>Empresa</th><th>Ram</th><th>Asseguradora</th><th>Núm. pòlissa</th>${window.isAdmin()?'<th>Mediador</th>':''}<th class="num">Prima</th></tr></thead>
          <tbody>${filtered.sort((a,b) => new Date(b.data_tancament) - new Date(a.data_tancament)).map(co => `
            <tr>
              <td>${fmtDate(co.data_tancament)}</td>
              <td><strong>${co.empresa}</strong></td>
              <td>${co.ram||'—'}</td>
              <td>${co.asseguradora||'—'}</td>
              <td style="font-family:monospace;font-size:12px">${co.num_polissa||'—'}</td>
              ${window.isAdmin() ? `<td>${renderMediadorCell(co.user_id)}</td>` : ''}
              <td class="num"><strong>${fmtEur(co.prima_anual)}</strong></td>
            </tr>
          `).join('')}</tbody>
        </table>`
      }
    </div>
  `;
};

// ==================================================================
// SEGUIMENTS, OPORTUNITATS, VENCIMENTS, TASQUES, ASSEGURADORES, USUARIS
// ==================================================================
window.renderSeguiments = function() {
  const c = document.getElementById('tab-content');
  const list = [...state.seguiments].sort((a,b) => new Date(b.data) - new Date(a.data));
  c.innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Seguiments</div><div class="page-sub">${list.length} interaccions</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('seguiment')">+ Nou</button></div>
    </div>
    ${list.length === 0 ? `<div class="card"><div class="empty-state"><div class="empty-icon">📞</div>Cap seguiment encara</div></div>` :
      list.map(s => {
        const cli = state.clients.find(cc => cc.id === s.client_id);
        return `<div class="card compact">
          <div class="card-row">
            <div>
              <div class="card-title">${cli ? getClientNom(cli) : '(client esborrat)'}</div>
              <div class="card-sub">${fmtDate(s.data)} · ${s.canal||''} ${window.isAdmin() && s.user_id ? '· '+(window.getMediadorByUserId(s.user_id)?.nom||'?') : ''}</div>
            </div>
            <span class="pill p-gray">${s.canal||''}</span>
          </div>
          ${s.resum ? `<div style="margin-top:8px;font-size:13px;line-height:1.6">${s.resum}</div>` : ''}
          ${s.proper_pas ? `<div style="margin-top:8px;font-size:12px;color:var(--info)">→ ${s.proper_pas}</div>` : ''}
          <div style="margin-top:8px"><button class="btn btn-sm" onclick="deleteRecord('seguiments','${s.id}')" style="color:var(--danger)">🗑</button></div>
        </div>`;
      }).join('')
    }
  `;
};

window.renderOpps = function() {
  const c = document.getElementById('tab-content');
  const list = [...state.oportunitats].sort((a,b) => {
    const ord = {'Alta':3,'Mitjana':2,'Baixa':1};
    return (ord[b.prioritat]||0) - (ord[a.prioritat]||0);
  });
  c.innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Oportunitats</div><div class="page-sub">${list.length} detectades</div></div>
      <div class="topbar-actions">${state.clients.length === 0 ? '<button class="btn" onclick="openModal(\'client\')">+ Crea client primer</button>' : '<button class="btn" onclick="regenerarOportunitats()">🤖 Regenerar amb IA</button>'}</div>
    </div>
    ${list.length === 0 ? `<div class="card"><div class="empty-state"><div class="empty-icon">💡</div>Cap oportunitat${state.clients.length === 0?'<br><br>Crea primer alguns clients per poder detectar oportunitats':''}</div></div>` :
      list.map(o => {
        const cli = state.clients.find(cc => cc.id === o.client_id);
        return `<div class="opp-card ${(o.prioritat||'baixa').toLowerCase()}">
          <div class="card-row">
            <div>
              <div class="card-title">${cli ? getClientNom(cli) : o.empresa||'?'}</div>
              <div class="card-sub">${o.producte}</div>
            </div>
            <div style="display:flex;gap:6px;flex-direction:column;align-items:flex-end">
              <span class="pill ${o.prioritat==='Alta'?'p-danger':o.prioritat==='Mitjana'?'p-warning':'p-success'}">${o.prioritat||''}</span>
              <span class="pill p-gray">${o.estat||''}</span>
            </div>
          </div>
          ${o.argument ? `<div style="margin-top:6px;font-size:12px;color:var(--text-2)">${o.argument}</div>` : ''}
          <div style="margin-top:8px;display:flex;gap:6px">
            <button class="btn btn-sm" onclick="canviarEstatOpp('${o.id}')">Canviar estat</button>
            <button class="btn btn-sm" onclick="convertirOppEnOferta('${o.id}')">→ Crear oferta</button>
          </div>
        </div>`;
      }).join('')
    }
  `;
};

window.renderVenciments = function() {
  const c = document.getElementById('tab-content');
  const sorted = [...state.venciments].sort((a,b) => new Date(a.data_venciment) - new Date(b.data_venciment));
  c.innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Venciments</div><div class="page-sub">Sistema 90/30/7</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('venciment')">+ Nou</button></div>
    </div>
    ${sorted.length === 0 ? '<div class="card"><div class="empty-state"><div class="empty-icon">📆</div>Cap venciment</div></div>' :
      sorted.map(v => {
        const dies = daysFromNow(v.data_venciment);
        const urg = dies<=7?'p-danger':dies<=30?'p-warning':dies<=90?'p-info':'p-gray';
        return `<div class="card">
          <div class="card-row">
            <div>
              <div class="card-title">${v.empresa}</div>
              <div class="card-sub">${v.ram||''}${v.asseguradora?' · '+v.asseguradora:''}</div>
            </div>
            <div style="text-align:right">
              <span class="pill ${urg}">${fmtDate(v.data_venciment)}</span>
              <div style="font-size:11px;color:var(--text-3);margin-top:3px">${dies>0?'en '+dies+' dies':dies===0?'avui':'fa '+(-dies)+' dies'}</div>
            </div>
          </div>
          ${v.prima_actual ? `<div style="margin-top:8px"><span class="mini-stat">Prima <strong>${fmtEur(v.prima_actual)}</strong></span></div>` : ''}
          <div style="margin-top:8px"><button class="btn btn-sm" onclick="deleteRecord('venciments','${v.id}')" style="color:var(--danger)">🗑</button></div>
        </div>`;
      }).join('')
    }
  `;
};

window.renderTasques = function() {
  const c = document.getElementById('tab-content');
  const filtre = state._filtreTasques || 'pendent';
  let list = [...state.tasques];
  if (filtre !== '') list = list.filter(t => t.estat === filtre);
  list.sort((a,b) => { const ord={'Alta':3,'Mitjana':2,'Baixa':1}; return (ord[b.prioritat]||0)-(ord[a.prioritat]||0); });
  c.innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Tasques</div><div class="page-sub">${list.length} ${filtre||'totes'}</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('tasca')">+ Nova</button></div>
    </div>
    <div class="toolbar">
      <button class="btn btn-pill ${filtre==='pendent'?'active':''}" onclick="state._filtreTasques='pendent';renderTasques()">Pendents</button>
      <button class="btn btn-pill ${filtre==='done'?'active':''}" onclick="state._filtreTasques='done';renderTasques()">Fetes</button>
      <button class="btn btn-pill ${filtre===''?'active':''}" onclick="state._filtreTasques='';renderTasques()">Totes</button>
    </div>
    ${list.length === 0 ? '<div class="card"><div class="empty-state">Cap tasca</div></div>' : `
      <div class="card"><ul class="checklist">${list.map(t => `
        <li>
          <div class="check ${t.estat==='done'?'done':''}" onclick="toggleTasca('${t.id}')"></div>
          <div style="flex:1">
            <div class="text ${t.estat==='done'?'done':''}">${t.titol}</div>
            ${t.descripcio ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${t.descripcio}</div>` : ''}
            <div class="text-meta">
              ${t.prioritat ? `<span class="pill ${t.prioritat==='Alta'?'p-danger':t.prioritat==='Mitjana'?'p-warning':'p-success'}">${t.prioritat}</span>` : ''}
              ${t.categoria ? `<span class="pill p-gray">${t.categoria}</span>` : ''}
              ${t.data_limit ? `<span class="pill p-info">${fmtDate(t.data_limit)}</span>` : ''}
              ${window.isAdmin() && t.user_id ? renderUserAvatar(t.user_id,'sm') : ''}
            </div>
          </div>
          <button class="btn btn-sm" onclick="deleteRecord('tasques','${t.id}')" style="color:var(--danger)">🗑</button>
        </li>
      `).join('')}</ul></div>
    `}
  `;
};
window.renderTasquesList = window.renderTasques;

window.renderAsseguradores = function() {
  const c = document.getElementById('tab-content');
  c.innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Asseguradores</div><div class="page-sub">Catàleg Brokkom</div></div>
      ${window.isAdmin() ? '<div class="topbar-actions"><button class="btn btn-primary" onclick="openModal(\'asseguradora\')">+ Nova</button></div>' : ''}
    </div>
    ${state.asseguradores.length === 0 ? '<div class="card"><div class="empty-state">Cap asseguradora</div></div>' :
      state.asseguradores.map(a => `
        <div class="card">
          <div class="card-row">
            <div>
              <div class="card-title">${a.nom}</div>
              ${a.contacte_intern ? `<div class="card-sub">${a.contacte_intern}${a.email?' · '+a.email:''}${a.telefon?' · '+a.telefon:''}</div>` : ''}
            </div>
            ${window.isAdmin() ? `<button class="btn btn-sm" onclick="deleteRecord('asseguradores','${a.id}')" style="color:var(--danger)">🗑</button>` : ''}
          </div>
          ${(a.rams||[]).length>0 ? `<div style="margin-top:8px">${(a.rams||[]).map(r => `<span class="pill p-info" style="margin-right:4px">${r}</span>`).join('')}</div>` : ''}
          ${a.notes ? `<div style="margin-top:8px;font-size:12px;color:var(--text-2)">${a.notes}</div>` : ''}
        </div>
      `).join('')
    }
  `;
};

window.renderUsuaris = function() {
  const c = document.getElementById('tab-content');
  c.innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Usuaris</div><div class="page-sub">${state.mediadors.length} mediadors</div></div>
    </div>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="table">
        <thead><tr><th></th><th>Nom</th><th>Email</th><th>Rol</th><th>Actiu</th></tr></thead>
        <tbody>${state.mediadors.map(u => `
          <tr>
            <td>${renderUserAvatar(u.user_id,'md')}</td>
            <td><strong>${u.nom||'—'}</strong></td>
            <td>${u.email}</td>
            <td>
              ${window.isAdmin() && u.user_id !== state.user.id ? `
                <select onchange="canviarRol('${u.user_id}',this.value)" style="font-size:11px;padding:3px 6px">
                  <option value="agent" ${u.rol==='agent'?'selected':''}>agent</option>
                  <option value="admin" ${u.rol==='admin'?'selected':''}>admin</option>
                </select>
              ` : `<span class="role-badge ${u.rol==='admin'?'role-admin':'role-agent'}">${u.rol||'agent'}</span>`}
            </td>
            <td>${u.actiu ? '✓' : '✗'}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
};

window.canviarRol = async function(userId, nouRol) {
  try {
    const { error } = await supabase.from('mediadors').update({ rol: nouRol }).eq('user_id', userId);
    if (error) throw error;
    toast('Rol actualitzat');
    await refreshData('mediadors');
    renderUsuaris();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
};

// ==================================================================
// LinkedIn Posts
// ==================================================================
window.renderComunicacio = function() {
  const c = document.getElementById('tab-content');
  c.innerHTML = `
    <div class="topbar"><div><div class="page-title">Posts LinkedIn</div><div class="page-sub">Calendari editorial</div></div></div>
    <div class="empty-state"><div class="empty-icon">📰</div>Mòdul disponible al següent sprint</div>
  `;
};

// ==================================================================
// IA assistent
// ==================================================================
window.renderIA = function() {
  const c = document.getElementById('tab-content');
  c.innerHTML = `
    <div class="topbar"><div><div class="page-title">IA assistent</div><div class="page-sub">Processa text i extreu dades</div></div></div>
    <div class="card">
      <div style="font-size:12px;color:var(--text-2);margin-bottom:10px">Enganxa qualsevol email, nota, o text. L'IA extreu clients, ofertes, oportunitats automàticament.</div>
      <textarea id="ia-input" placeholder="Enganxa aquí emails, notes, propostes..."></textarea>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
        <button class="btn btn-primary" onclick="processarIA()">🤖 Processar amb IA</button>
        <span style="font-size:11px;color:var(--text-3)">~0,002€ per processament</span>
      </div>
    </div>
    <div id="ia-result" class="hidden">
      <div class="section-title">Resultat</div>
      <div class="card" id="ia-result-content"></div>
    </div>
  `;
};

window.processarIA = async function() {
  const txt = document.getElementById('ia-input').value.trim();
  if (!txt) { toast('Enganxa primer text', 'error'); return; }
  const resDiv = document.getElementById('ia-result-content');
  document.getElementById('ia-result').classList.remove('hidden');
  resDiv.innerHTML = '<div class="empty-state"><span class="loader loader-lg"></span><br><br>Processant amb IA...</div>';

  const prompt = `Analitza aquest text i extreu informació estructurada en JSON:
{
  "clients": [{"empresa":"","cif":"","tipus":"empresa","contacte":"","email":"","telefon":"","sector":"","notes":""}],
  "ofertes": [{"empresa":"","ram":"","prima_actual":0,"prima_brokkom":0,"asseguradora":"","estat":"Lead","notes":""}],
  "venciments": [{"empresa":"","ram":"","data_venciment":"YYYY-MM-DD","prima_actual":0,"asseguradora":""}],
  "seguiments": [{"empresa":"","data":"YYYY-MM-DD","canal":"Email|Telèfon|Reunió","resum":"","proper_pas":""}],
  "resum": "resum executiu en 2-3 frases",
  "alertes": []
}

TEXT:
${txt}

Retorna NOMÉS el JSON.`;

  try {
    const result = await callAnthropicAPI(prompt, state.config?.model_fast);
    const cleaned = result.replace(/```json\n?|\n?```/g,'').trim();
    const parsed = JSON.parse(cleaned);
    let html = '';
    if (parsed.resum) html += `<div style="padding:12px;background:var(--brand-soft);border-radius:var(--r);margin-bottom:12px;font-size:13px">${parsed.resum}</div>`;
    if (parsed.alertes?.length) html += `<div class="section-title">⚠️ Alertes</div><ul style="font-size:13px;padding-left:20px;margin-bottom:14px">${parsed.alertes.map(a => `<li>${a}</li>`).join('')}</ul>`;
    ['clients','ofertes','venciments','seguiments'].forEach(key => {
      if (parsed[key]?.length) {
        html += `<div class="section-title">${key}</div>`;
        parsed[key].forEach((item,i) => {
          html += `<div style="padding:8px;background:var(--surface-2);border-radius:var(--r);margin-bottom:6px;font-size:13px;display:flex;justify-content:space-between"><div>${item.empresa||item.nom||''}</div><button class="btn btn-sm" onclick="window._iaImport('${key}',${i})">+ Importar</button></div>`;
        });
      }
    });
    resDiv.innerHTML = html || '<div class="empty-state">No s\'ha detectat info estructurada</div>';
    window._iaParsed = parsed;
    window._iaImport = async (key, i) => {
      const item = parsed[key][i];
      try {
        if (key === 'clients') {
          await supabase.from('clients').insert({ ...item, user_id: state.user.id });
        } else if (key === 'venciments') {
          await supabase.from('venciments').insert({ ...item, user_id: state.user.id });
        }
        await refreshData();
        toast('Importat al CRM');
      } catch (e) { toast('Error: '+e.message,'error'); }
    };
  } catch (err) {
    resDiv.innerHTML = `<div style="color:var(--danger)">Error: ${err.message}</div>`;
  }
};

window.callAnthropicAPI = async function(prompt, model) {
  const response = await window.apiCallWithRetry('/api/ai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || state.config?.model_fast || 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role:'user', content: prompt }]
    })
  });
  const data = await response.json();
  return data.content?.[0]?.text || data.text || JSON.stringify(data);
};

window.regenerarOportunitats = async function() {
  if (state.clients.length === 0) { toast('Crea clients primer','error'); return; }
  toast('Detectant oportunitats per a tots els clients...');
  let total = 0;
  for (const cli of state.clients.slice(0, 5)) {
    try {
      await detectarOpsClient(cli.id);
      total++;
    } catch (e) {}
  }
  toast(`${total} clients processats`);
};

window.canviarEstatOpp = async function(id) {
  const o = state.oportunitats.find(x => x.id === id);
  const estats = ['Detectada','En treball','Presentada','Descartada'];
  const idx = estats.indexOf(o.estat);
  const nou = estats[(idx+1) % estats.length];
  try {
    await supabase.from('oportunitats').update({ estat: nou }).eq('id', id);
    o.estat = nou;
    renderOpps();
  } catch (err) { toast(err.message, 'error'); }
};

window.convertirOppEnOferta = function(id) {
  const o = state.oportunitats.find(x => x.id === id);
  openModal('oferta', { client_id: o.client_id, ram: o.producte, notes: 'Origen: opp · '+(o.argument||'') });
};

// ==================================================================
// CONFIG
// ==================================================================
window.renderConfig = function() {
  const c = document.getElementById('tab-content');
  c.innerHTML = `
    <div class="topbar"><div><div class="page-title">Configuració</div><div class="page-sub">Preferències</div></div></div>

    <div class="section-title">Models d'IA</div>
    <div class="card">
      <div class="form-row">
        <label>Model ràpid (extracció dades)</label>
        <select id="cfg-fast">
          <option value="claude-haiku-4-5-20251001" ${state.config?.model_fast==='claude-haiku-4-5-20251001'?'selected':''}>Claude Haiku 4.5 (ràpid)</option>
          <option value="claude-sonnet-4-6" ${state.config?.model_fast==='claude-sonnet-4-6'?'selected':''}>Claude Sonnet 4.6</option>
        </select>
      </div>
      <div class="form-row">
        <label>Model complex (anàlisi, posts)</label>
        <select id="cfg-smart">
          <option value="claude-haiku-4-5-20251001" ${state.config?.model_smart==='claude-haiku-4-5-20251001'?'selected':''}>Claude Haiku 4.5</option>
          <option value="claude-sonnet-4-6" ${state.config?.model_smart==='claude-sonnet-4-6'?'selected':''}>Claude Sonnet 4.6 (recomanat)</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="saveCfg()">Guardar</button>
    </div>

    <div class="section-title" style="margin-top:24px">Compte</div>
    <div class="card">
      <div style="font-size:13px;color:var(--text-2);margin-bottom:8px">Connectat com a: <strong>${state.mediador?.email}</strong></div>
      <div style="font-size:13px;color:var(--text-2);margin-bottom:14px">Rol: <span class="role-badge ${window.isAdmin()?'role-admin':'role-agent'}">${state.mediador?.rol||'agent'}</span></div>
      <button class="btn" onclick="doLogout()">Tancar sessió</button>
    </div>

    <div class="section-title" style="margin-top:24px">Sobre Brokkom CRM</div>
    <div class="card" style="font-size:12px;color:var(--text-2);line-height:1.7">
      Versió 2.0 · Notion edition<br>
      ${state.clients.length} clients · ${state.ofertes.length} ofertes · ${state.consolidats.length} consolidats · ${state.mediadors.length} mediadors
    </div>
  `;
};

window.saveCfg = async function() {
  try {
    const cfg = {
      user_id: state.user.id,
      model_fast: document.getElementById('cfg-fast').value,
      model_smart: document.getElementById('cfg-smart').value
    };
    await supabase.from('user_config').upsert(cfg, { onConflict: 'user_id' });
    state.config = { ...state.config, ...cfg };
    toast('Guardat');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

// Stubs per a mòduls que vindran al següent sprint
window.renderInbox = () => { document.getElementById('tab-content').innerHTML = `<div class="topbar"><div><div class="page-title">📥 Bústia</div></div></div><div class="empty-state">Mòdul disponible al següent sprint</div>`; };
window.renderNotes = () => { document.getElementById('tab-content').innerHTML = `<div class="topbar"><div><div class="page-title">💭 Notes</div></div></div><div class="empty-state">Mòdul disponible al següent sprint</div>`; };
window.renderAgenda = () => { document.getElementById('tab-content').innerHTML = `<div class="topbar"><div><div class="page-title">📅 Agenda</div></div></div><div class="empty-state">Mòdul disponible al següent sprint</div>`; };
window.renderEsborranys = () => { document.getElementById('tab-content').innerHTML = `<div class="topbar"><div><div class="page-title">📝 Esborranys</div></div></div><div class="empty-state">Mòdul disponible al següent sprint</div>`; };
window.renderNotesList = window.renderNotes;
window.renderAgendaList = window.renderAgenda;
window.renderEsborranysList = window.renderEsborranys;

// ==================================================================
// HELPERS d'esborrar
// ==================================================================
window.deleteRecord = async function(table, id) {
  if (!confirm('Esborrar aquest registre?')) return;
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    toast('Esborrat');
    if (table === 'clients') state._clientObert = null;
    await refreshData();
    if (typeof renderCurrentTab === 'function') renderCurrentTab();
  } catch (err) { toast('Error: '+err.message, 'error'); }
};

window.toggleTasca = async function(id) {
  const t = state.tasques.find(x => x.id === id);
  if (!t) return;
  const nouEstat = t.estat === 'done' ? 'pendent' : 'done';
  try {
    await supabase.from('tasques').update({ estat: nouEstat }).eq('id', id);
    t.estat = nouEstat;
    renderTasques();
    updateNavBadges();
  } catch (err) { toast('Error: '+err.message, 'error'); }
};

window.exportConsolidats = function() {
  const headers = ['Data','Empresa','Ram','Asseguradora','Núm. pòlissa','Prima'];
  const rows = state.consolidats.map(c => [c.data_tancament, c.empresa, c.ram||'', c.asseguradora||'', c.num_polissa||'', c.prima_anual||0]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${(v+'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `consolidats-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV exportat');
};

window.filterByHashtag = () => {};
window.genCalendar = () => {};
window.syncToGoogleCalendar = () => {};
window.toggleFavoritaNota = () => {};
window.copyEsborrany = () => {};
window.selectTopic = () => {};
window.copyPost = () => {};
window.savePost = () => {};
window.generatePost = () => {};
window.iaAccio = () => {};
window.openIAImport = () => showTab('ia');

console.log('✅ modules.js carregat correctament');
