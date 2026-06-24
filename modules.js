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
  const now = new Date();
  const todayMid = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const isToday = (s) => { if (!s) return false; const d = new Date(s); return d.toDateString() === now.toDateString(); };

  const ofertesObertes = state.ofertes.filter(o => !['Tancada guanyada','Tancada perduda'].includes(o.estat));
  const tancMes = state.consolidats.filter(co => { const d = new Date(co.data_tancament); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const primaPipeline = ofertesObertes.reduce((s,o) => s + (parseFloat(o.prima_brokkom)||0), 0);
  const primaTancMes = tancMes.reduce((s,co) => s + (parseFloat(co.prima_anual)||0), 0);
  const totalTanc = state.consolidats.length;
  const totalOfertesFin = state.ofertes.filter(o => ['Tancada guanyada','Tancada perduda'].includes(o.estat)).length + state.consolidats.length;
  const conversio = totalOfertesFin > 0 ? Math.round((totalTanc/totalOfertesFin)*100) : 0;

  // ---------- Accions del dia ----------
  const trucables = (state.prospectes||[]).filter(p => !p.no_trucar && !['No interessa','Convertit'].includes(p.estat));
  const trucadesQueue = trucables.filter(p => (p.num_intents||0) === 0 || (p.propera_accio_data && new Date(p.propera_accio_data) <= todayMid()));
  const callbacksAvui = (state.prospectes||[]).filter(p => isToday(p.propera_accio_data));
  const segFreds = [];
  state.ofertes.filter(o => o.estat === 'Oferta enviada').forEach(o => {
    const ultim = state.seguiments.filter(s => s.client_id === o.client_id).sort((a,b) => new Date(b.data) - new Date(a.data))[0];
    if (!ultim || daysFromNow(ultim.data) < -15) segFreds.push({ o, sub: ultim ? `Sense contacte ${-daysFromNow(ultim.data)} dies` : 'Sense seguiment' });
  });
  const vencImminents = state.venciments
    .filter(v => { const d = daysFromNow(v.data_venciment); return d >= 0 && d <= 30; })
    .sort((a,b) => new Date(a.data_venciment) - new Date(b.data_venciment));
  const oppsNoves = state.oportunitats.filter(o => o.estat === 'Detectada');
  const totalAccions = trucadesQueue.length + callbacksAvui.length + segFreds.length + vencImminents.length + oppsNoves.length;

  const accioCard = (icon, titol, color, items, veureTab) => {
    const n = items.length;
    return `
      <div class="card" style="border-top:3px solid ${color}">
        <div class="card-row" style="margin-bottom:${n?'8px':'0'}">
          <div class="card-title" style="font-size:13px">${icon} ${titol}</div>
          <span class="pill ${n?'p-warning':'p-success'}">${n}</span>
        </div>
        ${n === 0 ? '<div style="font-size:12px;color:var(--text-3)">Tot al dia ✓</div>'
          : items.slice(0,3).map(it => `
            <div onclick="${it.onclick}" style="cursor:pointer;padding:6px 0;border-bottom:0.5px solid var(--border);font-size:12.5px">
              <div style="font-weight:500">${escapeHtml(it.text)}</div>
              ${it.sub ? `<div style="font-size:11px;color:var(--text-3)">${escapeHtml(it.sub)}</div>` : ''}
            </div>`).join('') + (n > 3 ? `<div style="text-align:center;margin-top:8px"><a class="auth-link" onclick="showTab('${veureTab}')">+${n-3} més</a></div>` : '')}
      </div>`;
  };
  const itTruc = trucadesQueue.map(p => ({ text: p.empresa || '(sense nom)', sub: [(p.telefon||p.mobil||''), p.municipi].filter(Boolean).join(' · '), onclick: `obrirTrucada('${p.id}')` }));
  const itCall = callbacksAvui.map(p => ({ text: p.empresa || '(sense nom)', sub: 'Tornar a trucar avui', onclick: `obrirTrucada('${p.id}')` }));
  const itSeg = segFreds.map(x => ({ text: x.o.empresa || getClientNom(getClient(x.o.client_id)), sub: x.sub, onclick: `openModal('seguiment',{client_id:'${x.o.client_id}'})` }));
  const itVenc = vencImminents.map(v => ({ text: v.empresa, sub: `${v.ram||''} · venç ${fmtDate(v.data_venciment)} (${daysFromNow(v.data_venciment)}d)`, onclick: `showTab('venciments')` }));
  const itOpp = oppsNoves.map(o => ({ text: o.empresa || getClientNom(getClient(o.client_id)), sub: o.producte || '', onclick: `showTab('oportunitats')` }));

  // ---------- Comença el dia (tasques) ----------
  const avui = state.tasques.filter(window.tascaActivaAvui);
  const endarr = avui.filter(window.tascaEndarrerida).length;
  const ordT = {'Alta':3,'Mitjana':2,'Baixa':1};
  avui.sort((a,b) => { const ea = window.tascaEndarrerida(a)?1:0, eb = window.tascaEndarrerida(b)?1:0; if (ea!==eb) return eb-ea; return (ordT[b.prioritat]||0)-(ordT[a.prioritat]||0); });

  const today = now.toLocaleDateString('ca-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  c.innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Tauler</div><div class="page-sub">${today}</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('client')">+ Nou client</button></div>
    </div>

    <div class="card" style="border-left:3px solid var(--brand);margin-bottom:20px">
      <div class="card-row" style="margin-bottom:10px">
        <div>
          <div class="card-title">Comença el dia</div>
          <div class="card-sub">${avui.length} ${avui.length===1?'tasca':'tasques'} per avui${endarr?` · ${endarr} endarrerides`:''}</div>
        </div>
        <button class="btn btn-sm" onclick="showTab('tasques')">Veure totes</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:${avui.length?'10px':'0'}">
        <input type="text" id="dash-quick-tasca" placeholder="Afegeix una tasca per avui i prem Enter…" onkeydown="if(event.key==='Enter')quickAddTascaAvui('dash-quick-tasca')" style="flex:1">
        <button class="btn btn-primary btn-sm" onclick="quickAddTascaAvui('dash-quick-tasca')">Afegir</button>
      </div>
      ${avui.length===0 ? '' : `<ul class="checklist">${avui.slice(0,8).map(_tascaItemHTML).join('')}</ul>${avui.length>8?`<div style="text-align:center;margin-top:8px"><a class="auth-link" onclick="showTab('tasques')">+${avui.length-8} més</a></div>`:''}`}
    </div>

    <div class="section-title">Accions del dia${totalAccions?` · ${totalAccions}`:''}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
      ${accioCard('📞','Trucades pendents','#0F766E', itTruc, 'prospeccio')}
      ${accioCard('↩️',"Callbacks d'avui",'#185FA5', itCall, 'prospeccio')}
      ${accioCard('🔵','Seguiments freds','#E24B4A', itSeg, 'seguiments')}
      ${accioCard('📆','Venciments ≤30 dies','#EF9F27', itVenc, 'venciments')}
      ${accioCard('💡','Oportunitats per treballar','#3C3489', itOpp, 'oportunitats')}
    </div>

    <div class="metrics" style="margin-top:20px">
      <div class="metric"><div class="metric-label">Pipeline obert</div><div class="metric-value">${ofertesObertes.length}</div><div class="metric-sub">${fmtEur(primaPipeline)} valor</div></div>
      <div class="metric"><div class="metric-label">Tancaments mes</div><div class="metric-value">${tancMes.length}</div><div class="metric-sub">${fmtEur(primaTancMes)} primat</div></div>
      <div class="metric"><div class="metric-label">Taxa conversió</div><div class="metric-value">${conversio}%</div><div class="metric-sub">històrica</div></div>
      <div class="metric"><div class="metric-label">Clients</div><div class="metric-value">${state.clients.length}</div><div class="metric-sub">a la cartera</div></div>
      <div class="metric"><div class="metric-label">Oportunitats</div><div class="metric-value">${state.oportunitats.filter(o => o.estat !== 'Descartada').length}</div><div class="metric-sub">detectades</div></div>
      <div class="metric"><div class="metric-label">Tasques avui</div><div class="metric-value" style="${avui.length>0?'color:var(--warning)':''}">${avui.length}</div><div class="metric-sub">a fer</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
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
      </div>
      <div>
        <div class="section-title">Tancaments del mes</div>
        <div class="card">
          ${tancMes.length === 0 ? '<div class="empty-state">Cap tancament aquest mes</div>' :
            tancMes.slice(0,5).map(co => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid var(--border);font-size:13px">
                <div><strong>${escapeHtml(co.empresa)}</strong> · ${escapeHtml(co.ram||'')}<br><span style="font-size:11px;color:var(--text-3)">${escapeHtml(co.asseguradora||'')} · ${fmtDate(co.data_tancament)}</span></div>
                <div style="text-align:right"><strong style="color:var(--success)">${fmtEur(co.prima_anual)}</strong></div>
              </div>
            `).join('')
          }
        </div>
      </div>
    </div>
  `;
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
      <div class="topbar-actions">
        <button class="btn btn-primary" onclick="openModal('oportunitat')">+ Nova oportunitat</button>
        ${state.clients.length > 0 ? '<button class="btn" onclick="regenerarOportunitats()">🤖 Regenerar amb IA</button>' : ''}
      </div>
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
            <button class="btn btn-sm" onclick="deleteRecord('oportunitats','${o.id}')" style="color:var(--danger)">🗑</button>
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

// =================================================================
// TODO POTENT — lògica del dia (traspàs automàtic + pròrroga)
// =================================================================
window.tascaActivaAvui = (t) => {
  if (t.estat === 'done') return false;
  if (!t.data_prevista) return true;
  const avui = new Date(); avui.setHours(0,0,0,0);
  const d = new Date(t.data_prevista); d.setHours(0,0,0,0);
  return d <= avui;   // planificada per a avui o abans (s'arrossega sola)
};
window.tascaEndarrerida = (t) => {
  if (t.estat === 'done' || !t.data_prevista) return false;
  const avui = new Date(); avui.setHours(0,0,0,0);
  const d = new Date(t.data_prevista); d.setHours(0,0,0,0);
  return d < avui;
};
window.tasquesAvui = () => state.tasques.filter(window.tascaActivaAvui);

function _diesEndarrerida(t) {
  const avui = new Date(); avui.setHours(0,0,0,0);
  const d = new Date(t.data_prevista); d.setHours(0,0,0,0);
  return Math.round((avui - d) / 86400000);
}

function _tascaItemHTML(t) {
  const endarr = window.tascaEndarrerida(t);
  const dies = endarr ? _diesEndarrerida(t) : 0;
  const prioPill = t.prioritat ? `<span class="pill ${t.prioritat==='Alta'?'p-danger':t.prioritat==='Mitjana'?'p-warning':'p-success'}">${escapeHtml(t.prioritat)}</span>` : '';
  const catPill = t.categoria ? `<span class="pill p-gray">${escapeHtml(t.categoria)}</span>` : '';
  const dataPill = endarr
    ? `<span class="pill p-danger">Endarrerida ${dies}d</span>`
    : (t.data_prevista ? `<span class="pill p-info">${fmtDate(t.data_prevista)}</span>` : '');
  const prorrPill = (t.num_prorrogues||0) >= 2 ? `<span class="pill p-warning" title="Prorrogada ${t.num_prorrogues} cops">⏳ ${t.num_prorrogues}×</span>` : '';
  const limitPill = t.data_limit ? `<span class="pill p-gray" title="Data límit">⏰ ${fmtDate(t.data_limit)}</span>` : '';
  const avatar = (window.isAdmin() && t.user_id) ? renderUserAvatar(t.user_id,'sm') : '';
  const accions = t.estat !== 'done'
    ? `<button class="btn btn-sm" onclick="posposarTascaModal('${t.id}')" title="Prorrogar">⏭ Posposar</button>`
    : '';
  return `
    <li>
      <div class="check ${t.estat==='done'?'done':''}" onclick="toggleTasca('${t.id}')"></div>
      <div style="flex:1">
        <div class="text ${t.estat==='done'?'done':''}">${escapeHtml(t.titol)}</div>
        ${t.descripcio ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${escapeHtml(t.descripcio)}</div>` : ''}
        <div class="text-meta">${prioPill}${catPill}${dataPill}${prorrPill}${limitPill}${avatar}</div>
      </div>
      <div style="display:flex;gap:4px">
        ${accions}
        <button class="btn btn-sm" onclick="deleteRecord('tasques','${t.id}')" style="color:var(--danger)">🗑</button>
      </div>
    </li>`;
}

window.renderTasques = function() {
  const c = document.getElementById('tab-content');
  const filtre = state._filtreTasques || 'avui';
  let list;
  if (filtre === 'avui') list = state.tasques.filter(window.tascaActivaAvui);
  else if (filtre === 'pendent') list = state.tasques.filter(t => t.estat === 'pendent');
  else if (filtre === 'done') list = state.tasques.filter(t => t.estat === 'done');
  else list = [...state.tasques];
  const ord = {'Alta':3,'Mitjana':2,'Baixa':1};
  list.sort((a,b) => {
    const ea = window.tascaEndarrerida(a)?1:0, eb = window.tascaEndarrerida(b)?1:0;
    if (ea !== eb) return eb - ea;
    return (ord[b.prioritat]||0)-(ord[a.prioritat]||0);
  });
  const endarrerides = list.filter(window.tascaEndarrerida).length;
  c.innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Tasques</div><div class="page-sub">${list.length} ${filtre==='avui'?"per avui":(filtre||'totes')}${endarrerides?` · ${endarrerides} endarrerides`:''}</div></div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openModal('tasca')">+ Nova</button></div>
    </div>
    <div class="toolbar">
      <button class="btn btn-pill ${filtre==='avui'?'active':''}" onclick="state._filtreTasques='avui';renderTasques()">Avui</button>
      <button class="btn btn-pill ${filtre==='pendent'?'active':''}" onclick="state._filtreTasques='pendent';renderTasques()">Totes pendents</button>
      <button class="btn btn-pill ${filtre==='done'?'active':''}" onclick="state._filtreTasques='done';renderTasques()">Fetes</button>
      <button class="btn btn-pill ${filtre===''?'active':''}" onclick="state._filtreTasques='';renderTasques()">Totes</button>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;gap:8px">
        <input type="text" id="quick-tasca" placeholder="Afegeix una tasca per avui i prem Enter…" onkeydown="if(event.key==='Enter')quickAddTascaAvui()" style="flex:1">
        <button class="btn btn-primary" onclick="quickAddTascaAvui()">Afegir</button>
      </div>
    </div>
    ${list.length === 0
      ? `<div class="card"><div class="empty-state">${filtre==='avui'?'Res per avui. Bona feina! 🎉':'Cap tasca'}</div></div>`
      : `<div class="card"><ul class="checklist">${list.map(_tascaItemHTML).join('')}</ul></div>`}
  `;
};
window.renderTasquesList = window.renderTasques;

// Afegir ràpid una tasca per a avui (des de Tasques o el Tauler)
window.quickAddTascaAvui = async function(inputId) {
  const el = document.getElementById(inputId || 'quick-tasca');
  const titol = (el?.value || '').trim();
  if (!titol) { if (el) el.focus(); return; }
  const dades = {
    titol, prioritat: 'Mitjana', categoria: 'comercial', estat: 'pendent',
    data_prevista: new Date().toISOString().slice(0,10),
    user_id: state.user.id, mediador_id: state.mediador?.id || null
  };
  try {
    const { error } = await supabase.from('tasques').insert(dades);
    if (error) throw error;
    if (el) el.value = '';
    await refreshData('tasques');
    renderCurrentTab();
    updateNavBadges();
  } catch (err) { toast('Error: '+err.message, 'error'); }
};

// Modal lleuger per prorrogar (sense prompt() natiu)
window.posposarTascaModal = function(id) {
  const t = state.tasques.find(x => x.id === id);
  if (!t) return;
  const fmtISO = (d) => d.toISOString().slice(0,10);
  const avui = new Date();
  const dema = new Date(avui); dema.setDate(avui.getDate()+1);
  const tresDies = new Date(avui); tresDies.setDate(avui.getDate()+3);
  const setmana = new Date(avui); setmana.setDate(avui.getDate()+7);
  const dilluns = new Date(avui); dilluns.setDate(avui.getDate() + ((8 - avui.getDay()) % 7 || 7));
  const html = `
    <div class="modal-title">Prorrogar tasca</div>
    <div class="modal-sub">${escapeHtml(t.titol)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin:14px 0">
      <button class="btn" onclick="posposarTasca('${id}','${fmtISO(dema)}')">Demà</button>
      <button class="btn" onclick="posposarTasca('${id}','${fmtISO(tresDies)}')">D'aquí 3 dies</button>
      <button class="btn" onclick="posposarTasca('${id}','${fmtISO(setmana)}')">D'aquí 1 setmana</button>
      <button class="btn" onclick="posposarTasca('${id}','${fmtISO(dilluns)}')">Dilluns vinent</button>
    </div>
    <div class="form-row"><label>O tria una data concreta</label>
      <input type="date" id="posposar-data" value="${fmtISO(dema)}" min="${fmtISO(dema)}">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel·lar</button>
      <button class="btn btn-primary" onclick="posposarTasca('${id}', document.getElementById('posposar-data').value)">Prorrogar</button>
    </div>`;
  document.getElementById('modal-container').innerHTML =
    `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
};

window.posposarTasca = async function(id, dataISO) {
  if (!dataISO) { toast('Tria una data','error'); return; }
  const t = state.tasques.find(x => x.id === id);
  const nProrr = (t?.num_prorrogues || 0) + 1;
  try {
    const { error } = await supabase.from('tasques')
      .update({ data_prevista: dataISO, num_prorrogues: nProrr }).eq('id', id);
    if (error) throw error;
    if (t) { t.data_prevista = dataISO; t.num_prorrogues = nProrr; }
    closeModal();
    renderCurrentTab();
    updateNavBadges();
    toast(nProrr >= 3 ? `Prorrogada (ja ${nProrr} cops — l'hauries de tancar?)` : 'Tasca prorrogada', nProrr >= 3 ? 'error' : 'success');
  } catch (err) { toast('Error: '+err.message, 'error'); }
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
      <div style="font-size:13px;color:var(--text-2);margin-bottom:14px">Rol: <span class="role-badge ${roleBadgeClass(state.mediador?.rol)}">${escapeHtml(state.mediador?.rol||'lector')}</span></div>
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
window.renderAgenda = () => { document.getElementById('tab-content').innerHTML = `<div class="topbar"><div><div class="page-title">📅 Agenda</div></div></div><div class="empty-state">Mòdul disponible al següent sprint</div>`; };
window.renderEsborranys = () => { document.getElementById('tab-content').innerHTML = `<div class="topbar"><div><div class="page-title">📝 Esborranys</div></div></div><div class="empty-state">Mòdul disponible al següent sprint</div>`; };
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
  const fet = t.estat !== 'done';
  const nouEstat = fet ? 'done' : 'pendent';
  const completedAt = fet ? new Date().toISOString() : null;
  try {
    await supabase.from('tasques').update({ estat: nouEstat, completed_at: completedAt }).eq('id', id);
    t.estat = nouEstat;
    t.completed_at = completedAt;
    renderCurrentTab();
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
window.copyEsborrany = () => {};
window.selectTopic = () => {};
window.copyPost = () => {};
window.savePost = () => {};
window.generatePost = () => {};
window.iaAccio = () => {};
window.openIAImport = () => showTab('ia');

// ==================================================================
// PATCH 08/06/2026 — apiCallWithRetry (faltava)
// Afegir al final de modules.js, just abans de l'últim console.log
// ==================================================================

window.apiCallWithRetry = async function(url, options = {}, maxRetries = 3) {
  const delays = [2000, 5000, 10000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const headers = { ...(options.headers || {}) };

      // Adjuntar JWT de Supabase a crides a /api/* (per autenticar a ai-proxy)
      if (url.startsWith('/api/') && window.supabase) {
        try {
          const { data: { session } } = await window.supabase.auth.getSession();
          if (session?.access_token && !headers.Authorization) {
            headers.Authorization = `Bearer ${session.access_token}`;
          }
        } catch (e) { /* segueix sense token */ }
      }

      const response = await fetch(url, { ...options, headers });

      // Retry per saturació
      if (response.status === 429 || response.status === 529) {
        if (attempt < maxRetries) {
          if (typeof toast === 'function') {
            toast(`Servidors saturats, reintentant en ${delays[attempt]/1000}s...`, 'warning');
          }
          await new Promise(r => setTimeout(r, delays[attempt]));
          continue;
        }
        throw new Error("Servidors d'IA saturats. Torna a provar en un minut.");
      }

      if (!response.ok) {
        const txt = await response.text();
        let msg = `Error ${response.status}`;
        try {
          const j = JSON.parse(txt);
          msg = j.error?.message || j.error || msg;
        } catch (e) {}
        throw new Error(msg);
      }

      return response;

    } catch (err) {
      if (attempt < maxRetries && /fetch|network|Failed to fetch/i.test(err.message)) {
        await new Promise(r => setTimeout(r, delays[attempt]));
        continue;
      }
      throw err;
    }
  }
};

console.log('✅ apiCallWithRetry definit');

console.log('✅ modules.js carregat correctament');

// ==================================================================
// CERCA GLOBAL (Cmd/Ctrl+K) — cerca a tot el CRM
// ==================================================================
window.openGlobalSearch = function() {
  if (document.getElementById('global-search-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'global-search-overlay';
  ov.className = 'modal-overlay';
  ov.style.alignItems = 'flex-start';
  ov.style.paddingTop = '10vh';
  ov.onclick = (e) => { if (e.target === ov) closeGlobalSearch(); };
  ov.innerHTML = `
    <div class="modal" style="max-width:640px;padding:0;overflow:hidden">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">🔍</span>
        <input id="global-search-input" type="text" placeholder="Cerca clients, ofertes, oportunitats, venciments, tasques..." style="border:none;background:transparent;font-size:16px;flex:1;outline:none" autocomplete="off">
        <span style="font-size:11px;color:var(--text-3)">ESC</span>
      </div>
      <div id="global-search-results" style="max-height:55vh;overflow-y:auto;padding:8px"></div>
    </div>`;
  document.body.appendChild(ov);
  const input = document.getElementById('global-search-input');
  input.addEventListener('input', () => renderGlobalSearchResults(input.value));
  input.focus();
  renderGlobalSearchResults('');
};

window.closeGlobalSearch = function() {
  const ov = document.getElementById('global-search-overlay');
  if (ov) ov.remove();
};

function gsNom(cli) {
  if (!cli) return '?';
  return cli.tipus === 'particular' ? (cli.nom || cli.empresa || '?') : (cli.empresa || cli.nom || '?');
}

window.renderGlobalSearchResults = function(q) {
  const box = document.getElementById('global-search-results');
  if (!box) return;
  const term = (q || '').toLowerCase().trim();
  if (!term) {
    box.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px">Escriu per cercar a tot el CRM</div>';
    return;
  }
  const match = (...vals) => vals.some(v => v && String(v).toLowerCase().includes(term));
  const groups = [];

  const clients = (state.clients||[]).filter(c => match(c.empresa, c.nom, c.cif, c.dni, c.email, c.telefon, c.notes))
    .map(c => ({ label: gsNom(c), sub: [c.cif||c.dni, c.email, c.telefon].filter(Boolean).join(' · '), tab: 'clients', icon: '👥' }));
  if (clients.length) groups.push({ title: 'Clients', items: clients });

  const ofertes = (state.ofertes||[]).filter(o => match(o.empresa, o.ram, o.asseguradora, o.notes))
    .map(o => ({ label: o.empresa || gsNom((state.clients||[]).find(c=>c.id===o.client_id)), sub: [o.ram, o.estat, o.prima_brokkom?fmtEur(o.prima_brokkom):null].filter(Boolean).join(' · '), tab: 'pipeline', icon: '🎯' }));
  if (ofertes.length) groups.push({ title: 'Ofertes', items: ofertes });

  const consolidats = (state.consolidats||[]).filter(c => match(c.empresa, c.ram, c.asseguradora, c.num_polissa))
    .map(c => ({ label: c.empresa, sub: [c.ram, c.asseguradora, c.prima_anual?fmtEur(c.prima_anual):null].filter(Boolean).join(' · '), tab: 'consolidats', icon: '🏆' }));
  if (consolidats.length) groups.push({ title: 'Consolidats', items: consolidats });

  const opps = (state.oportunitats||[]).filter(o => match(o.empresa, o.producte, o.argument, o.prioritat))
    .map(o => ({ label: o.empresa || gsNom((state.clients||[]).find(c=>c.id===o.client_id)), sub: [o.producte, o.prioritat, o.estat].filter(Boolean).join(' · '), tab: 'oportunitats', icon: '💡' }));
  if (opps.length) groups.push({ title: 'Oportunitats', items: opps });

  const venc = (state.venciments||[]).filter(v => match(v.empresa, v.ram, v.asseguradora))
    .map(v => ({ label: v.empresa, sub: [v.ram, v.data_venciment?fmtDate(v.data_venciment):null].filter(Boolean).join(' · '), tab: 'venciments', icon: '📆' }));
  if (venc.length) groups.push({ title: 'Venciments', items: venc });

  const seg = (state.seguiments||[]).filter(s => match(s.resum, s.canal, s.proper_pas))
    .map(s => ({ label: gsNom((state.clients||[]).find(c=>c.id===s.client_id)), sub: [s.canal, s.resum].filter(Boolean).join(' · ').slice(0,80), tab: 'seguiments', icon: '📞' }));
  if (seg.length) groups.push({ title: 'Seguiments', items: seg });

  const tasq = (state.tasques||[]).filter(t => match(t.titol, t.descripcio, t.categoria))
    .map(t => ({ label: t.titol, sub: [t.prioritat, t.categoria, t.estat].filter(Boolean).join(' · '), tab: 'tasques', icon: '✓' }));
  if (tasq.length) groups.push({ title: 'Tasques', items: tasq });

  const asseg = (state.asseguradores||[]).filter(a => match(a.nom, (a.rams||[]).join(' '), a.notes))
    .map(a => ({ label: a.nom, sub: (a.rams||[]).join(', '), tab: 'asseguradores', icon: '🛡️' }));
  if (asseg.length) groups.push({ title: 'Asseguradores', items: asseg });

  const total = groups.reduce((n,g)=>n+g.items.length,0);
  if (!total) {
    box.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px">Cap resultat per "${q}"</div>`;
    return;
  }
  box.innerHTML = groups.map(g => `
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);padding:8px 8px 4px">${g.title} (${g.items.length})</div>
    ${g.items.slice(0,8).map(it => `
      <div class="gs-item" onclick="closeGlobalSearch();showTab('${it.tab}')" style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer">
        <span>${it.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500">${it.label}</div>
          ${it.sub?`<div style="font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.sub}</div>`:''}
        </div>
      </div>`).join('')}
  `).join('');
  box.querySelectorAll('.gs-item').forEach(el => {
    el.onmouseenter = () => el.style.background = 'var(--surface-2)';
    el.onmouseleave = () => el.style.background = 'transparent';
  });
};

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (document.getElementById('global-search-overlay')) closeGlobalSearch();
    else openGlobalSearch();
  }
  if (e.key === 'Escape') closeGlobalSearch();
});

// ==================================================================
// SECCIÓ FUSIONADA des de brokkom-patch.js (Notes, Bústia IA, Usuaris,
// compartir, processarIA/_iaImport amb sanejament). Consolidat 24/06/2026.
// ==================================================================

// ==================================================================
// BROKKOM CRM · brokkom-patch.js — 08/06/2026
// Es carrega DESPRÉS de modules.js i modals.js.
// Sobreescriu funcions per arreglar la IA i afegir Notes.
// NO toca cap altre fitxer.
// ==================================================================
console.log('🩹 brokkom-patch.js carregant...');

// ------------------------------------------------------------------
// SANEJAMENT DELS IMPORTS DE LA BÚSTIA IA (rescatat de brokkom-patch3)
// La IA retorna "" per als camps que no troba. Inserir "" en una columna
// de data o numèrica fa fallar tot l'import. Aquests helpers converteixen
// "" → null, validen dates (YYYY-MM-DD) i normalitzen euros amb coma.
// ------------------------------------------------------------------
function bk3Date(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function bk3Num(v) {
  // Reutilitza el parseEuro global; 0 es tracta com a "sense dada".
  const n = (typeof window.parseEuro === 'function') ? window.parseEuro(v) : (v === '' ? null : parseFloat(v));
  return (n === null || n === 0 || isNaN(n)) ? null : n;
}
function bk3Text(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
const BK3_SCHEMA = {
  clients: {
    empresa: bk3Text, nom: bk3Text, tipus: bk3Text, cif: bk3Text, dni: bk3Text,
    contacte: bk3Text, carrec: bk3Text, email: bk3Text, telefon: bk3Text,
    sector: bk3Text, facturacio: bk3Text, treballadors: bk3Text,
    adreca: bk3Text, professio: bk3Text, notes: bk3Text
  },
  ofertes: {
    empresa: bk3Text, ram: bk3Text, asseguradora: bk3Text,
    prima_actual: bk3Num, prima_brokkom: bk3Num,
    estat: bk3Text, venciment: bk3Date, notes: bk3Text
  },
  venciments: {
    empresa: bk3Text, ram: bk3Text, asseguradora: bk3Text,
    data_venciment: bk3Date, prima_actual: bk3Num
  },
  seguiments: {
    data: bk3Date, canal: bk3Text, resum: bk3Text, proper_pas: bk3Text
  },
  oportunitats: {
    empresa: bk3Text, producte: bk3Text, argument: bk3Text, prioritat: bk3Text
  }
};
function bk3Clean(key, item) {
  const schema = BK3_SCHEMA[key] || {};
  const out = {};
  for (const [camp, fn] of Object.entries(schema)) {
    if (item[camp] === undefined) continue;
    const v = fn(item[camp]);
    if (v !== null) out[camp] = v;
  }
  return out;
}

// ------------------------------------------------------------------
// FIX CRÍTIC 11/06/2026 — funcions auxiliars que FALTAVEN
// modules.js crida getMediadorByUserId() i getSharedWith() des de
// Clients, Seguiments, fitxa client i el modal de compartir, però
// no estaven definides ENLLOC. Resultat: el renderitzador bo petava
// amb TypeError, app.js capturava l'error en silenci i mostrava el
// "pla B" (renderBasicTab) — la llista plana sense editar/eliminar.
// Definir-les desbloqueja els mòduls complets.
// ------------------------------------------------------------------
if (!window.getMediadorByUserId) {
  window.getMediadorByUserId = function(userId) {
    return (state.mediadors || []).find(m => m.user_id === userId) || null;
  };
}
if (!window.getSharedWith) {
  window.getSharedWith = function(recursTipus, recursId) {
    return (state.comparticions || [])
      .filter(c => c.recurs_tipus === recursTipus && c.recurs_id === recursId)
      .map(c => ({ ...c, mediador: window.getMediadorByUserId(c.compartit_amb_id) }));
  };
}
if (!window.getAvatarColor) {
  window.getAvatarColor = function(userId) {
    const colors = ['#0F766E','#1D4ED8','#7C3AED','#B45309','#BE123C','#15803D'];
    let h = 0;
    for (const ch of String(userId || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return colors[h % colors.length];
  };
}

// ------------------------------------------------------------------
// HELPER: vincular o crear client per nom (empresa o particular)
// ------------------------------------------------------------------
async function _patchTrobaOCreaClient(nom) {
  if (!nom) return null;
  const n = nom.trim().toLowerCase();
  let cli = state.clients.find(c =>
    (c.empresa || '').toLowerCase() === n || (c.nom || '').toLowerCase() === n
  );
  if (cli) return cli.id;
  // crear client mínim (empresa per defecte)
  try {
    const { data, error } = await supabase.from('clients')
      .insert({ empresa: nom, tipus: 'empresa', user_id: state.user.id })
      .select()
      .single();
    if (error) throw error;
    state.clients.push(data);
    return data.id;
  } catch (e) {
    console.warn('No s\'ha pogut crear client:', e.message);
    return null;
  }
}

// ------------------------------------------------------------------
// IA ASSISTENT (Bústia) — versió arreglada
//   · fitxes completes amb totes les dades
//   · import sense esborrar la pantalla (marca "✓ Importat")
//   · importa 5 categories: clients, ofertes, venciments, seguiments, oportunitats
//   · botó "Importar-ho tot"
// ------------------------------------------------------------------
window.processarIA = async function() {
  const txt = document.getElementById('ia-input').value.trim();
  if (!txt) { toast('Enganxa primer text', 'error'); return; }

  const btn = document.querySelector('[onclick="processarIA()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loader"></span> Processant...'; }

  const resDiv = document.getElementById('ia-result-content');
  document.getElementById('ia-result').classList.remove('hidden');
  resDiv.innerHTML = '<div class="empty-state"><span class="loader loader-lg"></span><br><br>Processant amb IA...</div>';

  const prompt = `Ets el CRM intel·ligent de Brokkom Correduria de Seguros (sector transport). Analitza aquest text i extreu informació estructurada en JSON. Omple TOTS els camps que puguis deduir del text; deixa buit el que no aparegui (no inventis).

{
  "clients": [{"empresa":"","nom":"","tipus":"empresa","cif":"","dni":"","contacte":"","carrec":"","email":"","telefon":"","sector":"","facturacio":"","treballadors":"","adreca":"","professio":"","notes":""}],
  "ofertes": [{"empresa":"","ram":"","prima_actual":0,"prima_brokkom":0,"asseguradora":"","estat":"Lead","venciment":"","notes":""}],
  "venciments": [{"empresa":"","ram":"","data_venciment":"YYYY-MM-DD","prima_actual":0,"asseguradora":""}],
  "oportunitats": [{"empresa":"","producte":"","argument":"","prioritat":"Alta|Mitjana|Baixa"}],
  "seguiments": [{"empresa":"","data":"YYYY-MM-DD","canal":"Email|Telèfon|Reunió|WhatsApp","resum":"","proper_pas":""}],
  "resum": "resum executiu en 2-3 frases",
  "alertes": ["alertes, dades importants o estalvis grans"]
}

Regles:
- Si és un email, el remitent és el contacte.
- Convenis col·lectius → oportunitat alta RC Patronal/accidents.
- Flota → oportunitat ciber + telemàtica.
- Si l'estalvi supera el 30%, afegeix-ho a alertes.
- tipus: "particular" si és una persona física, "empresa" altrament.
- Números sense símbol €.

TEXT:
${txt}

Retorna NOMÉS el JSON, sense cap explicació.`;

  try {
    const result = await callAnthropicAPI(prompt, state.config?.model_fast);
    let parsed;
    try {
      const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      resDiv.innerHTML = `<div style="white-space:pre-wrap;font-size:13px">${result}</div>`;
      return;
    }
    window._iaParsed = parsed;
    _patchRenderIAResult(parsed);
  } catch (err) {
    resDiv.innerHTML = `<div style="color:var(--danger)">Error: ${err.message}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '🤖 Processar amb IA'; }
  }
};

// Render del resultat IA amb fitxes detallades
function _patchRenderIAResult(parsed) {
  const resDiv = document.getElementById('ia-result-content');

  // comptar total elements importables
  const cats = ['clients', 'ofertes', 'venciments', 'seguiments', 'oportunitats'];
  let totalItems = 0;
  cats.forEach(k => { if (parsed[k]?.length) totalItems += parsed[k].length; });

  let html = '';

  // capçalera + botó importar-ho tot
  html += `<div class="ia-result-head">
    <span style="font-size:13px;font-weight:500">Resultat del processament</span>
    ${totalItems > 0 ? `<button class="btn btn-brand btn-sm btn-import-all" onclick="window._iaImportTot()">⬇ Importar-ho tot (${totalItems})</button>` : ''}
  </div>`;

  // resum
  if (parsed.resum) html += `<div class="ia-summary">${parsed.resum}</div>`;

  // alertes
  if (parsed.alertes?.length) {
    html += `<div class="ia-alertes"><div class="ia-alertes-title">⚠️ Alertes</div><ul>${parsed.alertes.map(a => `<li>${a}</li>`).join('')}</ul></div>`;
  }

  // definició de com mostrar cada categoria
  const renderers = {
    clients: {
      label: '🏢 Clients detectats',
      fields: (c) => [
        ['Tipus', c.tipus || 'empresa'],
        ['CIF/DNI', c.cif || c.dni],
        ['Contacte', c.contacte],
        ['Càrrec', c.carrec],
        ['Email', c.email],
        ['Telèfon', c.telefon],
        ['Sector', c.sector],
        ['Treballadors', c.treballadors],
        ['Facturació', c.facturacio],
        ['Professió', c.professio],
        ['Adreça', c.adreca]
      ],
      name: (c) => c.empresa || c.nom || '?',
      note: (c) => c.notes
    },
    ofertes: {
      label: '🎯 Ofertes detectades',
      fields: (o) => {
        const est = (parseFloat(o.prima_actual) || 0) - (parseFloat(o.prima_brokkom) || 0);
        const pct = (o.prima_actual && o.prima_brokkom) ? Math.round((est / o.prima_actual) * 100) : 0;
        return [
          ['Ram', o.ram],
          ['Asseguradora', o.asseguradora],
          ['Prima actual', o.prima_actual ? fmtEur(o.prima_actual) : ''],
          ['Prima Brokkom', o.prima_brokkom ? fmtEur(o.prima_brokkom) : ''],
          ['Estalvi', est > 0 ? `<span class="ia-estalvi-bo">${fmtEur(est)} (${pct}%)</span>` : ''],
          ['Estat', o.estat],
          ['Venciment', o.venciment ? fmtDate(o.venciment) : '']
        ];
      },
      name: (o) => o.empresa || '?',
      note: (o) => o.notes
    },
    venciments: {
      label: '📆 Venciments detectats',
      fields: (v) => [
        ['Ram', v.ram],
        ['Asseguradora', v.asseguradora],
        ['Data venciment', v.data_venciment ? fmtDate(v.data_venciment) : ''],
        ['Prima actual', v.prima_actual ? fmtEur(v.prima_actual) : '']
      ],
      name: (v) => v.empresa || '?',
      note: () => ''
    },
    seguiments: {
      label: '📞 Seguiments detectats',
      fields: (s) => [
        ['Data', s.data ? fmtDate(s.data) : ''],
        ['Canal', s.canal],
        ['Proper pas', s.proper_pas]
      ],
      name: (s) => s.empresa || '?',
      note: (s) => s.resum
    },
    oportunitats: {
      label: '💡 Oportunitats detectades',
      fields: (o) => [
        ['Producte', o.producte],
        ['Prioritat', o.prioritat]
      ],
      name: (o) => o.empresa || '?',
      note: (o) => o.argument
    }
  };

  cats.forEach(key => {
    const items = parsed[key];
    if (!items?.length) return;
    const r = renderers[key];
    html += `<div class="ia-cat">
      <div class="ia-cat-title">${r.label} <span class="ia-cat-count">${items.length}</span></div>
      ${items.map((item, idx) => {
        const fieldsHtml = r.fields(item)
          .filter(([, val]) => val !== undefined && val !== null && val !== '' && val !== 0)
          .map(([label, val]) => `<div class="ia-field"><span class="ia-field-label">${label}</span><span class="ia-field-val">${val}</span></div>`)
          .join('');
        const noteVal = r.note(item);
        return `<div class="ia-item" id="ia-item-${key}-${idx}">
          <div class="ia-item-head">
            <div class="ia-item-name">${r.name(item)}</div>
            <button class="btn btn-sm" id="ia-btn-${key}-${idx}" onclick="window._iaImport('${key}',${idx})">+ Importar</button>
          </div>
          ${fieldsHtml ? `<div class="ia-item-fields">${fieldsHtml}</div>` : ''}
          ${noteVal ? `<div class="ia-item-note">${noteVal}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  });

  resDiv.innerHTML = html || '<div class="empty-state">No s\'ha detectat informació estructurada</div>';
}

// Importa UN element sense re-renderitzar tota la pestanya.
// FIX 11/06/2026:
//   1. Comprovem l'error de CADA insert (abans es marcava "Importat"
//      encara que Supabase hagués rebutjat la fila).
//   2. Refresc SILENCIÓS: actualitzem l'estat directament des de Supabase
//      sense cridar refreshData(), que re-renderitzava la pestanya i feia
//      desaparèixer les fitxes pendents d'importar.
window._iaImport = async function(key, idx) {
  const parsed = window._iaParsed;
  if (!parsed || !parsed[key] || !parsed[key][idx]) return;
  const item = parsed[key][idx];
  const btn = document.getElementById(`ia-btn-${key}-${idx}`);
  const card = document.getElementById(`ia-item-${key}-${idx}`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  const mustOk = ({ error }) => { if (error) throw new Error(error.message); };

  try {
    if (key === 'clients') {
      const payload = { ...bk3Clean('clients', item), user_id: state.user.id };
      if (!payload.empresa && !payload.nom) throw new Error('Falta el nom o l\u2019empresa');
      if (!payload.tipus) payload.tipus = 'empresa';
      mustOk(await supabase.from('clients').insert(payload));

    } else if (key === 'venciments') {
      const cid = await _patchTrobaOCreaClient(item.empresa);
      const net = bk3Clean('venciments', item);
      if (!net.data_venciment) throw new Error('La data de venciment no és vàlida — afegeix-la a mà des de Venciments');
      mustOk(await supabase.from('venciments').insert({ ...net, client_id: cid, user_id: state.user.id }));

    } else if (key === 'ofertes') {
      const cid = await _patchTrobaOCreaClient(item.empresa);
      const net = bk3Clean('ofertes', item);
      mustOk(await supabase.from('ofertes').insert({
        ...net, client_id: cid, user_id: state.user.id,
        estat: net.estat || 'Lead'
      }));

    } else if (key === 'seguiments') {
      const cid = await _patchTrobaOCreaClient(item.empresa);
      const net = bk3Clean('seguiments', item);
      mustOk(await supabase.from('seguiments').insert({
        ...net, client_id: cid, user_id: state.user.id,
        data: net.data || new Date().toISOString().slice(0, 10)
      }));

    } else if (key === 'oportunitats') {
      const cid = await _patchTrobaOCreaClient(item.empresa);
      const net = bk3Clean('oportunitats', item);
      mustOk(await supabase.from('oportunitats').insert({
        ...net, client_id: cid, user_id: state.user.id, estat: 'Detectada'
      }));
    }

    // marcar com importat — la fitxa es queda a pantalla
    if (card) card.classList.add('imported');
    if (btn) { btn.textContent = '✓ Importat'; btn.disabled = true; }

    // refresc silenciós de l'estat (sense refreshData → sense re-render)
    try {
      const { data } = await supabase.from(key).select('*');
      if (data) state[key] = data;
    } catch (e) { /* l'import ja és fet; el refresc pot esperar */ }
    if (typeof updateNavBadges === 'function') updateNavBadges();
    toast('Importat al CRM');

  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '+ Importar'; }
    toast('Error important: ' + e.message, 'error');
  }
};

// Importa TOTS els elements detectats
window._iaImportTot = async function() {
  const parsed = window._iaParsed;
  if (!parsed) return;
  const cats = ['clients', 'ofertes', 'venciments', 'seguiments', 'oportunitats'];
  // clients primer (perquè ofertes/seguiments s'hi vinculin)
  for (const key of cats) {
    if (!parsed[key]?.length) continue;
    for (let idx = 0; idx < parsed[key].length; idx++) {
      const card = document.getElementById(`ia-item-${key}-${idx}`);
      if (card && card.classList.contains('imported')) continue;
      await window._iaImport(key, idx);
    }
  }
  toast('Tot importat al CRM');
};

// ------------------------------------------------------------------
// MÒDUL NOTES — complet, sempre lligat a un client, amb IA
// ------------------------------------------------------------------
window.renderNotes = function() {
  const c = document.getElementById('tab-content');
  const list = [...(state.notes || [])].sort((a, b) =>
    new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0)
  );

  c.innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Notes</div><div class="page-sub">${list.length} notes · sempre lligades a un client</div></div>
      <div class="topbar-actions">
        <button class="btn btn-primary" onclick="openNotaModal()" ${state.clients.length === 0 ? 'disabled title="Crea un client primer"' : ''}>+ Nova nota</button>
      </div>
    </div>
    ${state.clients.length === 0 ? `
      <div class="card"><div class="empty-state"><div class="empty-icon">💭</div>
        Les notes van sempre lligades a un client.<br>Crea primer un client.<br><br>
        <button class="btn btn-primary" onclick="openModal('client')">+ Crear client</button>
      </div></div>
    ` : list.length === 0 ? `
      <div class="card"><div class="empty-state"><div class="empty-icon">💭</div>
        Cap nota encara<br><br>
        <button class="btn btn-primary" onclick="openNotaModal()">+ Crear primera nota</button>
      </div></div>
    ` : list.map(n => {
      const cli = state.clients.find(x => x.id === n.client_id);
      const nomCli = cli ? getClientNom(cli) : '(client esborrat)';
      return `<div class="note-card ${n.favorita ? 'favorita' : ''}" id="note-card-${n.id}">
        <div class="card-row">
          <div style="flex:1">
            ${n.titol ? `<div class="note-title">${n.titol}</div>` : ''}
            <div class="note-link-client" onclick="state._clientObert='${n.client_id}';showTab('clients')">↗ ${nomCli}</div>
          </div>
          <span class="note-fav-star ${n.favorita ? 'on' : ''}" onclick="toggleFavoritaNota('${n.id}')" title="Marcar preferida">${n.favorita ? '★' : '☆'}</span>
        </div>
        <div class="note-body" style="margin-top:8px">${n.contingut || ''}</div>
        <div id="note-ia-${n.id}"></div>
        <div class="note-card-actions">
          <button class="btn btn-sm" onclick="processarNotaIA('${n.id}')">🤖 Processar amb IA</button>
          <button class="btn btn-sm" onclick="openNotaModal('${n.id}')">✏️ Editar</button>
          <button class="btn btn-sm" onclick="deleteRecord('notes','${n.id}')" style="color:var(--danger)">🗑</button>
        </div>
      </div>`;
    }).join('')}
  `;
};
window.renderNotesList = window.renderNotes;

// Marcar nota preferida
window.toggleFavoritaNota = async function(id) {
  const n = (state.notes || []).find(x => x.id === id);
  if (!n) return;
  try {
    const nou = !n.favorita;
    await supabase.from('notes').update({ favorita: nou }).eq('id', id);
    n.favorita = nou;
    renderNotes();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

// Processar una nota concreta amb IA → oportunitats + seguiments
window.processarNotaIA = async function(id) {
  const n = (state.notes || []).find(x => x.id === id);
  if (!n) return;
  const cli = state.clients.find(c => c.id === n.client_id);
  if (!cli) { toast('Aquesta nota no té client vinculat', 'error'); return; }

  const box = document.getElementById('note-ia-' + id);
  if (box) box.innerHTML = '<div class="note-ia-result"><span class="loader"></span> Analitzant la nota amb IA...</div>';

  const prompt = `Ets el CRM de Brokkom Correduria (sector transport i particulars). Analitza aquesta nota sobre el client i extreu oportunitats de venda i propers passos.

CLIENT: ${getClientNom(cli)} (${cli.tipus || 'empresa'})
${cli.sector ? 'Sector: ' + cli.sector : ''}
${cli.professio ? 'Professió: ' + cli.professio : ''}

NOTA:
${n.contingut || ''}

Retorna NOMÉS aquest JSON:
{
  "oportunitats": [{"producte":"","argument":"","prioritat":"Alta|Mitjana|Baixa"}],
  "seguiments": [{"data":"YYYY-MM-DD","canal":"Email|Telèfon|Reunió|WhatsApp","resum":"","proper_pas":""}],
  "resum": "una frase resum"
}`;

  try {
    const result = await callAnthropicAPI(prompt, state.config?.model_smart);
    const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    window['_notaIA_' + id] = { parsed, clientId: n.client_id };

    let html = '<div class="note-ia-result">';
    if (parsed.resum) html += `<div style="margin-bottom:8px">${parsed.resum}</div>`;

    if (parsed.oportunitats?.length) {
      html += `<div style="font-weight:600;margin-bottom:4px">💡 Oportunitats</div>`;
      parsed.oportunitats.forEach((o, i) => {
        html += `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0">
          <span>${o.producte} <span class="pill ${o.prioritat === 'Alta' ? 'p-danger' : o.prioritat === 'Mitjana' ? 'p-warning' : 'p-success'}">${o.prioritat || ''}</span></span>
          <button class="btn btn-sm" onclick="importarNotaOpp('${id}',${i})">+ Afegir</button>
        </div>`;
      });
    }
    if (parsed.seguiments?.length) {
      html += `<div style="font-weight:600;margin:8px 0 4px">📞 Seguiments suggerits</div>`;
      parsed.seguiments.forEach((s, i) => {
        html += `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0">
          <span>${s.canal || ''}${s.proper_pas ? ' — ' + s.proper_pas : (s.resum ? ' — ' + s.resum : '')}</span>
          <button class="btn btn-sm" onclick="importarNotaSeg('${id}',${i})">+ Afegir</button>
        </div>`;
      });
    }
    if (!parsed.oportunitats?.length && !parsed.seguiments?.length) {
      html += '<div>No s\'han detectat oportunitats ni seguiments clars.</div>';
    }
    html += '</div>';
    if (box) box.innerHTML = html;
  } catch (e) {
    if (box) box.innerHTML = `<div class="note-ia-result" style="color:var(--danger)">Error: ${e.message}</div>`;
  }
};

window.importarNotaOpp = async function(noteId, i) {
  const d = window['_notaIA_' + noteId];
  if (!d) return;
  const o = d.parsed.oportunitats[i];
  const cli = state.clients.find(c => c.id === d.clientId);
  try {
    await supabase.from('oportunitats').insert({
      client_id: d.clientId, empresa: cli?.empresa || cli?.nom, user_id: state.user.id,
      producte: o.producte, argument: o.argument, prioritat: o.prioritat, estat: 'Detectada'
    });
    await refreshData('oportunitats');
    updateNavBadges();
    toast('Oportunitat afegida');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

window.importarNotaSeg = async function(noteId, i) {
  const d = window['_notaIA_' + noteId];
  if (!d) return;
  const s = d.parsed.seguiments[i];
  try {
    await supabase.from('seguiments').insert({
      client_id: d.clientId, user_id: state.user.id,
      data: s.data || new Date().toISOString().slice(0, 10),
      canal: s.canal, resum: s.resum, proper_pas: s.proper_pas
    });
    await refreshData('seguiments');
    toast('Seguiment afegit');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

// Modal crear/editar nota (lligada a client)
window.openNotaModal = function(id) {
  const nota = id ? (state.notes || []).find(n => n.id === id) : null;
  const clientOptions = state.clients.map(c =>
    `<option value="${c.id}" ${nota && nota.client_id === c.id ? 'selected' : (state._clientObert === c.id ? 'selected' : '')}>${getClientNom(c)}</option>`
  ).join('');

  const html = `
    <div class="modal-title">${id ? 'Editar' : 'Nova'} nota</div>
    <div class="modal-sub">Sempre vinculada a un client</div>
    <div class="form-row"><label>Client *</label><select id="m-nota-client"><option value="">— selecciona —</option>${clientOptions}</select></div>
    <div class="form-row"><label>Títol (opcional)</label><input type="text" id="m-nota-titol" value="${nota?.titol || ''}"></div>
    <div class="form-row"><label>Contingut</label><textarea id="m-nota-contingut" style="min-height:140px" placeholder="Escriu aquí la nota. Després pots prémer 'Processar amb IA' per treure'n oportunitats.">${nota?.contingut || ''}</textarea></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel·lar</button>
      <button class="btn btn-primary" onclick="saveNota('${id || ''}')">Guardar</button>
    </div>
  `;
  document.getElementById('modal-container').innerHTML =
    `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
};

window.saveNota = async function(id) {
  const clientId = document.getElementById('m-nota-client').value;
  if (!clientId) { toast('Selecciona un client', 'error'); return; }
  const payload = {
    client_id: clientId,
    titol: document.getElementById('m-nota-titol').value.trim(),
    contingut: document.getElementById('m-nota-contingut').value.trim(),
    user_id: state.user.id
  };
  try {
    if (id) {
      await supabase.from('notes').update(payload).eq('id', id);
    } else {
      await supabase.from('notes').insert(payload);
    }
    closeModal();
    await refreshData('notes');
    updateNavBadges();
    renderNotes();
    toast('Nota guardada');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

// ------------------------------------------------------------------
// renderUsuaris — protegit contra state.user null
// ------------------------------------------------------------------
window.renderUsuaris = function() {
  const c = document.getElementById('tab-content');
  const meuId = state.user?.id;
  c.innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Usuaris</div><div class="page-sub">${state.mediadors.length} mediadors</div></div>
    </div>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="table">
        <thead><tr><th></th><th>Nom</th><th>Email</th><th>Rol</th><th>Actiu</th></tr></thead>
        <tbody>${state.mediadors.map(u => `
          <tr>
            <td>${renderUserAvatar(u.user_id, 'md')}</td>
            <td><strong>${u.nom || '—'}</strong></td>
            <td>${u.email}</td>
            <td>
              ${window.isAdmin() && u.user_id !== meuId ? `
                <select onchange="canviarRol('${u.user_id}',this.value)" style="font-size:11px;padding:3px 6px">
                  <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>admin</option>
                  <option value="mediador" ${u.rol === 'mediador' ? 'selected' : ''}>mediador</option>
                  <option value="lector" ${u.rol === 'lector' ? 'selected' : ''}>lector</option>
                </select>
              ` : `<span class="role-badge ${roleBadgeClass(u.rol)}">${escapeHtml(u.rol || 'lector')}</span>`}
            </td>
            <td>${u.actiu ? '✓' : '✗'}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
};

// ------------------------------------------------------------------
// BÚSTIA = IA ASSISTENT (11/06/2026)
// La pestanya 📥 Bústia mostrava un stub ("Mòdul disponible al següent
// sprint") perquè la taula inbox_items no la fa servir res encara.
// A la pràctica, la "bústia" de Brokkom és l'assistent IA: enganxar
// text → processar → importar. Fem que la pestanya obri directament
// aquesta funcionalitat. Aquesta línia s'executa l'última i guanya
// sobre l'stub de modules.js.
// ------------------------------------------------------------------
window.renderInbox = function() {
  window.renderIA();
};

console.log('✅ brokkom-patch.js carregat (IA + Notes + Bústia + fixes)');

// ==================================================================
// SECCIÓ FUSIONADA des de brokkom-patch2.js (Informes + Contactes de
// companyia + renderAsseguradores). Consolidat 24/06/2026.
// ==================================================================

// ==================================================================
// BROKKOM CRM · brokkom-patch2.js — 12/06/2026
// Es carrega DESPRÉS de brokkom-patch.js. NO toca cap altre fitxer.
//
// Afegeix:
//   1. Pestanya "Informes" — informe trimestral per a junta de socis
//      (mètriques, comparativa any anterior, gràfics, resum IA, PDF)
//   2. Contactes de companyia a Asseguradores (múltiples contactes)
//      Requereix la migració SQL 2026_06_12_contactes_cia.sql
// ==================================================================
console.log('🩹 brokkom-patch2.js carregant...');

// ------------------------------------------------------------------
// Helpers locals
// ------------------------------------------------------------------
function bk2Esc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function bk2Pct(actual, anterior) {
  if (!anterior) return null;
  return ((actual - anterior) / anterior) * 100;
}
function bk2Delta(actual, anterior, invers = false) {
  const p = bk2Pct(actual, anterior);
  if (p === null || !isFinite(p)) return '';
  const puja = p >= 0;
  const bo = invers ? !puja : puja;
  const fletxa = puja ? '▲' : '▼';
  const color = Math.abs(p) < 0.5 ? 'var(--text-3)' : (bo ? 'var(--success)' : 'var(--danger)');
  return `<span style="color:${color};font-size:11px;font-weight:600">${fletxa} ${Math.abs(p).toFixed(0)}%</span>`;
}

// ==================================================================
// 1) PESTANYA INFORMES
// ==================================================================

// Rang de dates d'un període
function bk2Rang(periode, any) {
  const r = {
    T1: [`${any}-01-01`, `${any}-03-31`],
    T2: [`${any}-04-01`, `${any}-06-30`],
    T3: [`${any}-07-01`, `${any}-09-30`],
    T4: [`${any}-10-01`, `${any}-12-31`],
    Y:  [`${any}-01-01`, `${any}-12-31`],
  };
  if (periode === 'YTD') return [`${any}-01-01`, new Date().toISOString().slice(0, 10)];
  return r[periode] || r.Y;
}
function bk2RangComparacio(periode, any, mode) {
  if (mode === 'none') return null;
  if (mode === 'yoy') return bk2Rang(periode, any - 1);
  // període anterior
  const ordre = ['T1', 'T2', 'T3', 'T4'];
  const i = ordre.indexOf(periode);
  if (i > 0) return bk2Rang(ordre[i - 1], any);
  if (i === 0) return bk2Rang('T4', any - 1);
  return bk2Rang(periode, any - 1); // YTD/Y → any anterior
}
function bk2EnRang(dataStr, rang) {
  if (!dataStr || !rang) return false;
  const d = String(dataStr).slice(0, 10);
  return d >= rang[0] && d <= rang[1];
}

// Calcula totes les mètriques d'un rang
function bk2Metriques(rang) {
  if (!rang) return null;
  const tanc = state.consolidats.filter(c => bk2EnRang(c.data_tancament, rang));
  const primaTotal = tanc.reduce((s, c) => s + (parseFloat(c.prima_anual) || 0), 0);
  const perdudes = state.ofertes.filter(o => o.estat === 'Tancada perduda' && bk2EnRang(o.updated_at || o.created_at, rang));
  const totalDecidides = tanc.length + perdudes.length;
  const nousClients = state.clients.filter(c => bk2EnRang(c.data_alta || c.created_at, rang));
  const seguiments = state.seguiments.filter(s => bk2EnRang(s.data, rang));
  const ofertesNoves = state.ofertes.filter(o => bk2EnRang(o.data_oferta || o.created_at, rang));

  const agrupa = (llista, camp, valor) => {
    const out = {};
    for (const item of llista) {
      const k = item[camp] || '—';
      if (!out[k]) out[k] = { n: 0, prima: 0 };
      out[k].n++;
      out[k].prima += parseFloat(item[valor]) || 0;
    }
    return Object.entries(out).sort((a, b) => b[1].prima - a[1].prima);
  };

  // Top clients per prima del període
  const perClient = agrupa(tanc, 'empresa', 'prima_anual').slice(0, 5);

  // Evolució mensual dins del rang
  const perMes = {};
  for (const c of tanc) {
    const k = String(c.data_tancament).slice(0, 7);
    if (!perMes[k]) perMes[k] = { n: 0, prima: 0 };
    perMes[k].n++;
    perMes[k].prima += parseFloat(c.prima_anual) || 0;
  }

  return {
    rang, tanc, primaTotal,
    primaMitjana: tanc.length ? primaTotal / tanc.length : 0,
    perdudes: perdudes.length,
    conversio: totalDecidides ? (tanc.length / totalDecidides) * 100 : null,
    nousClients: nousClients.length,
    seguiments: seguiments.length,
    ofertesNoves: ofertesNoves.length,
    perAsseguradora: agrupa(tanc, 'asseguradora', 'prima_anual'),
    perRam: agrupa(tanc, 'ram', 'prima_anual'),
    perMediador: agrupa(tanc, 'mediador', 'prima_anual'),
    topClients: perClient,
    perMes: Object.entries(perMes).sort(),
  };
}

window.renderInformes = function () {
  const c = document.getElementById('tab-content');
  const ara = new Date();
  const anyActual = ara.getFullYear();
  const triPerDefecte = 'T' + (Math.floor(ara.getMonth() / 3) + 1);
  const sel = window._bk2InformeSel || (window._bk2InformeSel = { periode: triPerDefecte, any: anyActual, vs: 'yoy' });

  // Anys disponibles segons les dades
  const anys = [...new Set(state.consolidats.map(x => String(x.data_tancament || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  if (!anys.includes(String(anyActual))) anys.unshift(String(anyActual));

  const m = bk2Metriques(bk2Rang(sel.periode, sel.any));
  const mc = bk2Metriques(bk2RangComparacio(sel.periode, sel.any, sel.vs));
  const nomPeriode = sel.periode === 'YTD' ? `Any en curs ${sel.any}` : sel.periode === 'Y' ? `Any ${sel.any}` : `${sel.periode} ${sel.any}`;
  const nomVs = sel.vs === 'yoy' ? 'vs mateix període any anterior' : sel.vs === 'prev' ? 'vs període anterior' : '';

  const barres = (llista, color) => {
    if (!llista.length) return '<div class="empty-state">Sense dades en aquest període</div>';
    const max = llista[0][1].prima || 1;
    return llista.map(([nom, d]) => `
      <div class="chart-bar">
        <div class="chart-label" title="${bk2Esc(nom)}">${bk2Esc(nom)}</div>
        <div class="chart-track"><div class="chart-fill" style="width:${(d.prima / max) * 100}%;background:${color}"></div></div>
        <div class="chart-value">${d.n} · ${fmtEur(d.prima)}</div>
      </div>`).join('');
  };

  const metrica = (label, valor, sub, delta) => `
    <div class="metric">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${valor} ${delta || ''}</div>
      ${sub ? `<div class="metric-sub">${sub}</div>` : ''}
    </div>`;

  c.innerHTML = `
    <div class="topbar bk2-noprint">
      <div>
        <div class="page-title">📈 Informe per a socis</div>
        <div class="page-sub">Síntesi del període per a la junta · comparatives · resum executiu IA</div>
      </div>
      <div class="topbar-actions">
        <button class="btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
        <button class="btn btn-primary" id="bk2-btn-ia" onclick="bk2GenerarResumIA()">🤖 Resum executiu IA</button>
      </div>
    </div>

    <div class="card bk2-noprint" style="margin-bottom:18px">
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
        <div class="form-row" style="margin:0;flex:1;min-width:150px">
          <label>Període</label>
          <select id="bk2-periode" onchange="bk2CanviSel()">
            ${['T1','T2','T3','T4','YTD','Y'].map(p => `<option value="${p}" ${sel.periode===p?'selected':''}>${p==='YTD'?'Any en curs':p==='Y'?'Any complet':p}</option>`).join('')}
          </select>
        </div>
        <div class="form-row" style="margin:0;flex:1;min-width:110px">
          <label>Any</label>
          <select id="bk2-any" onchange="bk2CanviSel()">
            ${anys.map(a => `<option value="${a}" ${String(sel.any)===a?'selected':''}>${a}</option>`).join('')}
          </select>
        </div>
        <div class="form-row" style="margin:0;flex:1;min-width:200px">
          <label>Comparar amb</label>
          <select id="bk2-vs" onchange="bk2CanviSel()">
            <option value="yoy" ${sel.vs==='yoy'?'selected':''}>Mateix període any anterior</option>
            <option value="prev" ${sel.vs==='prev'?'selected':''}>Període anterior</option>
            <option value="none" ${sel.vs==='none'?'selected':''}>Sense comparativa</option>
          </select>
        </div>
      </div>
    </div>

    <div class="bk2-print-head" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #1A3A6B;padding-bottom:8px;margin-bottom:18px">
        <div style="font-size:18px;font-weight:700;color:#1A3A6B">BROKKOM Correduria de Seguros</div>
        <div style="font-size:12px;color:#555">Informe comercial · ${bk2Esc(nomPeriode)} · generat ${ara.toLocaleDateString('ca-ES')}</div>
      </div>
    </div>

    <div class="section-title">${bk2Esc(nomPeriode)} ${mc ? '· ' + bk2Esc(nomVs) : ''}</div>
    <div class="metrics">
      ${metrica('Tancaments', m.tanc.length, mc ? `${mc.tanc.length} al període comparat` : '', mc ? bk2Delta(m.tanc.length, mc.tanc.length) : '')}
      ${metrica('Prima primada', fmtEur(m.primaTotal), mc ? `${fmtEur(mc.primaTotal)} comparat` : '', mc ? bk2Delta(m.primaTotal, mc.primaTotal) : '')}
      ${metrica('Prima mitjana', fmtEur(m.primaMitjana), '', mc ? bk2Delta(m.primaMitjana, mc.primaMitjana) : '')}
      ${metrica('Conversió', m.conversio === null ? '—' : Math.round(m.conversio) + '%', `${m.perdudes} perdudes`, (mc && mc.conversio !== null && m.conversio !== null) ? bk2Delta(m.conversio, mc.conversio) : '')}
      ${metrica('Clients nous', m.nousClients, '', mc ? bk2Delta(m.nousClients, mc.nousClients) : '')}
      ${metrica('Activitat', m.seguiments, `seguiments · ${m.ofertesNoves} ofertes noves`, mc ? bk2Delta(m.seguiments, mc.seguiments) : '')}
    </div>

    <div id="bk2-resum-ia" class="hidden" style="margin-bottom:20px">
      <div class="section-title">Resum executiu</div>
      <div class="card" id="bk2-resum-ia-text" style="line-height:1.75;font-size:13.5px;white-space:pre-wrap"></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div>
        <div class="section-title">Prima per asseguradora</div>
        <div class="card">${barres(m.perAsseguradora, 'var(--brand)')}</div>
      </div>
      <div>
        <div class="section-title">Prima per ram</div>
        <div class="card">${barres(m.perRam, '#574A9E')}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div>
        <div class="section-title">Evolució mensual del període</div>
        <div class="card">${m.perMes.length === 0 ? '<div class="empty-state">Sense dades</div>' : (() => {
          const max = Math.max(...m.perMes.map(x => x[1].prima)) || 1;
          return m.perMes.map(([mes, d]) => {
            const [y, mm] = mes.split('-');
            const label = new Date(+y, +mm - 1).toLocaleDateString('ca-ES', { month: 'short', year: '2-digit' });
            return `<div class="chart-bar">
              <div class="chart-label">${label}</div>
              <div class="chart-track"><div class="chart-fill" style="width:${(d.prima / max) * 100}%;background:var(--success)"></div></div>
              <div class="chart-value">${d.n} · ${fmtEur(d.prima)}</div>
            </div>`;
          }).join('');
        })()}</div>
      </div>
      <div>
        <div class="section-title">Top clients del període</div>
        <div class="card">${m.topClients.length === 0 ? '<div class="empty-state">Sense dades</div>' :
          m.topClients.map(([nom, d], i) => `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">
              <div><span style="color:var(--text-3);font-variant-numeric:tabular-nums">${i + 1}.</span> <strong>${bk2Esc(nom)}</strong></div>
              <div style="font-variant-numeric:tabular-nums;font-weight:600;color:var(--success)">${fmtEur(d.prima)}</div>
            </div>`).join('')}</div>
      </div>
    </div>

    ${m.perMediador.length > 1 ? `
    <div class="section-title">Per mediador</div>
    <div class="card" style="margin-bottom:20px">${barres(m.perMediador, '#2F62A8')}</div>` : ''}

    <div class="section-title">Detall de tancaments del període</div>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="table">
        <thead><tr><th>Data</th><th>Empresa</th><th>Ram</th><th>Asseguradora</th><th>Núm. pòlissa</th><th class="num">Prima</th></tr></thead>
        <tbody>${m.tanc.length === 0 ? '<tr><td colspan="6"><div class="empty-state">Cap tancament en aquest període</div></td></tr>' :
          [...m.tanc].sort((a, b) => String(b.data_tancament).localeCompare(String(a.data_tancament))).map(t => `
            <tr>
              <td>${fmtDate(t.data_tancament)}</td>
              <td><strong>${bk2Esc(t.empresa)}</strong></td>
              <td>${bk2Esc(t.ram) || '—'}</td>
              <td>${bk2Esc(t.asseguradora) || '—'}</td>
              <td style="font-family:ui-monospace,monospace;font-size:12px">${bk2Esc(t.num_polissa) || '—'}</td>
              <td class="num"><strong>${fmtEur(t.prima_anual)}</strong></td>
            </tr>`).join('')}</tbody>
      </table>
    </div>
  `;
};

window.bk2CanviSel = function () {
  window._bk2InformeSel = {
    periode: document.getElementById('bk2-periode').value,
    any: parseInt(document.getElementById('bk2-any').value, 10),
    vs: document.getElementById('bk2-vs').value,
  };
  renderInformes();
};

window.bk2GenerarResumIA = async function () {
  const sel = window._bk2InformeSel;
  const m = bk2Metriques(bk2Rang(sel.periode, sel.any));
  const mc = bk2Metriques(bk2RangComparacio(sel.periode, sel.any, sel.vs));
  const btn = document.getElementById('bk2-btn-ia');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Generant...';

  const dades = {
    periode: sel.periode, any: sel.any,
    tancaments: m.tanc.length, prima_total: Math.round(m.primaTotal),
    prima_mitjana: Math.round(m.primaMitjana), conversio_pct: m.conversio ? Math.round(m.conversio) : null,
    ofertes_perdudes: m.perdudes, clients_nous: m.nousClients,
    seguiments: m.seguiments, ofertes_noves: m.ofertesNoves,
    per_asseguradora: Object.fromEntries(m.perAsseguradora.map(([k, v]) => [k, Math.round(v.prima)])),
    per_ram: Object.fromEntries(m.perRam.map(([k, v]) => [k, Math.round(v.prima)])),
    top_clients: m.topClients.map(([k, v]) => ({ empresa: k, prima: Math.round(v.prima) })),
    comparativa: mc ? {
      tancaments: mc.tanc.length, prima_total: Math.round(mc.primaTotal),
      conversio_pct: mc.conversio ? Math.round(mc.conversio) : null,
      clients_nous: mc.nousClients, seguiments: mc.seguiments,
    } : null,
  };

  const prompt = `Ets l'analista comercial de Brokkom Correduria de Seguros (especialista en sector transport). Redacta el RESUM EXECUTIU de l'informe trimestral per a la junta de socis, en català, a partir d'aquestes dades:

${JSON.stringify(dades, null, 2)}

Requisits:
- 3 o 4 paràgrafs, to professional i directe, sense floritures
- Comença pel resultat principal del període (tancaments i prima)
- Si hi ha comparativa, destaca les variacions rellevants en % i el perquè probable
- Comenta concentració de cartera (dependència d'asseguradores o de pocs clients) si és visible
- Acaba amb 2-3 recomanacions accionables per al proper període
- NOMÉS el text, sense títols ni markdown`;

  try {
    const response = await window.apiCallWithRetry('/api/ai-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: state.config?.model_smart || 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await response.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    document.getElementById('bk2-resum-ia-text').textContent = text || 'La IA no ha retornat text.';
    document.getElementById('bk2-resum-ia').classList.remove('hidden');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 Resum executiu IA';
  }
};

// --- Estils d'impressió per a l'informe en PDF ---
// (El nav d'Informes és estàtic a index.html i el routing el fa app.js,
//  per això ja no cal injectar el menú ni embolcallar renderCurrentTab.)
(function bk2PrintStyles() {
  const style = document.createElement('style');
  style.textContent = `@media print {
    .bk2-noprint { display: none !important; }
    .bk2-print-head { display: block !important; }
  }`;
  document.head.appendChild(style);
})();

// ==================================================================
// 2) CONTACTES DE COMPANYIA (asseguradores.contactes jsonb)
// ==================================================================

window.renderAsseguradores = function () {
  const c = document.getElementById('tab-content');
  c.innerHTML = `
    <div class="topbar">
      <div><div class="page-title">Asseguradores</div><div class="page-sub">Catàleg Brokkom · contactes de companyia</div></div>
      ${window.isAdmin() ? '<div class="topbar-actions"><button class="btn btn-primary" onclick="openModal(\'asseguradora\')">+ Nova</button></div>' : ''}
    </div>
    ${state.asseguradores.length === 0 ? '<div class="card"><div class="empty-state">Cap asseguradora</div></div>' :
      state.asseguradores.map(a => {
        const contactes = Array.isArray(a.contactes) ? a.contactes : [];
        return `
        <div class="card">
          <div class="card-row">
            <div>
              <div class="card-title">${bk2Esc(a.nom)}</div>
              ${a.contacte_intern ? `<div class="card-sub">${bk2Esc(a.contacte_intern)}${a.email ? ' · ' + bk2Esc(a.email) : ''}${a.telefon ? ' · ' + bk2Esc(a.telefon) : ''}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px">
              ${window.isAdmin() ? `<button class="btn btn-sm" onclick="bk2ObreContacte('${a.id}')">+ Contacte</button>
              <button class="btn btn-sm" onclick="deleteRecord('asseguradores','${a.id}')" style="color:var(--danger)">🗑</button>` : ''}
            </div>
          </div>
          ${(a.rams || []).length > 0 ? `<div style="margin-top:8px">${(a.rams || []).map(r => `<span class="pill p-info" style="margin-right:4px">${bk2Esc(r)}</span>`).join('')}</div>` : ''}
          ${contactes.length > 0 ? `
            <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
              <div class="section-title" style="margin-bottom:6px">Contactes</div>
              ${contactes.map((ct, i) => `
                <div style="display:flex;align-items:baseline;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12.5px">
                  <div style="flex:1;min-width:0">
                    <strong>${bk2Esc(ct.nom)}</strong>${ct.carrec ? ` <span style="color:var(--text-3)">· ${bk2Esc(ct.carrec)}</span>` : ''}
                    <div style="font-size:11.5px;color:var(--text-2)">
                      ${ct.email ? `<a href="mailto:${bk2Esc(ct.email)}" style="color:var(--brand);text-decoration:none">${bk2Esc(ct.email)}</a>` : ''}
                      ${ct.email && ct.telefon ? ' · ' : ''}
                      ${ct.telefon ? `<a href="tel:${bk2Esc(ct.telefon)}" style="color:var(--brand);text-decoration:none">${bk2Esc(ct.telefon)}</a>` : ''}
                    </div>
                    ${ct.notes ? `<div style="font-size:11.5px;color:var(--text-3);margin-top:2px">${bk2Esc(ct.notes)}</div>` : ''}
                  </div>
                  ${window.isAdmin() ? `
                  <button class="btn btn-sm" onclick="bk2ObreContacte('${a.id}', ${i})">✏️</button>
                  <button class="btn btn-sm" onclick="bk2EsborraContacte('${a.id}', ${i})" style="color:var(--danger)">🗑</button>` : ''}
                </div>`).join('')}
            </div>` : ''}
          ${a.notes ? `<div style="margin-top:8px;font-size:12px;color:var(--text-2)">${bk2Esc(a.notes)}</div>` : ''}
        </div>`;
      }).join('')
    }
  `;
};

window.bk2ObreContacte = function (assegId, idx) {
  const a = state.asseguradores.find(x => x.id === assegId);
  if (!a) return;
  const ct = (idx !== undefined && Array.isArray(a.contactes)) ? (a.contactes[idx] || {}) : {};
  const html = `
    <div class="modal-title">${idx !== undefined ? 'Editar' : 'Nou'} contacte — ${bk2Esc(a.nom)}</div>
    <div class="modal-sub">Persona de referència dins de la companyia</div>
    <div class="form-grid">
      <div class="form-row"><label>Nom *</label><input type="text" id="bk2-ct-nom" value="${bk2Esc(ct.nom) || ''}"></div>
      <div class="form-row"><label>Càrrec / departament</label><input type="text" id="bk2-ct-carrec" value="${bk2Esc(ct.carrec) || ''}" placeholder="Suscripció flotes, sinistres, comercial..."></div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Email</label><input type="email" id="bk2-ct-email" value="${bk2Esc(ct.email) || ''}"></div>
      <div class="form-row"><label>Telèfon</label><input type="tel" id="bk2-ct-telefon" value="${bk2Esc(ct.telefon) || ''}"></div>
    </div>
    <div class="form-row"><label>Notes</label><textarea id="bk2-ct-notes" placeholder="Horari, particularitats, com tractar-hi...">${bk2Esc(ct.notes) || ''}</textarea></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel·lar</button>
      <button class="btn btn-primary" onclick="bk2GuardaContacte('${assegId}', ${idx !== undefined ? idx : 'null'})">Guardar</button>
    </div>`;
  document.getElementById('modal-container').innerHTML =
    `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
};

window.bk2GuardaContacte = async function (assegId, idx) {
  const a = state.asseguradores.find(x => x.id === assegId);
  if (!a) return;
  const nom = document.getElementById('bk2-ct-nom').value.trim();
  if (!nom) { toast('El nom és obligatori', 'error'); return; }
  const ct = {
    nom,
    carrec: document.getElementById('bk2-ct-carrec').value.trim(),
    email: document.getElementById('bk2-ct-email').value.trim(),
    telefon: document.getElementById('bk2-ct-telefon').value.trim(),
    notes: document.getElementById('bk2-ct-notes').value.trim(),
  };
  const contactes = Array.isArray(a.contactes) ? [...a.contactes] : [];
  if (idx === null || idx === undefined) contactes.push(ct); else contactes[idx] = ct;
  const { error } = await window.supabase.from('asseguradores').update({ contactes }).eq('id', assegId);
  if (error) {
    const msg = /contactes/.test(error.message) ?
      'Falta executar la migració SQL dels contactes (2026_06_12_contactes_cia.sql) a Supabase.' : error.message;
    toast(msg, 'error');
    return;
  }
  a.contactes = contactes;
  closeModal();
  renderAsseguradores();
  toast('Contacte guardat');
};

window.bk2EsborraContacte = async function (assegId, idx) {
  if (!confirm('Esborrar aquest contacte?')) return;
  const a = state.asseguradores.find(x => x.id === assegId);
  if (!a || !Array.isArray(a.contactes)) return;
  const contactes = a.contactes.filter((_, i) => i !== idx);
  const { error } = await window.supabase.from('asseguradores').update({ contactes }).eq('id', assegId);
  if (error) { toast(error.message, 'error'); return; }
  a.contactes = contactes;
  renderAsseguradores();
  toast('Contacte esborrat');
};

console.log('✅ brokkom-patch2.js carregat — Informes + Contactes de cia');
