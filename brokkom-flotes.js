/* =====================================================================
 * BROKKOM CRM · Mòdul FLOTES
 * Port fidel de l'eina autònoma de flotes, adaptada al CRM:
 *  - Persistència a Supabase (taules flotes / flota_vehicles /
 *    flota_sinistres / flota_ofertes / flota_tasques) en lloc de localStorage.
 *  - Cada flota es lliga a un client del CRM (es crea si no existeix).
 *  - Tot encapsulat dins un IIFE i scoped a #flotes-root + window.FL
 *    perquè no col·lisioni amb la resta del CRM.
 *
 * Els CÀLCULS (tarificador DP, sinistralitat, semàfor de risc, ràtios,
 * informes) són idèntics a l'eina original.
 * ===================================================================== */
(function () {
  'use strict';

  // ---- estat ----
  let FLEETS = [];
  let CUR = null, TAB = 'dash', INCL_DP = false;
  let DASH_SORT = { k: 'prima', dir: -1 };
  let _loaded = false;

  const GARANTIES = [['rc', 'RC (oblig.+volunt.)'], ['danys', 'Danys propis'], ['llunes', 'Llunes'], ['assist', 'Assistència'], ['defensa', 'Defensa jurídica'], ['robatori', 'Robatori']];
  const COB_LABEL = { 'R.C.': 'RC', 'LUNAS': 'Llunes', 'ASISTENCIA': 'Assistència', 'CICOS DEUDOR': 'CICOS deutor (culpa)', 'CICOS ACREEDOR': 'CICOS creditor (tercer)', 'RECLAMACION DAÑOS': 'Reclamació danys', 'SIN CLASIFICAR': 'Sense classificar', 'DAÑOS PROPIOS': 'Danys propis' };
  const ESTATS = [['dades', 'Recopilant dades'], ['mercat', 'Al mercat'], ['oferta', 'Oferta enviada'], ['negociacio', 'En negociació'], ['tancada', 'Tancada']];

  // ---- helpers de format (idèntics a l'original) ----
  const fmt = n => new Intl.NumberFormat('ca-ES').format(Math.round(n || 0));
  const eur = n => (n === null || n === undefined || isNaN(n)) ? '—' : fmt(n) + '€';
  const fmtDate = d => d ? new Date(d).toLocaleDateString('ca-ES') : '—';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fleet = () => FLEETS.find(f => f.id === CUR);
  const daysLeft = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
  const sinisF = f => f.sinis.filter(s => INCL_DP ? true : !s.dp);

  // ---- tarificador DP (idèntic) ----
  function primaDP(f, v) { if (v.prima_dp_ov != null) return v.prima_dp_ov; if (!v.valor) return null; return Math.max(f.min_dp || 0, v.valor * (f.tasa_dp || 0) / 100); }
  function primaTot(f, v) { return (v.prima_rc || 0) + (primaDP(f, v) || 0); }
  const parcSum = f => f.parc.reduce((s, v) => s + primaTot(f, v), 0);
  const primaGlobal = f => f.prima_global_override ?? parcSum(f);
  function agg(f) { const a = sinisF(f); const total = a.reduce((s, x) => s + x.imp, 0); const ob = a.filter(x => x.estado === 'Abierto'); const per = [...new Set(a.map(x => x.per))].filter(Boolean); return { n: a.length, total, oberts: ob.length, obertsImp: ob.reduce((s, x) => s + x.imp, 0), nPer: per.length || 1, costAnual: total / (per.length || 1) }; }
  function vehAnnual(mat) { const f = fleet(); const v = (f.veh || []).find(x => x.mat === mat); if (!v) return 0; return v.total / (v.periodos || 1); }
  function computeVeh(sinis) { const m = {}; sinis.forEach(s => { if (!s.mat) return; m[s.mat] = m[s.mat] || { mat: s.mat, n: 0, total: 0, abiertos: 0, pers: new Set() }; const v = m[s.mat]; v.n++; v.total += s.imp; if (s.estado === 'Abierto') v.abiertos++; if (s.per) v.pers.add(s.per); }); return Object.values(m).map(v => { const periodos = v.pers.size || 1; const media = v.total / v.n; const riesgo = (v.total > 5000 || v.n >= 5) ? 'ALTO' : (v.total > 1500 || v.n >= 2) ? 'MEDIO' : 'BAJO'; return { mat: v.mat, n: v.n, total: Math.round(v.total), media: Math.round(media), abiertos: v.abiertos, periodos, riesgo }; }); }

  // =====================================================================
  // PERSISTÈNCIA SUPABASE
  // =====================================================================
  const sb = () => window.supabase;
  const usr = () => (window.state && window.state.user && window.state.user.id) || null;
  const numOrNull = v => { if (v === '' || v === null || v === undefined) return null; const n = parseFloat(v); return isNaN(n) ? null : n; };
  const dateOrNull = v => (v && String(v).trim()) ? v : null;
  function toastErr(msg) { try { if (typeof window.toast === 'function') return window.toast(msg, 'error'); } catch (e) {} console.error(msg); }

  // mappers in-memory -> fila DB
  const flotaCols = f => ({ empresa: f.empresa || null, asseguradora_actual: f.asseguradora_actual || null, prima_global_override: numOrNull(f.prima_global_override), ambit: f.ambit || null, adr: !!f.adr, venciment: dateOrNull(f.venciment), tasa_dp: numOrNull(f.tasa_dp), min_dp: numOrNull(f.min_dp), comprum: !!f.comprum, estat: f.estat || 'dades', sini_anual_manual: numOrNull(f.sini_anual_manual), documents: Array.isArray(f.documents) ? f.documents : [], frigorific: !!f.frigorific, n_conductors: numOrNull(f.n_conductors), internacional: !!f.internacional, naus: !!f.naus });

  // llista estàndard de documents per a una renovació de flota
  function defaultDocs() {
    return [
      'Pòlissa actual + condicionat',
      'Últim rebut (prima global i per vehicle)',
      'Parc actualitzat (matrícula, tipus, valor, venciment)',
      'Loss run / sinistralitat (3–5 anys)',
      'Moviments previstos (altes i baixes)',
      'Fitxa d\'activitat (àmbit · ADR · frigorífic · conductors)',
      'CIF / dades fiscals',
      'Targetes de transport / autoritzacions',
      'Certificat ADR (si transport de mercaderies perilloses)',
      'Relació de conductors'
    ].map(n => ({ id: uid(), nom: n, estat: 'pendent', data: null, nota: '' }));
  }
  const vehicleRow = (f, v) => ({ flota_id: f.id, user_id: usr(), mat: v.mat || '', tipus: v.tipus || null, model: v.model || null, valor: numOrNull(v.valor), venciment: dateOrNull(v.venciment), prima_rc: numOrNull(v.prima_rc), prima_dp_ov: numOrNull(v.prima_dp_ov) });
  const sinisRow = (f, s) => ({ flota_id: f.id, user_id: usr(), num: s.n || null, mat: s.mat || null, causa: s.causa || null, tipo: s.tipo || null, estado: s.estado || null, f_sin: dateOrNull(s.f_sin), imp: numOrNull(s.imp) || 0, periode: s.per || null, dp: !!s.dp });
  const ofertaRow = (f, o) => ({ flota_id: f.id, user_id: usr(), cia: o.cia || null, comprum: !!o.comprum, prima: numOrNull(o.prima), garanties: o.g || {}, franquicia: numOrNull(o.franquicia), comissio: numOrNull(o.comissio), pros: o.pros || null, contres: o.contres || null, presentar: o.presentar !== false });
  const tascaRow = (f, p) => ({ flota_id: f.id, user_id: usr(), text: p.text || null, bloqueja: p.bloqueja || null, data: dateOrNull(p.data), estat: p.estat || 'obert', subtasks: p.subtasks || [] });

  function snapshot(f) {
    f._snap = {
      flota: JSON.stringify(flotaCols(f)),
      parc: JSON.stringify(f.parc),
      sinis: JSON.stringify(f.sinis),
      ofertes: JSON.stringify(f.ofertes),
      pendents: JSON.stringify(f.pendents)
    };
  }

  async function syncChild(f, table, arrName, mapper, force) {
    const cur = JSON.stringify(f[arrName]);
    if (!force && cur === f._snap[arrName]) return;
    let res = await sb().from(table).delete().eq('flota_id', f.id);
    if (res.error) throw res.error;
    const rows = (f[arrName] || []).map(x => mapper(f, x));
    if (rows.length) { res = await sb().from(table).insert(rows); if (res.error) throw res.error; }
    f._snap[arrName] = cur;
  }

  async function syncFleet(f) {
    if (!f || !f.id) return;
    const flotaJSON = JSON.stringify(flotaCols(f));
    if (flotaJSON !== f._snap.flota) {
      const res = await sb().from('flotes').update(flotaCols(f)).eq('id', f.id);
      if (res.error) throw res.error;
      f._snap.flota = flotaJSON;
    }
    await syncChild(f, 'flota_vehicles', 'parc', vehicleRow);
    await syncChild(f, 'flota_sinistres', 'sinis', sinisRow);
    await syncChild(f, 'flota_ofertes', 'ofertes', ofertaRow);
    await syncChild(f, 'flota_tasques', 'pendents', tascaRow);
  }

  // desat debounced (la UI no s'espera; la sincronització va en segon pla)
  let _saveTimer = null;
  const _saveQueue = new Set();
  function save() { const f = fleet(); if (!f || !f.id) return; _saveQueue.add(f.id); flashSoon(); clearTimeout(_saveTimer); _saveTimer = setTimeout(flushSaves, 600); }
  async function flushSaves() {
    const ids = [..._saveQueue]; _saveQueue.clear();
    for (const id of ids) {
      const f = FLEETS.find(x => x.id === id);
      if (!f) continue;
      try { await syncFleet(f); flashOk(); }
      catch (e) { toastErr('Error desant la flota: ' + (e.message || e)); }
    }
  }

  function flashSoon() { const el = document.getElementById('fl-saved'); if (el) { el.textContent = 'desant…'; el.classList.add('show'); } }
  function flashOk() { const el = document.getElementById('fl-saved'); if (!el) return; el.textContent = '✓ desat'; el.classList.add('show'); clearTimeout(window._flst); window._flst = setTimeout(() => el.classList.remove('show'), 1200); }
  const flash = flashOk;

  async function loadFlotesFromDB() {
    const q = t => sb().from(t).select('*');
    const [r1, r2, r3, r4, r5] = await Promise.all([q('flotes'), q('flota_vehicles'), q('flota_sinistres'), q('flota_ofertes'), q('flota_tasques')]);
    for (const r of [r1, r2, r3, r4, r5]) if (r.error) throw r.error;
    const veh = r2.data || [], sin = r3.data || [], ofe = r4.data || [], tas = r5.data || [];
    FLEETS = (r1.data || []).map(fl => {
      const parc = veh.filter(v => v.flota_id === fl.id).map(v => ({ mat: v.mat, tipus: v.tipus || 'Tractora/Camió', model: v.model || '', valor: v.valor, venciment: v.venciment, prima_rc: v.prima_rc, prima_dp_ov: v.prima_dp_ov }));
      const sinis = sin.filter(s => s.flota_id === fl.id).map(s => ({ n: s.num, mat: s.mat, causa: s.causa, tipo: s.tipo, estado: s.estado, f_sin: s.f_sin, imp: s.imp || 0, per: s.periode, dp: !!s.dp }));
      const ofertes = ofe.filter(o => o.flota_id === fl.id).map(o => ({ id: o.id, cia: o.cia, comprum: !!o.comprum, prima: o.prima, g: Object.assign({ rc: 1, danys: 0, llunes: 0, assist: 0, defensa: 0, robatori: 0 }, o.garanties || {}), franquicia: o.franquicia, comissio: o.comissio, pros: o.pros || '', contres: o.contres || '', presentar: o.presentar !== false }));
      const pendents = tas.filter(t => t.flota_id === fl.id).map(t => ({ id: t.id, text: t.text, bloqueja: t.bloqueja, data: t.data, estat: t.estat || 'obert', subtasks: Array.isArray(t.subtasks) ? t.subtasks : [] }));
      const f = { id: fl.id, client_id: fl.client_id, empresa: fl.empresa || '(flota)', cif: '', asseguradora_actual: fl.asseguradora_actual || '', prima_global_override: fl.prima_global_override, ambit: fl.ambit || 'Nacional', adr: !!fl.adr, venciment: fl.venciment, tasa_dp: fl.tasa_dp ?? 4, min_dp: fl.min_dp ?? 150, comprum: !!fl.comprum, estat: fl.estat || 'dades', sini_anual_manual: fl.sini_anual_manual, documents: (Array.isArray(fl.documents) && fl.documents.length) ? fl.documents : defaultDocs(), frigorific: !!fl.frigorific, n_conductors: fl.n_conductors, internacional: !!fl.internacional, naus: !!fl.naus, parc, sinis, veh: [], ofertes, pendents };
      f.veh = computeVeh(sinis);
      snapshot(f);
      return f;
    });
    if (!FLEETS.find(f => f.id === CUR)) CUR = FLEETS[0] ? FLEETS[0].id : null;
  }

  // crea client (si cal) + flota a Supabase
  async function ensureClient(nom, existingId) {
    if (existingId) return existingId;
    if (typeof window._patchTrobaOCreaClient === 'function') {
      const id = await window._patchTrobaOCreaClient(nom);
      if (id) return id;
    }
    try {
      const { data, error } = await sb().from('clients').insert({ empresa: nom, tipus: 'empresa', user_id: usr() }).select().single();
      if (error) throw error;
      if (window.state && Array.isArray(window.state.clients)) window.state.clients.push(data);
      return data.id;
    } catch (e) { toastErr('No s\'ha pogut crear el client: ' + (e.message || e)); return null; }
  }

  async function dbInsertFlotaDeep(f) {
    const clientId = await ensureClient(f.empresa, f.client_id);
    const { data: fl, error } = await sb().from('flotes').insert({ ...flotaCols(f), client_id: clientId, user_id: usr() }).select().single();
    if (error) throw error;
    f.id = fl.id; f.client_id = clientId;
    const childs = [['flota_vehicles', 'parc', vehicleRow], ['flota_sinistres', 'sinis', sinisRow], ['flota_ofertes', 'ofertes', ofertaRow], ['flota_tasques', 'pendents', tascaRow]];
    for (const [table, arr, mapper] of childs) {
      const rows = (f[arr] || []).map(x => mapper(f, x));
      if (rows.length) { const res = await sb().from(table).insert(rows); if (res.error) throw res.error; }
    }
    snapshot(f);
  }

  async function novaFlota() {
    const nom = prompt('Nom de la nova empresa/flota:'); if (!nom) return;
    const clientId = await ensureClient(nom, null);
    const f = { id: null, client_id: clientId, empresa: nom, cif: '', asseguradora_actual: '', prima_global_override: null, ambit: 'Nacional', adr: false, venciment: '2026-12-31', tasa_dp: 4, min_dp: 150, comprum: false, estat: 'dades', sini_anual_manual: null, documents: defaultDocs(), frigorific: false, n_conductors: null, internacional: false, naus: false, parc: [], sinis: [], veh: [], ofertes: [], pendents: [] };
    try {
      const { data: fl, error } = await sb().from('flotes').insert({ ...flotaCols(f), client_id: clientId, user_id: usr() }).select().single();
      if (error) throw error;
      f.id = fl.id;
    } catch (e) { alert('Error creant la flota: ' + (e.message || e)); return; }
    snapshot(f); FLEETS.push(f); CUR = f.id; TAB = 'parc'; render();
  }

  function normalizeFleet(f) { f.parc = f.parc || []; f.sinis = f.sinis || []; f.ofertes = f.ofertes || []; f.pendents = f.pendents || []; f.veh = f.veh || []; if (!Array.isArray(f.documents)) f.documents = []; f.ofertes.forEach(o => { if (o.pros == null) o.pros = ''; if (o.contres == null) o.contres = ''; if (o.presentar == null) o.presentar = true; if (!o.g) o.g = { rc: 1, danys: 0, llunes: 0, assist: 0, defensa: 0, robatori: 0 }; }); f.pendents.forEach(p => { if (!p.subtasks) p.subtasks = []; }); }

  // =====================================================================
  // RENDER (entrada des del CRM) + subnav
  // =====================================================================
  async function renderFlotesTab() {
    const c = document.getElementById('tab-content'); if (!c) return;
    injectCSS();
    c.innerHTML = `<div id="flotes-root"><div class="wrap">
      <div class="topbar">
        <div><div class="page-title">🚛 Flotes <span class="saved" id="fl-saved">✓ desat</span></div>
          <div class="page-sub">Eina interna · tarificador DP · importació · informes client/CIA · tasques</div></div>
        <div class="topbar-actions">
          <div class="flota-select"><select id="fl-fleetSel" onchange="FL.selFleet(this.value)"></select></div>
          <button class="btn btn-sm" onclick="FL.novaFlota()">+ Flota</button>
          <button class="btn btn-sm" onclick="FL.exportJSON()">⬇ Backup</button>
          <button class="btn btn-sm" onclick="document.getElementById('fl-imp').click()">⬆ Restaurar</button>
          <input type="file" id="fl-imp" accept=".json" style="display:none" onchange="FL.importJSON(event)">
        </div></div>
      <div class="subnav" id="fl-subnav"></div><div id="fl-view"><div class="empty">Carregant flotes…</div></div>
    </div></div>`;
    if (!_loaded) {
      try { await loadFlotesFromDB(); _loaded = true; }
      catch (e) { const v = document.getElementById('fl-view'); if (v) v.innerHTML = `<div class="card"><div class="empty">Error carregant les flotes: ${(e.message || e)}<br><span class="mini">Comprova que has executat l'SQL de flotes a Supabase.</span></div></div>`; return; }
    }
    if (!FLEETS.length) {
      const sel = document.getElementById('fl-fleetSel'); if (sel) sel.innerHTML = '';
      document.getElementById('fl-subnav').innerHTML = '';
      document.getElementById('fl-view').innerHTML = `<div class="card"><div class="empty">Encara no hi ha cap flota.<br><br><button class="btn btn-primary" onclick="FL.novaFlota()">+ Crear la primera flota</button></div></div>`;
      return;
    }
    if (!FLEETS.find(f => f.id === CUR)) CUR = FLEETS[0].id;
    render();
  }

  function renderSubnav() { const t = [['dash', '📊 Dashboard'], ['resum', 'Resum flota'], ['doc', '📁 Documentació'], ['parc', 'Parc & primes'], ['sini', 'Sinistralitat'], ['ofertes', 'Ofertes & Comparativa'], ['matriu', '🎯 Venda creuada'], ['plant', 'Plantilles & informes'], ['pend', 'Tasques']]; const el = document.getElementById('fl-subnav'); if (el) el.innerHTML = t.map(([k, l]) => `<button class="${TAB === k ? 'active' : ''}" onclick="FL.setTab('${k}')">${l}</button>`).join(''); }
  function setTab(t) { TAB = t; render(); }
  function setInclDP(v) { INCL_DP = v; render(); }
  function selFleet(id) { CUR = id; render(); }
  function fillSel() { const el = document.getElementById('fl-fleetSel'); if (el) el.innerHTML = FLEETS.map(f => `<option value="${f.id}" ${f.id === CUR ? 'selected' : ''}>${f.empresa} · ${f.parc.length} veh.</option>`).join(''); }
  function render() { if (!FLEETS.length || !fleet()) return; fillSel(); renderSubnav(); const v = document.getElementById('fl-view'); if (v) v.innerHTML = ({ dash: vDash, resum: vResum, doc: vDoc, parc: vParc, sini: vSini, ofertes: vOfertes, matriu: vMatriu, plant: vPlant, pend: vPend }[TAB] || vResum)(); }

  // =====================================================================
  // VISTES (idèntiques a l'original; handlers inline -> FL.*)
  // =====================================================================
  function vResum() {
    const f = fleet(), a = agg(f), dl = daysLeft(f.venciment); const dpTotal = f.sinis.filter(s => s.dp).reduce((s, x) => s + x.imp, 0); const pg = primaGlobal(f), ratio = pg ? Math.round(a.costAnual / pg * 100) : null;
    return `<div class="metrics">
      <div class="metric"><div class="metric-label">Vehicles</div><div class="metric-value">${f.parc.length}</div><div class="metric-sub">al parc</div></div>
      <div class="metric"><div class="metric-label">Prima global</div><div class="metric-value">${eur(pg)}</div><div class="metric-sub">${eur(pg / (f.parc.length || 1))}/vehicle</div></div>
      <div class="metric"><div class="metric-label">Sinistralitat</div><div class="metric-value">${eur(a.total)}</div><div class="metric-sub">${a.n} sin. ${INCL_DP ? '(amb DP)' : '(sense DP)'}</div></div>
      <div class="metric"><div class="metric-label">Ràtio global</div><div class="metric-value" style="color:${ratio > 85 ? 'var(--danger)' : ratio > 70 ? 'var(--warning)' : ratio ? 'var(--success)' : 'var(--text-3)'}">${ratio != null ? ratio + '%' : '—'}</div><div class="metric-sub">cost mitjà / prima</div></div>
      <div class="metric"><div class="metric-label">Venciment</div><div class="metric-value" style="font-size:18px">${fmtDate(f.venciment)}</div><div class="metric-sub" style="color:${dl < 90 ? 'var(--danger)' : 'var(--text-3)'}">${dl != null ? dl + ' dies' : '—'}</div></div>
      <div class="metric"><div class="metric-label">Oberts</div><div class="metric-value" style="color:${a.oberts ? 'var(--warning)' : 'var(--text)'}">${a.oberts}</div><div class="metric-sub">${eur(a.obertsImp)} reserva</div></div></div>
    <div class="toggle-row"><label class="switch"><input type="checkbox" ${INCL_DP ? 'checked' : ''} onchange="FL.setInclDP(this.checked)"><span class="slider"></span></label>Incloure danys propis (${eur(dpTotal)})</div>
    <div class="card"><div class="section-title">Burning cost · prima tècnica</div><div class="bcost">
      <div class="bcost-item"><div class="v">${eur(a.costAnual)}</div><div class="l">Cost mitjà anual</div></div><div>→</div>
      <div class="bcost-item"><div class="v" style="color:var(--brand)">${eur(a.costAnual / 0.70)}</div><div class="l">Prima tècnica (70%)</div></div>
      <div class="bcost-item"><div class="v" style="color:var(--text-2)">${eur(a.costAnual / 0.60)}</div><div class="l">Conservador (60%)</div></div></div></div>
    <div class="note warn">⚠ <b>Concentració:</b> venç ${fmtDate(f.venciment)}. Cohort 31/12 — treballa en compte enrere des de T-120.</div>
    <div class="grid2"><div class="card"><div class="section-title">Dades de la flota</div><table class="table"><tbody>
      <tr><td>Empresa</td><td class="num"><b>${f.empresa}</b></td></tr>
      <tr><td>Asseguradora actual</td><td class="num"><input value="${f.asseguradora_actual || ''}" placeholder="—" onchange="FL.setF('asseguradora_actual',this.value)"></td></tr>
      <tr><td>Prima global (override)</td><td class="num"><input type="number" value="${f.prima_global_override ?? ''}" placeholder="suma: ${fmt(parcSum(f))}" oninput="FL.setFG(this.value)"></td></tr>
      </tbody></table><div class="mini" id="reconcile">${reconcileTxt(f)}</div></div>
    <div class="card"><div class="section-title">Top vehicles per cost</div>${topVeh(f, 6)}</div></div>
    ${renewalChecklist(f)}
    <div class="grid2"><div class="card"><div class="section-title">Tasques d'aquesta flota</div>${fleetTasksMini(f)}</div><div class="card"><div class="section-title">Ofertes</div>${offersMini(f)}</div></div>`;
  }
  function reconcileTxt(f) { if (f.prima_global_override == null) return 'Prima global = suma per vehicle (' + eur(parcSum(f)) + ').'; const d = f.prima_global_override - parcSum(f); if (Math.abs(d) < 1) return 'Override = suma per vehicle ✓'; return `⚠ Override ≠ suma per vehicle · diferència ${eur(Math.abs(d))} ${d > 0 ? '(descompte flota/taxes)' : '(revisar)'}.`; }
  function topVeh(f, k) { const t = [...f.veh].sort((a, b) => b.total - a.total).slice(0, k); const mx = t[0]?.total || 1; return t.map(v => `<div class="chart-bar"><div class="chart-label" style="font-family:monospace">${v.mat} ${riskPill(v.riesgo)}</div><div class="chart-track"><div class="chart-fill" style="width:${v.total / mx * 100}%;background:${v.riesgo === 'ALTO' ? 'var(--danger)' : v.riesgo === 'MEDIO' ? 'var(--warning)' : 'var(--brand)'}"></div></div><div class="chart-value">${eur(v.total)} · ${v.n} sin.</div></div>`).join(''); }
  function riskPill(r) { const m = { ALTO: 'p-danger', MEDIO: 'p-warning', BAJO: 'p-gray' }; return `<span class="pill ${m[r] || 'p-gray'}">${r}</span>`; }

  // ===== DOCUMENTACIÓ (checklist què tenim / què falta) =====
  function vDoc() {
    const f = fleet(); const docs = f.documents || [];
    const na = docs.filter(d => d.estat === 'na').length;
    const rebut = docs.filter(d => d.estat === 'rebut').length;
    const base = docs.length - na;
    const pct = base ? Math.round(rebut / base * 100) : 0;
    const col = pct === 100 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
    const pendents = docs.filter(d => d.estat === 'pendent');
    return `<div class="note">Control de <b>què tenim / què falta</b> per sortir al mercat. Marca cada document com a <b>rebut</b>, <b>pendent</b> o <b>no aplica</b>. La barra compta només sobre els que apliquen.</div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="section-title" style="margin:0">Documentació rebuda</div>
        <b style="font-size:15px;color:${col}">${rebut}/${base} · ${pct}%</b>
      </div>
      <div class="chart-track" style="height:10px"><div class="chart-fill" style="width:${pct}%;background:${col}"></div></div>
      ${pendents.length ? `<div class="mini" style="margin-top:10px"><b>Falten:</b> ${pendents.map(d => d.nom).join(' · ')}</div>` : '<div class="mini" style="margin-top:10px;color:var(--success)">Tot rebut ✓ — a punt per sortir al mercat.</div>'}
    </div>
    <div class="card" style="padding:0;overflow-x:auto"><table class="table">
      <thead><tr><th>Document / dada</th><th>Estat</th><th>Data</th><th>Nota</th><th></th></tr></thead>
      <tbody>${docs.map((d, i) => docRow(d, i)).join('') || '<tr><td colspan="5"><div class="empty" style="padding:14px">Cap document a la llista.</div></td></tr>'}</tbody>
    </table></div>
    <div style="display:flex;gap:6px;margin-top:8px"><input id="doc-new" placeholder="+ Afegir document a la llista..." style="flex:1"><button class="btn btn-sm" onclick="FL.addDoc()">+ Afegir</button><button class="btn btn-sm" onclick="FL.resetDocs()">↺ Llista estàndard</button></div>`;
  }
  function docRow(d, i) {
    return `<tr>
      <td style="font-weight:500">${d.nom}</td>
      <td><select onchange="FL.setDocEstat(${i},this.value)" style="max-width:120px">
        <option value="pendent" ${d.estat === 'pendent' ? 'selected' : ''}>Pendent</option>
        <option value="rebut" ${d.estat === 'rebut' ? 'selected' : ''}>Rebut</option>
        <option value="na" ${d.estat === 'na' ? 'selected' : ''}>No aplica</option>
      </select></td>
      <td><input type="date" value="${d.data || ''}" onchange="FL.setDocData(${i},this.value)" style="max-width:140px"></td>
      <td><input value="${(d.nota || '').replace(/"/g, '&quot;')}" placeholder="—" onchange="FL.setDocNota(${i},this.value)" style="min-width:140px"></td>
      <td><span class="add-link" style="color:var(--danger);margin:0" onclick="FL.delDoc(${i})">✕</span></td>
    </tr>`;
  }
  function setDocEstat(i, v) { fleet().documents[i].estat = v; render(); save(); }
  function setDocData(i, v) { fleet().documents[i].data = v || null; save(); }
  function setDocNota(i, v) { fleet().documents[i].nota = v; save(); }
  function addDoc() { const inp = document.getElementById('doc-new'); const t = inp.value.trim(); if (!t) return; fleet().documents.push({ id: uid(), nom: t, estat: 'pendent', data: null, nota: '' }); render(); save(); }
  function delDoc(i) { fleet().documents.splice(i, 1); render(); save(); }
  function resetDocs() { if (!confirm('Tornar a la llista estàndard de documents? Es perdran els estats i notes actuals.')) return; fleet().documents = defaultDocs(); render(); save(); }

  // ===== MATRIU DE VENDA CREUADA / RISCOS =====
  function matriuRules(f) {
    const veh = f.parc.length;
    const cond = f.n_conductors || 0;
    const data7 = '';
    return [
      { cond: !!f.adr, producte: 'RC Mediambiental ADR', prioritat: 'Alta', argument: 'Transport ADR: la RC Mediambiental sol ser obligatòria i sovint queda descoberta.' },
      { cond: !!f.frigorific, producte: 'Avaria d\'equip frigorífic', prioritat: 'Mitjana', argument: 'Flota frigorífica: cobertura d\'avaria de l\'equip de fred i pèrdua de mercaderia perible.' },
      { cond: cond > 0, producte: 'Complement IT · pèrdua de carnet · CAP', prioritat: 'Mitjana', argument: `${cond} conductors: protecció d'incapacitat temporal, pèrdua de carnet i renovació CAP.` },
      { cond: !!f.internacional, producte: 'ICC A + crèdit a l\'exportació', prioritat: 'Alta', argument: 'Trànsit internacional / CMR: la CMR no ho cobreix tot; l\'ICC A tanca el gap i el crèdit a l\'exportació protegeix l\'impagament.' },
      { cond: !!f.naus, producte: 'Multiriscos industrial (nau)', prioritat: 'Mitjana', argument: 'Naus o instal·lacions: multiriscos per a continent, contingut i RC d\'explotació.' },
      { cond: veh > 0, producte: 'Ciber + telemàtica (dossier de risc)', prioritat: 'Mitjana', argument: 'Flota connectada (GPS/telemàtica): exposició ciber i NIS2; el dossier telemàtic millora la tarificació.' },
      { cond: veh >= 10, producte: 'Pèrdua de beneficis', prioritat: 'Baixa', argument: 'Flota gran: la paralització de l\'activitat per un sinistre greu es pot cobrir amb pèrdua de beneficis.' },
      { cond: true, producte: 'Retribució flexible + salut col·lectiva', prioritat: 'Baixa', argument: 'Retenció de talent: retribució flexible (cost zero per a l\'empresa) i salut col·lectiva per als conductors.' }
    ];
  }
  function matriuFlag(k, label, val) { return `<div class="toggle-row" style="margin:0"><label class="switch"><input type="checkbox" ${val ? 'checked' : ''} onchange="FL.setFlag('${k}',this.checked)"><span class="slider"></span></label>${label}</div>`; }
  function vMatriu() {
    const f = fleet();
    const opps = (window.state && Array.isArray(window.state.oportunitats)) ? window.state.oportunitats : [];
    const existing = new Set(opps.filter(o => o.client_id === f.client_id && o.estat !== 'Descartada').map(o => (o.producte || '').toLowerCase()));
    const rows = matriuRules(f).filter(r => r.cond);
    const prioPill = p => p === 'Alta' ? 'p-danger' : p === 'Mitjana' ? 'p-warning' : 'p-success';
    return `<div class="note">Marca el <b>perfil</b> de la flota i et proposem els productes que normalment falten en transport. Cada oportunitat es pot crear al CRM (mòdul 💡 Oportunitats), lligada al client de la flota.</div>
    <div class="card"><div class="section-title">Perfil de la flota</div>
      <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:center">
        ${matriuFlag('adr', 'Transport ADR (perilloses)', f.adr)}
        ${matriuFlag('frigorific', 'Frigorífic', f.frigorific)}
        ${matriuFlag('internacional', 'Internacional / CMR', f.internacional)}
        ${matriuFlag('naus', 'Naus / instal·lacions', f.naus)}
        <div class="toggle-row" style="margin:0;gap:6px">Nº conductors <input type="number" value="${f.n_conductors ?? ''}" placeholder="—" onchange="FL.setNConductors(this.value)" style="width:80px"></div>
      </div></div>
    <div class="card" style="padding:0;overflow-x:auto"><table class="table">
      <thead><tr><th>Producte recomanat</th><th>Per què</th><th>Prioritat</th><th></th></tr></thead>
      <tbody>${rows.map((r, i) => { const ja = existing.has(r.producte.toLowerCase()); return `<tr>
        <td style="font-weight:600">${r.producte}</td>
        <td class="mini" style="max-width:420px">${r.argument}</td>
        <td><span class="pill ${prioPill(r.prioritat)}">${r.prioritat}</span></td>
        <td>${ja ? '<span class="pill p-success">✓ ja al CRM</span>' : `<button class="btn btn-sm btn-primary" onclick="FL.crearOportunitat(${i})">+ Oportunitat</button>`}</td>
      </tr>`; }).join('')}</tbody>
    </table></div>
    <div class="mini">Les oportunitats creades apareixen al mòdul <b>💡 Oportunitats</b> del CRM, llestes per treballar-les comercialment.</div>`;
  }
  function setFlag(k, v) { fleet()[k] = !!v; render(); save(); }
  function setNConductors(v) { fleet().n_conductors = parseInt(v) || null; render(); save(); }
  async function crearOportunitat(idx) {
    const f = fleet(); const r = matriuRules(f).filter(x => x.cond)[idx]; if (!r) return;
    let clientId = f.client_id;
    if (!clientId && typeof window._patchTrobaOCreaClient === 'function') clientId = await window._patchTrobaOCreaClient(f.empresa);
    try {
      const res = await sb().from('oportunitats').insert({ client_id: clientId, empresa: f.empresa, user_id: usr(), producte: r.producte, argument: r.argument, prioritat: r.prioritat, estat: 'Detectada' });
      if (res.error) throw res.error;
      if (typeof window.refreshData === 'function') await window.refreshData('oportunitats');
      if (typeof window.updateNavBadges === 'function') window.updateNavBadges();
      if (typeof window.toast === 'function') window.toast('Oportunitat creada al CRM ✓'); else flash();
      render();
    } catch (e) { toastErr('Error creant l\'oportunitat: ' + (e.message || e)); }
  }

  // ===== PARC & PRIMES =====
  function vParc() {
    const f = fleet();
    return `<div class="taxbar">
      <label>🧮 Tarificador danys propis</label>
      <label>Tasa <input type="number" step="0.1" value="${f.tasa_dp}" onchange="FL.setTasa('tasa_dp',this.value)"> %</label>
      <label>Prima mínima <input type="number" value="${f.min_dp}" onchange="FL.setTasa('min_dp',this.value)"> €</label>
      <span class="mini">Prima DP = valor × tasa (mín. aplicable). Override per vehicle a la columna.</span></div>
    <div class="topbar-actions" style="margin-bottom:10px"><button class="btn btn-sm" onclick="FL.downloadTemplate()">↓ Plantilla CSV</button><button class="btn btn-sm" onclick="document.getElementById('fl-csv').click()">↑ Importar parc CSV</button><input type="file" id="fl-csv" accept=".csv,.txt" style="display:none" onchange="FL.importCSV(event)"><button class="btn btn-sm" onclick="FL.addVeh()">+ Vehicle</button></div>
    <div class="card" style="padding:0;overflow-x:auto"><table class="table">
      <thead><tr><th>Matrícula</th><th>Tipus</th><th>Model</th><th class="num">Valor</th><th>Venciment</th><th class="num">Prima RC</th><th class="num">Prima DP</th><th class="num">Prima total</th><th class="num">Cost/any</th><th class="num">Ràtio</th><th>Adeq.</th><th></th></tr></thead>
      <tbody>${f.parc.map((v, i) => parcRow(f, v, i)).join('')}</tbody>
      <tfoot><tr style="border-top:2px solid var(--border-2);font-weight:700">
        <td colspan="5">TOTAL · ${f.parc.length} veh.</td>
        <td class="num" id="sum-rc">${eur(f.parc.reduce((s, v) => s + (v.prima_rc || 0), 0))}</td>
        <td class="num" id="sum-dp">${eur(f.parc.reduce((s, v) => s + (primaDP(f, v) || 0), 0))}</td>
        <td class="num" id="sum-tot">${eur(parcSum(f))}</td>
        <td class="num">${eur(f.veh.reduce((s, v) => s + vehAnnual(v.mat), 0))}</td>
        <td class="num" id="sum-ratio">${ratioGlobalTxt(f)}</td><td></td><td></td></tr></tfoot></table></div>
    <div class="mini">Valors i primes RC d'exemple — substitueix-los (o importa CSV). La prima DP es calcula sola amb la tasa.</div>`;
  }
  function parcRow(f, v, i) {
    const dp = primaDP(f, v); const tot = primaTot(f, v); const cost = vehAnnual(v.mat); const r = tot ? Math.round(cost / tot * 100) : null;
    return `<tr id="prow-${i}">
      <td style="font-family:monospace;font-weight:600">${v.mat}</td><td><span class="pill p-gray">${v.tipus}</span></td>
      <td><input value="${v.model || ''}" placeholder="—" onchange="FL.setParc(${i},'model',this.value)" style="min-width:110px"></td>
      <td class="num"><input type="number" value="${v.valor ?? ''}" placeholder="—" oninput="FL.setValor(${i},this.value)" style="max-width:90px;text-align:right"></td>
      <td><input type="date" value="${v.venciment || ''}" onchange="FL.setParc(${i},'venciment',this.value)" style="max-width:140px"></td>
      <td class="num"><input type="number" value="${v.prima_rc ?? ''}" placeholder="—" oninput="FL.setRC(${i},this.value)" style="max-width:80px;text-align:right"></td>
      <td class="num" id="dp-${i}">${dp != null ? eur(dp) : '—'}</td>
      <td class="num" id="tot-${i}" style="font-weight:600">${eur(tot)}</td>
      <td class="num" style="color:var(--text-2)">${cost ? eur(cost) : '—'}</td>
      <td class="num" id="lr-${i}">${ratioCell(r)}</td>
      <td id="adq-${i}">${adqPill(r)}</td>
      <td><span class="add-link" style="color:var(--danger);margin:0" onclick="FL.delVeh(${i})">✕</span></td></tr>`;
  }
  function ratioCell(r) { if (r == null) return '—'; const c = r > 100 ? 'var(--danger)' : r > 70 ? 'var(--warning)' : 'var(--success)'; return `<span style="color:${c};font-weight:600">${r}%</span>`; }
  function adqPill(r) { if (r == null) return ''; if (r > 100) return '<span class="pill p-danger">Infraprimat</span>'; if (r > 70) return '<span class="pill p-warning">Ajustat</span>'; return '<span class="pill p-success">OK</span>'; }
  function ratioGlobalTxt(f) { const pg = primaGlobal(f); const cost = f.veh.reduce((s, v) => s + vehAnnual(v.mat), 0); if (!pg) return '—'; return ratioCell(Math.round(cost / pg * 100)); }
  function liveRow(i) {
    const f = fleet(), v = f.parc[i]; const dp = primaDP(f, v), tot = primaTot(f, v), cost = vehAnnual(v.mat), r = tot ? Math.round(cost / tot * 100) : null;
    const g = id => document.getElementById(id);
    if (g('dp-' + i)) g('dp-' + i).textContent = dp != null ? eur(dp) : '—';
    if (g('tot-' + i)) g('tot-' + i).textContent = eur(tot);
    if (g('lr-' + i)) g('lr-' + i).innerHTML = ratioCell(r);
    if (g('adq-' + i)) g('adq-' + i).innerHTML = adqPill(r);
    liveFoot();
  }
  function liveFoot() {
    const f = fleet(); const g = id => document.getElementById(id);
    if (g('sum-rc')) g('sum-rc').textContent = eur(f.parc.reduce((s, v) => s + (v.prima_rc || 0), 0));
    if (g('sum-dp')) g('sum-dp').textContent = eur(f.parc.reduce((s, v) => s + (primaDP(f, v) || 0), 0));
    if (g('sum-tot')) g('sum-tot').textContent = eur(parcSum(f));
    if (g('sum-ratio')) g('sum-ratio').innerHTML = ratioGlobalTxt(f);
  }
  function setValor(i, val) { fleet().parc[i].valor = parseFloat(val) || null; liveRow(i); save(); }
  function setRC(i, val) { fleet().parc[i].prima_rc = parseFloat(val) || null; liveRow(i); save(); }
  function setParc(i, k, val) { fleet().parc[i][k] = val; save(); }
  function setTasa(k, val) { fleet()[k] = parseFloat(val) || 0; render(); save(); }
  function addVeh() { fleet().parc.push({ mat: 'NOU', tipus: 'Tractora/Camió', model: '', valor: null, venciment: null, prima_rc: null, prima_dp_ov: null }); render(); save(); }
  function delVeh(i) { if (!confirm('Treure vehicle?')) return; fleet().parc.splice(i, 1); render(); save(); }

  // ===== importació CSV parc =====
  function downloadTemplate() { const csv = 'matricula;tipus;model;valor;venciment;prima_rc\n1234ABC;Tractora/Camió;Volvo FH;85000;2026-12-31;1300\nR1234ABC;Remolc;Schmitz;22000;2026-12-31;500\n'; dl('plantilla-flota.csv', csv); }
  function importCSV(e) {
    const fl = e.target.files[0]; if (!fl) return; const r = new FileReader(); r.onload = () => {
      try {
        let txt = r.result.replace(/\r/g, ''); const lines = txt.split('\n').filter(l => l.trim()); const sep = lines[0].includes(';') ? ';' : ',';
        let start = 0; if (/matric/i.test(lines[0])) start = 1; const parc = [];
        for (let i = start; i < lines.length; i++) {
          const c = lines[i].split(sep); if (!c[0]) continue;
          const tipus = (c[1] || '').trim() || ((c[0] || '').trim().startsWith('R') ? 'Remolc' : 'Tractora/Camió');
          parc.push({ mat: (c[0] || '').trim(), tipus, model: (c[2] || '').trim(), valor: parseFloat(c[3]) || null, venciment: (c[4] || '').trim() || null, prima_rc: parseFloat(c[5]) || null, prima_dp_ov: null });
        }
        if (!parc.length) { alert('CSV buit o format incorrecte'); return; }
        if (confirm(`Importar ${parc.length} vehicles a "${fleet().empresa}"? (reemplaça el parc actual)`)) { fleet().parc = parc; render(); save(); }
      } catch (err) { alert('Error llegint CSV: ' + err.message); }
    }; r.readAsText(fl, 'utf-8'); e.target.value = '';
  }

  // ===== SINISTRALITAT =====
  function vSini() {
    const f = fleet(), arr = sinisF(f);
    const perP = {}; arr.forEach(s => { const k = s.per || '?'; perP[k] = perP[k] || { n: 0, imp: 0 }; perP[k].n++; perP[k].imp += s.imp; }); const pPer = Object.entries(perP).sort((a, b) => a[0] < b[0] ? -1 : 1);
    const perC = {}; arr.forEach(s => { const k = s.causa || '?'; perC[k] = perC[k] || { n: 0, imp: 0 }; perC[k].n++; perC[k].imp += s.imp; }); const pC = Object.entries(perC).sort((a, b) => b[1].imp - a[1].imp); const mxC = pC[0]?.[1].imp || 1;
    const culpa = arr.filter(s => s.tipo === 'Culpa' || s.causa === 'CICOS DEUDOR'); const noc = arr.filter(s => s.tipo === 'Reclamación' || s.causa === 'CICOS ACREEDOR'); const ind = arr.filter(s => !culpa.includes(s) && !noc.includes(s)); const sm = l => l.reduce((s, x) => s + x.imp, 0);
    return `<div class="toggle-row"><label class="switch"><input type="checkbox" ${INCL_DP ? 'checked' : ''} onchange="FL.setInclDP(this.checked)"><span class="slider"></span></label>Incloure danys propis</div>
    <div class="grid2"><div class="card"><div class="section-title">Evolució per període</div><table class="table"><thead><tr><th>Període</th><th class="num">Sin.</th><th class="num">Import</th></tr></thead><tbody>${pPer.map(([p, d]) => `<tr><td><b>${p}</b></td><td class="num">${d.n}</td><td class="num">${eur(d.imp)}</td></tr>`).join('')}<tr style="border-top:2px solid var(--border-2)"><td><b>Total</b></td><td class="num"><b>${arr.length}</b></td><td class="num"><b>${eur(sm(arr))}</b></td></tr></tbody></table></div>
    <div class="card"><div class="section-title">Culpa / No culpa</div><table class="table"><thead><tr><th></th><th class="num">Sin.</th><th class="num">Import</th></tr></thead><tbody><tr><td><span class="pill p-danger">Culpa</span></td><td class="num">${culpa.length}</td><td class="num">${eur(sm(culpa))}</td></tr><tr><td><span class="pill p-success">No culpa</span></td><td class="num">${noc.length}</td><td class="num">${eur(sm(noc))}</td></tr><tr><td><span class="pill p-gray">Indeterminat</span></td><td class="num">${ind.length}</td><td class="num">${eur(sm(ind))}</td></tr></tbody></table></div></div>
    <div class="card"><div class="section-title">Per tipologia de cobertura</div>${pC.map(([c, d]) => `<div class="chart-bar"><div class="chart-label">${COB_LABEL[c] || c}</div><div class="chart-track"><div class="chart-fill" style="width:${d.imp / mxC * 100}%;background:${c === 'LUNAS' ? 'var(--info)' : c === 'DAÑOS PROPIOS' ? 'var(--danger)' : 'var(--brand)'}"></div></div><div class="chart-value">${d.n} · ${eur(d.imp)}</div></div>`).join('')}</div>
    <div class="card" style="padding:0;overflow-x:auto"><div class="section-title" style="padding:16px 16px 0">Anàlisi per vehicle (semàfor)</div><table class="table"><thead><tr><th>Vehicle</th><th class="num">Sin.</th><th class="num">Total</th><th class="num">Mitjana</th><th class="num">Oberts</th><th class="num">Períodes</th><th>Risc</th></tr></thead><tbody>${[...f.veh].sort((a, b) => b.total - a.total).map(v => `<tr><td style="font-family:monospace;font-weight:600">${v.mat}</td><td class="num">${v.n}</td><td class="num"><b>${eur(v.total)}</b></td><td class="num">${eur(v.media)}</td><td class="num">${v.abiertos || '—'}</td><td class="num">${v.periodos}</td><td>${riskPill(v.riesgo)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  // ===== OFERTES =====
  function cols(f) { return [{ key: 'actual', cia: f.asseguradora_actual || 'Actual', prima: primaGlobal(f), g: { rc: 1, danys: 1, llunes: 1, assist: 1, defensa: 1, robatori: 1 }, actual: true }, ...f.ofertes]; }
  function vOfertes() {
    const f = fleet(); const C = cols(f);
    return `<div id="cmp-reco">${recoBanner(f)}</div><div class="card" style="padding:0;overflow-x:auto"><table class="cmp-table"><thead><tr><th>Comparativa</th>
      ${C.map(c => `<th class="${c.actual ? 'cmp-col-actual' : ''}"><div class="cia-head">${c.actual ? '⬤ ' + (f.asseguradora_actual || 'Situació actual') : `<input value="${c.cia || ''}" placeholder="CIA" onchange="FL.setOf('${c.id}','cia',this.value)" style="max-width:115px;font-weight:700;color:var(--brand)">`}</div>${c.actual ? '<span class="mini">vigent</span>' : `${c.comprum ? '<span class="pill p-brand">Comprum</span>' : '<span class="pill p-gray">Mercat</span>'} <span class="add-link" style="color:var(--danger)" onclick="FL.delOferta('${c.id}')">✕</span>`}</th>`).join('')}</tr></thead><tbody>
      <tr><td class="rowlbl">Prima total</td>${C.map(c => `<td class="${c.actual ? 'cmp-col-actual' : ''}"><input type="number" value="${c.actual ? (f.prima_global_override ?? '') : (c.prima ?? '')}" placeholder="${c.actual ? fmt(parcSum(f)) : '—'}" oninput="${c.actual ? 'FL.setFG(this.value)' : `FL.setOfPrima('${c.id}',this.value)`}"></td>`).join('')}</tr>
      <tr><td class="rowlbl">Prima / vehicle</td>${C.map(c => `<td class="${c.actual ? 'cmp-col-actual' : ''}" id="pv-${c.key || c.id}">${pvCell(f, c)}</td>`).join('')}</tr>
      <tr><td class="rowlbl">Δ vs actual</td>${C.map(c => `<td class="${c.actual ? 'cmp-col-actual' : ''}" id="dl-${c.key || c.id}">${deltaCell(f, c)}</td>`).join('')}</tr>
      <tr><td class="rowlbl">Ràtio implícit</td>${C.map(c => `<td class="${c.actual ? 'cmp-col-actual' : ''}" id="rt-${c.key || c.id}">${ratioImpCell(f, c)}</td>`).join('')}</tr>
      <tr><td colspan="${C.length + 1}" style="padding-top:12px"><div class="section-title" style="margin:0">Quadre de garanties</div></td></tr>
      ${GARANTIES.map(([k, lbl]) => `<tr><td class="rowlbl">${lbl}</td>${C.map(c => `<td class="${c.actual ? 'cmp-col-actual' : ''}">${c.actual ? (c.g[k] ? '✓' : '—') : `<span style="cursor:pointer;font-size:15px" onclick="FL.togG('${c.id}','${k}')">${c.g[k] ? '✅' : '⬜'}</span>`}</td>`).join('')}</tr>`).join('')}
      <tr><td class="rowlbl">Franquícia danys</td>${C.map(c => `<td class="${c.actual ? 'cmp-col-actual' : ''}">${c.actual ? '—' : `<input type="number" value="${c.franquicia ?? ''}" placeholder="—" onchange="FL.setOf('${c.id}','franquicia',parseFloat(this.value)||null)">`}</td>`).join('')}</tr>
      <tr><td class="rowlbl">Comissió Brokkom %</td>${C.map(c => `<td class="${c.actual ? 'cmp-col-actual' : ''}">${c.actual ? '—' : `<input type="number" value="${c.comissio ?? ''}" placeholder="—" oninput="FL.setOfCom('${c.id}',this.value)">`}</td>`).join('')}</tr>
      <tr><td class="rowlbl">Ingrés Brokkom est.</td>${C.map(c => `<td class="${c.actual ? 'cmp-col-actual' : ''}" id="ig-${c.key || c.id}">${ingresCell(c)}</td>`).join('')}</tr>
    </tbody></table></div>
    <div class="section-title" style="margin:16px 0 8px">Alternatives · pros i contres (modular)</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px">${f.ofertes.map(altCard).join('') || '<div class="mini">Encara no hi ha ofertes. Afegeix-ne o importa-les des de Plantilles & informes.</div>'}</div>
    <span class="add-link" onclick="FL.addOferta()">+ Afegir alternativa</span>
    <div class="note" style="margin-top:14px">Edició viva. Ràtio implícit i comissió són <b>internes</b> — no surten als informes per a client.</div>`;
  }
  function pvCell(f, c) { const nv = f.parc.length || 1; const p = c.actual ? primaGlobal(f) : c.prima; return p ? eur(p / nv) : '—'; }
  function deltaCell(f, c) { if (c.actual) return '<span class="mini">—</span>'; const pa = primaGlobal(f); if (!c.prima || !pa) return '—'; const d = pa - c.prima; return `<span style="color:${d > 0 ? 'var(--success)' : 'var(--danger)'};font-weight:600">${d > 0 ? '−' : '+'}${eur(Math.abs(d))} · ${Math.round(Math.abs(d) / pa * 100)}%</span>`; }
  function ratioImpCell(f, c) { const a = agg(f); const p = c.actual ? primaGlobal(f) : c.prima; if (!p) return '—'; const r = Math.round(a.costAnual / p * 100); return `<span style="color:${r > 85 ? 'var(--danger)' : r > 70 ? 'var(--warning)' : 'var(--success)'};font-weight:600">${r}%</span>`; }
  function ingresCell(c) { if (c.actual) return '—'; return (c.prima && c.comissio) ? eur(c.prima * c.comissio / 100) : '—'; }
  function recoBanner(f) { const ov = f.ofertes.filter(o => o.prima); if (!ov.length) return '<div class="note">Carrega primes de CIA per veure recomanació.</div>'; const min = Math.min(...ov.map(o => o.prima)); const best = ov.find(o => o.prima === min); const bestG = Object.values(best.g).reduce((s, x) => s + x, 0); const maxG = Math.max(...f.ofertes.map(o => Object.values(o.g).reduce((s, x) => s + x, 0))); const pa = primaGlobal(f); if (bestG < maxG) return `<div class="note warn">⚠ La més barata (<b>${best.cia}</b>, ${eur(best.prima)}) retalla cobertures. Ensenya el quadre de garanties.</div>`; return `<div class="note ok">✓ <b>${best.cia}</b> més barata (${eur(best.prima)}) mantenint cobertures. ${pa ? `Estalvi: <b>${eur(pa - best.prima)}</b> (${Math.round((pa - best.prima) / pa * 100)}%).` : ''}</div>`; }
  function recalcCmp() { const f = fleet(); cols(f).forEach(c => { const k = c.key || c.id; const set = (p, h) => { const el = document.getElementById(p + '-' + k); if (el) el.innerHTML = h; }; set('pv', pvCell(f, c)); set('dl', deltaCell(f, c)); set('rt', ratioImpCell(f, c)); set('ig', ingresCell(c)); }); const rb = document.getElementById('cmp-reco'); if (rb) rb.innerHTML = recoBanner(f); }
  function setOfPrima(id, val) { const o = fleet().ofertes.find(x => x.id === id); if (o) { o.prima = parseFloat(val) || null; recalcCmp(); save(); } }
  function setOfCom(id, val) { const o = fleet().ofertes.find(x => x.id === id); if (o) { o.comissio = parseFloat(val) || null; recalcCmp(); save(); } }
  function setFG(val) { fleet().prima_global_override = parseFloat(val) || null; const r = document.getElementById('reconcile'); if (r) r.innerHTML = reconcileTxt(fleet()); if (TAB === 'ofertes') recalcCmp(); save(); }
  function setOf(id, k, v) { const o = fleet().ofertes.find(x => x.id === id); if (o) { o[k] = v; render(); save(); } }
  function togG(id, k) { const o = fleet().ofertes.find(x => x.id === id); if (o) { o.g[k] = o.g[k] ? 0 : 1; render(); save(); } }
  function addOferta() { fleet().ofertes.push({ id: uid(), cia: '', comprum: false, prima: null, g: { rc: 1, danys: 0, llunes: 0, assist: 0, defensa: 0, robatori: 0 }, franquicia: null, comissio: null, pros: '', contres: '', presentar: true }); render(); save(); }
  function delOferta(id) { fleet().ofertes = fleet().ofertes.filter(o => o.id !== id); render(); save(); }
  function setF(k, v) { fleet()[k] = v; render(); save(); }
  function setOfQuiet(id, k, v) { const o = fleet().ofertes.find(x => x.id === id); if (o) { o[k] = (typeof v === 'string') ? v.replace(/`/g, "'") : v; save(); } }
  function altCard(o) {
    const f = fleet(); const pa = primaGlobal(f); const est = (pa && o.prima) ? eur(pa - o.prima) : '—';
    return `<div class="card" style="margin:0;border:${o.presentar ? '2px solid var(--brand)' : '1px solid var(--border)'}"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="color:var(--brand)">${o.cia || '(CIA)'}</b><label class="mini" style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" ${o.presentar ? 'checked' : ''} onchange="FL.setOf('${o.id}','presentar',this.checked)" style="width:auto">presentar</label></div><div style="display:flex;gap:14px;margin-bottom:8px;align-items:center"><div><div class="mini">Prima</div><b>${eur(o.prima)}</b></div><div><div class="mini">Estalvi</div><b style="color:var(--success)">${est}</b></div>${o.comprum ? '<span class="pill p-brand">Comprum</span>' : ''}</div><div class="mini" style="color:var(--success);margin-bottom:2px">✓ Pros</div><textarea placeholder="millor preu, manté llunes..." oninput="FL.setOfQuiet('${o.id}','pros',this.value)" style="min-height:44px;margin-bottom:6px">${o.pros || ''}</textarea><div class="mini" style="color:var(--danger);margin-bottom:2px">✕ Contres</div><textarea placeholder="franquícia alta, exclou robatori..." oninput="FL.setOfQuiet('${o.id}','contres',this.value)" style="min-height:44px">${o.contres || ''}</textarea></div>`;
  }

  // ===== PLANTILLES & INFORMES =====
  function vPlant() {
    return `<div class="grid2">
      <div class="card"><div class="section-title">⬆ Importar dades a la flota</div>
        <div class="mini" style="margin:2px 0 6px"><b>Del client</b> — parc i sinistralitat</div>
        <div class="topbar-actions" style="margin-bottom:12px">
          <button class="btn btn-sm" onclick="FL.dlTpl('parc')">↓ Plantilla parc</button>
          <button class="btn btn-sm" onclick="document.getElementById('imp-parc').click()">↑ Parc CSV</button>
          <input type="file" id="imp-parc" accept=".csv,.txt" style="display:none" onchange="FL.importCSV(event)">
          <button class="btn btn-sm" onclick="FL.dlTpl('sini')">↓ Plantilla loss run</button>
          <button class="btn btn-sm" onclick="document.getElementById('imp-sini').click()">↑ Sinistralitat CSV</button>
          <input type="file" id="imp-sini" accept=".csv,.txt" style="display:none" onchange="FL.importSinis(event)">
        </div>
        <div class="mini" style="margin:2px 0 6px"><b>De la CIA</b> — ofertes rebudes</div>
        <div class="topbar-actions">
          <button class="btn btn-sm" onclick="FL.dlTpl('oferta')">↓ Plantilla ofertes</button>
          <button class="btn btn-sm" onclick="document.getElementById('imp-of').click()">↑ Ofertes CSV</button>
          <input type="file" id="imp-of" accept=".csv,.txt" style="display:none" onchange="FL.importOfertes(event)">
        </div></div>
      <div class="card"><div class="section-title">⬇ Exportar dades de la flota</div>
        <div class="mini" style="margin:2px 0 6px"><b>Per al client</b> — sense ràtio ni comissió</div>
        <div class="topbar-actions" style="margin-bottom:12px">
          <button class="btn btn-primary btn-sm" onclick="FL.informeClient()">🖨 Informe comparativa (PDF)</button>
          <button class="btn btn-sm" onclick="FL.exportComparativaCSV()">⬇ Comparativa CSV</button>
          <button class="btn btn-sm" onclick="FL.exportExcelClient()">⬇ Proposta Excel (unificat)</button>
        </div>
        <div class="mini" style="margin:2px 0 6px"><b>Per a la CIA</b> — presentació de risc</div>
        <div class="topbar-actions">
          <button class="btn btn-primary btn-sm" onclick="FL.informeCIA()">🖨 Presentació risc (PDF)</button>
          <button class="btn btn-sm" onclick="FL.exportParcCSV()">⬇ Parc / schedule CSV</button>
          <button class="btn btn-sm" onclick="FL.exportSinisCSV()">⬇ Loss run CSV</button>
        </div></div>
    </div>
    <div class="card"><div class="section-title">Textos · gestió → seguiment</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
        <select id="tpl-sel" onchange="FL.renderTpl()" style="max-width:320px">${TPL.map(t => `<option value="${t.k}">${t.n}</option>`).join('')}</select>
        <button class="btn btn-sm" onclick="FL.renderTpl()">↻ Regenerar</button>
        <button class="btn btn-sm" onclick="FL.copyTpl('tpl-text')">📋 Copiar</button>
        <button class="btn btn-sm btn-primary" onclick="FL.tplToTask()">+ Tasca de seguiment (7 dies)</button>
      </div>
      <textarea class="tpl-area" id="tpl-text">${TPL[0].fn()}</textarea>
      <div class="mini" style="margin-top:6px">Tria una plantilla, ajusta-la i copia-la. "Tasca de seguiment" crea una tasca a la flota (a 7 dies) perquè la gestió no es perdi.</div>
    </div>
    <div class="note"><b>Resum dels fluxos:</b> del <b>client</b> entra parc + loss run (CSV); de la <b>CIA</b> entren ofertes (CSV). Cap al <b>client</b> surt l'informe comparativa (PDF/CSV, sense dades internes); cap a la <b>CIA</b> surt la presentació de risc i la relació de vehicles + loss run perquè puguin tarificar.</div>`;
  }
  function tplEntrada() { const f = fleet(); return `SOL·LICITUD DE DADES — RENOVACIÓ FLOTA\nEmpresa: ${f.empresa}\nVenciment: ${fmtDate(f.venciment)}\n\nNecessitem per sortir al mercat:\n\n1) PARC (Excel, una fila per vehicle):\n   matrícula · tipus · marca i model · valor · data alta · venciment · prima actual\n\n2) SINISTRALITAT / LOSS RUN (3–5 anys, una fila per sinistre):\n   data · matrícula · cobertura · culpa/no culpa · import pagat · reserva · estat\n\n3) PÒLISSA ACTUAL: condicions + últim rebut (prima global i per vehicle)\n4) MOVIMENTS PREVISTOS: altes i baixes fins a renovació\n5) ACTIVITAT: àmbit · ADR · frigorífic · nº conductors`; }
  function tplSortida() { const f = fleet(); const ov = f.ofertes.filter(o => o.prima); const pa = primaGlobal(f); let s = `COMPARATIVA D'OFERTES — ${f.empresa}\n${f.parc.length} vehicles · venciment ${fmtDate(f.venciment)}\n\nSITUACIÓ ACTUAL: ${f.asseguradora_actual || '(actual)'} · prima ${eur(pa)}\n\n`; if (!ov.length) { s += 'OFERTES: (carrega primes)\n'; return s; } s += 'OFERTES REBUDES:\n'; ov.sort((a, b) => a.prima - b.prima).forEach(o => { const gar = GARANTIES.filter(([k]) => o.g[k]).map(([, l]) => l).join(', '); const est = pa ? ` · estalvi ${eur(pa - o.prima)} (${Math.round((pa - o.prima) / pa * 100)}%)` : ''; s += `\n• ${o.cia || 'CIA'} — ${eur(o.prima)}${est}\n  Garanties: ${gar}\n  Franquícia danys: ${o.franquicia != null ? eur(o.franquicia) : '—'}\n`; }); const b = ov[0]; s += `\nRECOMANACIÓ: ${b.cia || 'CIA'} (${eur(b.prima)})${pa ? `, ${eur(pa - b.prima)} d'estalvi` : ''}, mantenint garanties.`; return s; }
  function copyTpl(id) { const t = document.getElementById(id); t.select(); try { document.execCommand('copy'); } catch (e) { navigator.clipboard && navigator.clipboard.writeText(t.value); } flash(); }

  // --- plantilles addicionals (mòdul Textos i tasques) ---
  function tplRecordatori() { const f = fleet(); const pend = (f.documents || []).filter(d => d.estat === 'pendent').map(d => '· ' + d.nom).join('\n'); return `RECORDATORI — DADES PENDENTS · ${f.empresa}\nVenciment: ${fmtDate(f.venciment)}\n\nPer poder tancar la renovació a temps, encara ens falta rebre:\n\n${pend || '(res pendent — gràcies!)'}\n\nQuan ens ho puguis fer arribar, sortim al mercat de seguida. Moltes gràcies.`; }
  function tplReclamacioCIA() { const f = fleet(); const limit = fmtDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)); return `RECLAMACIÓ DE QUOTACIÓ · ${f.empresa}\nFlota de ${f.parc.length} vehicles · venciment ${fmtDate(f.venciment)}\n\nBon dia,\n\nEstem pendents de la vostra quotació per a aquesta flota. El client ha de decidir aviat: ens podríeu confirmar oferta (prima i garanties) abans del ${limit}?\n\nJa us hem fet arribar la relació de vehicles i el loss run. Si us falta qualsevol cosa per tarificar, digueu-nos-ho i us ho passem el mateix dia.\n\nGràcies.`; }
  function tplDecisio() { const f = fleet(); const ov = f.ofertes.filter(o => o.prima).sort((a, b) => a.prima - b.prima); const pa = primaGlobal(f); const b = ov[0]; return `RECOMANACIÓ · ${f.empresa}\n\nHem analitzat les ofertes rebudes per a la teva flota (${f.parc.length} vehicles).\n\n${b ? `La nostra recomanació és ${b.cia || 'aquesta companyia'} per ${eur(b.prima)}${pa ? `, amb un estalvi de ${eur(pa - b.prima)} respecte a la situació actual` : ''}, mantenint les garanties.` : '(carrega les ofertes a la comparativa per generar la recomanació)'}\n\nT'adjuntem la comparativa completa perquè ho vegis amb detall. Quan ens ho confirmis, tramitem l'emissió.`; }
  const TPL = [
    { k: 'entrada', n: 'Petició de dades (client)', bloqueja: 'Client', fn: tplEntrada },
    { k: 'recordatori', n: 'Recordatori dades pendents (client)', bloqueja: 'Client', fn: tplRecordatori },
    { k: 'reclamacioCIA', n: 'Reclamació de quotació (CIA)', bloqueja: 'CIA', fn: tplReclamacioCIA },
    { k: 'sortida', n: 'Enviament d\'ofertes (client)', bloqueja: 'Client', fn: tplSortida },
    { k: 'decisio', n: 'Recomanació / decisió (client)', bloqueja: 'Client', fn: tplDecisio }
  ];
  function renderTpl() { const sel = document.getElementById('tpl-sel'); const t = TPL.find(x => x.k === (sel ? sel.value : '')) || TPL[0]; const ta = document.getElementById('tpl-text'); if (ta) ta.value = t.fn(); }
  function tplToTask() { const sel = document.getElementById('tpl-sel'); const t = TPL.find(x => x.k === (sel ? sel.value : '')) || TPL[0]; const f = fleet(); const data = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10); f.pendents.push({ id: uid(), text: 'Seguiment: ' + t.n, bloqueja: t.bloqueja, data, estat: 'obert', subtasks: [] }); save(); if (typeof window.toast === 'function') window.toast('Tasca de seguiment creada (7 dies)'); else flash(); }

  // ----- informes imprimibles -----
  function openReport(title, body) { const w = window.open('', '_blank'); w.document.write(`<!DOCTYPE html><html lang="ca"><head><meta charset="UTF-8"><title>${title}</title><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
body{font-family:'Inter',sans-serif;color:#1B2536;max-width:880px;margin:0 auto;padding:40px 48px;font-size:13px;line-height:1.6}
h1{font-size:22px;letter-spacing:-.02em;margin-bottom:2px}.sub{color:#8792A3;font-size:12px;margin-bottom:24px}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#8792A3;margin:24px 0 10px;border-bottom:1px solid #E2E7EE;padding-bottom:5px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}th{text-align:left;font-size:10px;text-transform:uppercase;color:#8792A3;padding:6px 8px;border-bottom:1px solid #C9D2DE}td{padding:5px 8px;border-bottom:1px solid #EDF0F4}.num{text-align:right;font-variant-numeric:tabular-nums}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:18px}.logo{width:30px;height:30px;border-radius:7px;background:#1A3A6B;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px}
.rec{background:#E3F2E9;border:1px solid #C2E2CE;border-radius:8px;padding:10px 14px;margin:14px 0;font-size:13px}
.foot{margin-top:30px;color:#8792A3;font-size:11px;border-top:1px solid #E2E7EE;padding-top:12px}
@media print{.noprint{display:none}body{padding:20px}}
</style></head><body><div class="noprint" style="text-align:right;margin-bottom:10px"><button onclick="window.print()" style="padding:7px 14px;border:1px solid #1A3A6B;background:#1A3A6B;color:#fff;border-radius:8px;cursor:pointer">🖨 Imprimir / PDF</button></div>${body}</body></html>`); w.document.close(); }
  function informeClient() {
    const f = fleet(); const pa = primaGlobal(f); const alts = f.ofertes.filter(o => o.prima && o.presentar).sort((a, b) => a.prima - b.prima);
    const cards = alts.length ? alts.map((o, i) => { const gar = GARANTIES.filter(([k]) => o.g[k]).map(([, l]) => l.split(' ')[0]).join(', '); const est = pa ? eur(pa - o.prima) : '—'; const pros = (o.pros || '').trim(); const con = (o.contres || '').trim();
      return `<div style="border:1px solid #C9D2DE;border-radius:8px;padding:14px 16px;margin-bottom:12px"><div style="display:flex;justify-content:space-between"><b style="font-size:15px">Alternativa ${i + 1} · ${o.cia || '—'}</b><b style="font-size:15px">${eur(o.prima)}/any</b></div><div style="color:#1F7A4D;font-size:12px;margin:2px 0 8px">Estalvi vs actual: ${est}</div><table><tbody><tr><td style="width:130px">Garanties</td><td>${gar}</td></tr><tr><td>Franquícia danys</td><td>${o.franquicia != null ? eur(o.franquicia) : '—'}</td></tr>${pros ? `<tr><td style="color:#1F7A4D">A favor</td><td>${pros.replace(/\n/g, '<br>')}</td></tr>` : ''}${con ? `<tr><td style="color:#B23939">A tenir en compte</td><td>${con.replace(/\n/g, '<br>')}</td></tr>` : ''}</tbody></table></div>`; }).join('') : '<p>Pendent de rebre ofertes.</p>';
    const body = `<div class="brand"><div class="logo">BKK</div><b>Brokkom Correduria de Segurs</b></div><h1>Proposta d'assegurança de flota</h1><div class="sub">${f.empresa} · ${f.parc.length} vehicles · venciment ${fmtDate(f.venciment)}</div><h2>Situació actual</h2><table><tbody><tr><td>Companyia actual</td><td class="num">${f.asseguradora_actual || '—'}</td></tr><tr><td>Prima anual actual</td><td class="num"><b>${eur(pa)}</b></td></tr></tbody></table><h2>Alternatives proposades (${alts.length})</h2>${cards}<div class="foot">Document informatiu emès per Brokkom. Condicions subjectes a acceptació de la companyia. ${new Date().toLocaleDateString('ca-ES')}</div>`;
    openReport('Proposta client · ' + f.empresa, body);
  }
  function informeCIA() {
    const f = fleet(); const sm = l => l.reduce((s, x) => s + x.imp, 0);
    const perP = {}; f.sinis.forEach(s => { const k = s.per || '?'; perP[k] = perP[k] || { n: 0, imp: 0 }; perP[k].n++; perP[k].imp += s.imp; });
    const perC = {}; f.sinis.forEach(s => { const k = s.causa || '?'; perC[k] = perC[k] || { n: 0, imp: 0 }; perC[k].n++; perC[k].imp += s.imp; });
    const culpa = f.sinis.filter(s => s.tipo === 'Culpa' || s.causa === 'CICOS DEUDOR'); const noc = f.sinis.filter(s => s.tipo === 'Reclamación' || s.causa === 'CICOS ACREEDOR');
    const parcTbl = `<table><thead><tr><th>Matrícula</th><th>Tipus</th><th>Model</th><th class="num">Valor</th><th>Venciment</th></tr></thead><tbody>${f.parc.map(v => `<tr><td style="font-family:monospace">${v.mat}</td><td>${v.tipus}</td><td>${v.model || '—'}</td><td class="num">${eur(v.valor)}</td><td>${fmtDate(v.venciment)}</td></tr>`).join('')}</tbody></table>`;
    const body = `<div class="brand"><div class="logo">BKK</div><b>Brokkom Correduria de Segurs</b> · Presentació de risc</div>
      <h1>Flota — ${f.empresa}</h1><div class="sub">${f.parc.length} vehicles · àmbit ${f.ambit} · ADR ${f.adr ? 'sí' : 'no'} · venciment ${fmtDate(f.venciment)}</div>
      <h2>Sinistralitat per període</h2><table><thead><tr><th>Període</th><th class="num">Sinistres</th><th class="num">Import</th></tr></thead><tbody>${Object.entries(perP).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([p, d]) => `<tr><td>${p}</td><td class="num">${d.n}</td><td class="num">${eur(d.imp)}</td></tr>`).join('')}<tr style="font-weight:700;border-top:2px solid #C9D2DE"><td>Total</td><td class="num">${f.sinis.length}</td><td class="num">${eur(sm(f.sinis))}</td></tr></tbody></table>
      <h2>Per cobertura · Culpabilitat</h2><table><tbody>${Object.entries(perC).sort((a, b) => b[1].imp - a[1].imp).map(([c, d]) => `<tr><td>${COB_LABEL[c] || c}</td><td class="num">${d.n} sin.</td><td class="num">${eur(d.imp)}</td></tr>`).join('')}<tr><td><b>Culpa</b></td><td class="num">${culpa.length} sin.</td><td class="num">${eur(sm(culpa))}</td></tr><tr><td><b>No culpa (recuperable)</b></td><td class="num">${noc.length} sin.</td><td class="num">${eur(sm(noc))}</td></tr></tbody></table>
      <h2>Relació de vehicles</h2>${parcTbl}
      <div class="foot">Dades facilitades per Brokkom per a tarificació. ${new Date().toLocaleDateString('ca-ES')}</div>`;
    openReport('Presentació CIA · ' + f.empresa, body);
  }

  // ===== TASQUES =====
  function vPend() {
    const f = fleet();
    const taskHtml = (p) => {
      const d = daysLeft(p.data); const subs = p.subtasks || []; const done = subs.filter(s => s.done).length;
      return `<div style="padding:9px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:flex-start;gap:8px"><div style="flex:1"><div style="font-weight:500;font-size:12.5px">${p.text}${subs.length ? ` <span class="pill p-gray">${done}/${subs.length}</span>` : ''}</div><div class="mini">${p.data ? fmtDate(p.data) : 'sense data'} ${d != null ? `· <span style="color:${d < 0 ? 'var(--danger)' : d < 7 ? 'var(--warning)' : 'var(--text-3)'}">${d < 0 ? 'vençut ' + Math.abs(d) + 'd' : d + 'd'}</span>` : ''}</div></div><button class="btn btn-sm" onclick="FL.closePend('${p.id}')">✓</button></div>
        ${subs.map(st => `<div style="display:flex;align-items:center;gap:7px;margin:3px 0 0 6px"><input type="checkbox" ${st.done ? 'checked' : ''} onchange="FL.togSub('${p.id}','${st.id}')" style="width:auto"><span style="font-size:12px;${st.done ? 'text-decoration:line-through;color:var(--text-3)' : ''}">${st.cia ? `<b>${st.cia}</b> · ` : ''}${st.text}</span></div>`).join('')}
        <div style="display:flex;gap:6px;margin:6px 0 0 6px"><input id="sub-${p.id}" placeholder="+ subtasca" style="flex:1;font-size:12px;padding:3px 7px"><button class="btn btn-sm" onclick="FL.addSub('${p.id}')">+</button><button class="btn btn-sm" onclick="FL.genSubCIA('${p.id}')" title="una subtasca per oferta">⚙ per CIA</button></div></div>`;
    };
    const block = (titol, tipus) => { const ob = f.pendents.filter(p => p.estat === 'obert' && p.bloqueja === tipus); return `<div class="card"><div class="section-title">${titol} · ${ob.length}</div>${ob.length === 0 ? '<div class="empty" style="padding:14px">Cap pendent ✓</div>' : ob.map(taskHtml).join('')}<div style="display:flex;gap:6px;margin-top:10px"><input id="np-${tipus}" placeholder="Nova tasca..." style="flex:1"><input id="nd-${tipus}" type="date" style="width:auto"><button class="btn btn-sm btn-primary" onclick="FL.addPend('${tipus}')">+</button></div></div>`; };
    return `<div class="note">Tasques per flota amb <b>subtasques</b> (p.ex. una per asseguradora). "⚙ per CIA" crea una subtasca per cada oferta carregada.</div><div class="grid3">${block('🏢 De companyia (CIA)', 'CIA')}${block('👤 De client', 'Client')}${block('🛠 Internes', 'Intern')}</div>`;
  }
  function addPend(tipus) { const t = document.getElementById('np-' + tipus).value.trim(); if (!t) return; fleet().pendents.push({ id: uid(), text: t, bloqueja: tipus, data: document.getElementById('nd-' + tipus).value || null, estat: 'obert', subtasks: [] }); render(); save(); }
  function closePend(id) { const p = fleet().pendents.find(x => x.id === id); if (p) { p.estat = 'tancat'; render(); save(); } }
  function addSub(taskId) { const inp = document.getElementById('sub-' + taskId); const t = inp.value.trim(); if (!t) return; const p = fleet().pendents.find(x => x.id === taskId); if (p) { (p.subtasks = p.subtasks || []).push({ id: uid(), text: t, done: false }); render(); save(); } }
  function togSub(taskId, subId) { const p = fleet().pendents.find(x => x.id === taskId); if (p) { const s = (p.subtasks || []).find(x => x.id === subId); if (s) { s.done = !s.done; render(); save(); } } }
  function genSubCIA(taskId) { const f = fleet(); const p = f.pendents.find(x => x.id === taskId); if (!p) return; const cias = [...new Set(f.ofertes.map(o => o.cia).filter(Boolean))]; if (!cias.length) { alert('Carrega ofertes amb companyia primer'); return; } p.subtasks = p.subtasks || []; cias.forEach(c => { if (!p.subtasks.find(s => s.cia === c)) p.subtasks.push({ id: uid(), text: 'oferta', cia: c, done: false }); }); render(); save(); }

  // ===== DASHBOARD CARTERA =====
  function dashCost(f) { if (f.sinis && f.sinis.length) { const a = f.sinis.filter(s => !s.dp); const per = [...new Set(a.map(x => x.per))].filter(Boolean); return a.reduce((s, x) => s + x.imp, 0) / (per.length || 1); } return f.sini_anual_manual || 0; }
  function dashRatio(f) { const p = primaGlobal(f); return p ? Math.round(dashCost(f) / p * 100) : null; }
  function vencKey(d) { return d ? d.slice(0, 7) : '—'; }
  function vencLabel(k) { if (k === '—') return 'Sense data'; const [y, m] = k.split('-'); return ['gen', 'feb', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'des'][+m - 1] + ' ' + y; }
  function openFleet(id) { CUR = id; TAB = 'resum'; render(); }
  function setSort(k) { if (DASH_SORT.k === k) DASH_SORT.dir *= -1; else DASH_SORT = { k, dir: -1 }; render(); }
  function vDash() {
    const F = FLEETS;
    const totVeh = F.reduce((s, f) => s + f.parc.length, 0);
    const totPrima = F.reduce((s, f) => s + primaGlobal(f), 0);
    const totCost = F.reduce((s, f) => s + dashCost(f), 0);
    const ratioPond = totPrima ? Math.round(totCost / totPrima * 100) : null;
    const cohort = F.filter(f => vencKey(f.venciment) === '2026-12');
    const cohortPrima = cohort.reduce((s, f) => s + primaGlobal(f), 0);
    const tasquesCIA = F.reduce((s, f) => s + f.pendents.filter(p => p.estat === 'obert' && p.bloqueja === 'CIA').length, 0);
    const tasquesCli = F.reduce((s, f) => s + f.pendents.filter(p => p.estat === 'obert' && p.bloqueja === 'Client').length, 0);
    const byV = {}; F.forEach(f => { const k = vencKey(f.venciment); byV[k] = byV[k] || { n: 0, p: 0 }; byV[k].n++; byV[k].p += primaGlobal(f); });
    const vEntries = Object.entries(byV).sort((a, b) => a[0] < b[0] ? -1 : 1); const vMax = Math.max(...vEntries.map(e => e[1].p), 1);
    const byE = {}; F.forEach(f => { const k = f.estat || 'dades'; byE[k] = byE[k] || { n: 0, p: 0 }; byE[k].n++; byE[k].p += primaGlobal(f); });
    const eMax = Math.max(...ESTATS.map(([k]) => (byE[k] ? byE[k].p : 0)), 1);
    const byC = {}; F.forEach(f => { const k = f.asseguradora_actual || '—'; byC[k] = byC[k] || { n: 0, p: 0 }; byC[k].n++; byC[k].p += primaGlobal(f); });
    const cEntries = Object.entries(byC).sort((a, b) => b[1].p - a[1].p); const cMax = Math.max(...cEntries.map(e => e[1].p), 1);
    const compIn = F.filter(f => f.comprum).reduce((s, f) => s + primaGlobal(f), 0); const compOut = totPrima - compIn;
    const altRatio = F.filter(f => { const r = dashRatio(f); return r != null && r > 85; });
    const venResol = []; F.forEach(f => f.pendents.forEach(p => { if (p.estat === 'obert' && p.data && daysLeft(p.data) < 0) venResol.push({ f, p }); }));
    const rows = F.map(f => ({ f, emp: f.empresa, veh: f.parc.length, prima: primaGlobal(f), ratio: dashRatio(f), venc: f.venciment, dl: daysLeft(f.venciment), cia: f.asseguradora_actual || '—', estat: f.estat || 'dades' }));
    rows.sort((a, b) => { let x = a[DASH_SORT.k], y = b[DASH_SORT.k]; if (typeof x === 'string') { x = x || ''; y = y || ''; return DASH_SORT.dir * x.localeCompare(y); } return DASH_SORT.dir * ((x || 0) - (y || 0)); });
    const th = (k, l, cls = '') => `<th class="${cls}" style="cursor:pointer" onclick="FL.setSort('${k}')">${l}${DASH_SORT.k === k ? (DASH_SORT.dir < 0 ? ' ▾' : ' ▴') : ''}</th>`;
    return `<div class="metrics">
      <div class="metric"><div class="metric-label">Flotes</div><div class="metric-value">${F.length}</div><div class="metric-sub">${totVeh} vehicles</div></div>
      <div class="metric"><div class="metric-label">Prima exposada</div><div class="metric-value">${eur(totPrima)}</div><div class="metric-sub">cartera flotes</div></div>
      <div class="metric"><div class="metric-label">Ràtio ponderat</div><div class="metric-value" style="color:${ratioPond > 85 ? 'var(--danger)' : ratioPond > 70 ? 'var(--warning)' : 'var(--success)'}">${ratioPond != null ? ratioPond + '%' : '—'}</div><div class="metric-sub">sinistralitat/prima</div></div>
      <div class="metric" style="border-color:var(--warning);background:var(--warning-soft)"><div class="metric-label">Cohort 31/12</div><div class="metric-value" style="color:var(--warning)">${cohort.length}</div><div class="metric-sub">${eur(cohortPrima)} exposats</div></div>
      <div class="metric"><div class="metric-label">Tasques CIA</div><div class="metric-value" style="color:${tasquesCIA ? 'var(--info)' : 'var(--text)'}">${tasquesCIA}</div><div class="metric-sub">pendents companyia</div></div>
      <div class="metric"><div class="metric-label">Tasques client</div><div class="metric-value" style="color:${tasquesCli ? 'var(--warning)' : 'var(--text)'}">${tasquesCli}</div><div class="metric-sub">pendents client</div></div>
    </div>
    <div class="grid2">
      <div class="card"><div class="section-title">Concentració de venciments · prima exposada</div>
        ${vEntries.map(([k, d]) => { const hot = k === '2026-12'; return `<div class="chart-bar"><div class="chart-label">${vencLabel(k)} ${hot ? '<span class="pill p-danger">pic</span>' : ''}</div><div class="chart-track"><div class="chart-fill" style="width:${d.p / vMax * 100}%;background:${hot ? 'var(--danger)' : 'var(--brand)'}"></div></div><div class="chart-value">${d.n} flot. · ${eur(d.p)}</div></div>`; }).join('')}
        <div class="mini" style="margin-top:8px">El pic del 31/12 és el coll d'ampolla: treballa'l en compte enrere des de T-120.</div></div>
      <div class="card"><div class="section-title">Pipeline de renovació</div>
        ${ESTATS.map(([k, l]) => { const d = byE[k] || { n: 0, p: 0 }; return `<div class="chart-bar"><div class="chart-label">${l}</div><div class="chart-track"><div class="chart-fill" style="width:${d.p / eMax * 100}%"></div></div><div class="chart-value">${d.n} · ${eur(d.p)}</div></div>`; }).join('')}
      </div>
    </div>
    <div class="grid2">
      <div class="card"><div class="section-title">Prima per asseguradora actual</div>
        ${cEntries.map(([c, d]) => `<div class="chart-bar"><div class="chart-label">${c}</div><div class="chart-track"><div class="chart-fill" style="width:${d.p / cMax * 100}%"></div></div><div class="chart-value">${d.n} · ${eur(d.p)}</div></div>`).join('')}
        <div style="display:flex;gap:18px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <div><div class="mini">Dins Comprum</div><div style="font-size:18px;font-weight:700;color:var(--brand)">${eur(compIn)}</div><div class="mini">${totPrima ? Math.round(compIn / totPrima * 100) : 0}%</div></div>
          <div><div class="mini">Fora (mercat)</div><div style="font-size:18px;font-weight:700;color:var(--text-2)">${eur(compOut)}</div><div class="mini">${totPrima ? Math.round(compOut / totPrima * 100) : 0}%</div></div>
        </div></div>
      <div class="card"><div class="section-title">⚠ Atenció requerida</div>
        ${altRatio.length ? altRatio.map(f => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="FL.openFleet('${f.id}')"><span>${f.empresa}</span><span class="pill p-danger">ràtio ${dashRatio(f)}%</span></div>`).join('') : '<div class="mini">Cap flota amb ràtio crític.</div>'}
        ${venResol.length ? '<div class="section-title" style="margin-top:14px">Tasques vençudes</div>' + venResol.map(({ f, p }) => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="FL.openFleet('${f.id}')"><span>${p.text} <span class="mini">(${f.empresa})</span></span><span class="pill p-warning">${Math.abs(daysLeft(p.data))}d</span></div>`).join('') : ''}
      </div>
    </div>
    <div class="card" style="padding:0;overflow-x:auto"><div class="section-title" style="padding:16px 16px 6px">Cartera de flotes</div>
      <table class="table"><thead><tr>${th('emp', 'Empresa')}${th('veh', 'Veh.', 'num')}${th('prima', 'Prima', 'num')}${th('ratio', 'Ràtio', 'num')}${th('venc', 'Venciment')}${th('cia', 'CIA')}<th>Comprum</th>${th('estat', 'Estat')}<th></th></tr></thead>
      <tbody>${rows.map(r => `<tr style="cursor:pointer" onclick="FL.openFleet('${r.f.id}')">
        <td><b>${r.emp}</b></td><td class="num">${r.veh}</td><td class="num">${eur(r.prima)}</td>
        <td class="num">${r.ratio != null ? `<span style="color:${r.ratio > 85 ? 'var(--danger)' : r.ratio > 70 ? 'var(--warning)' : 'var(--success)'};font-weight:600">${r.ratio}%</span>` : '—'}</td>
        <td>${fmtDate(r.venc)} ${r.dl != null ? `<span class="mini">(${r.dl}d)</span>` : ''}</td><td>${r.cia}</td>
        <td>${r.f.comprum ? '<span class="pill p-brand">Comprum</span>' : '<span class="pill p-gray">Mercat</span>'}</td>
        <td><span class="pill p-info">${(ESTATS.find(e => e[0] === r.estat) || ['', '—'])[1]}</span></td>
        <td style="color:var(--text-3)">→</td></tr>`).join('')}</tbody></table></div>`;
  }

  // ===== components compartits =====
  function renewalChecklist(f) { const dl = daysLeft(f.venciment); if (dl == null) return ''; const ms = [[120, 'Petició de dades'], [90, 'Loss run + parc'], [75, 'Sortida al mercat'], [45, 'Oferta al client'], [30, 'Decisió client'], [15, 'Emissió']]; const next = Math.max(...ms.map(m => m[0]).filter(t => t <= dl), -1); return `<div class="card"><div class="section-title">Checklist de renovació · ${dl} dies per al venciment</div><div style="display:flex;flex-wrap:wrap;gap:8px">${ms.map(([t, l]) => { const passat = t > dl; const isNext = t === next; const dstr = fmtDate(new Date(new Date(f.venciment).getTime() - t * 86400000).toISOString().slice(0, 10)); return `<div style="flex:1;min-width:118px;border:1px solid ${isNext ? 'var(--brand)' : 'var(--border)'};${isNext ? 'background:var(--brand-soft);' : ''}border-radius:8px;padding:8px 10px"><div class="mini">T-${t} · ${dstr}</div><div style="font-size:12px;font-weight:500">${l}</div><div class="mini" style="color:${passat ? 'var(--danger)' : isNext ? 'var(--brand)' : 'var(--text-3)'}">${passat ? '⚠ finestra passada' : isNext ? '→ ara' : 'pendent'}</div></div>`; }).join('')}</div></div>`; }
  function fleetTasksMini(f) { const ob = f.pendents.filter(p => p.estat === 'obert'); if (!ob.length) return '<div class="mini">Cap tasca pendent ✓</div>'; const bm = { 'CIA': 'p-info', 'Client': 'p-warning', 'Intern': 'p-gray' }; return ob.map(p => { const subs = p.subtasks || []; const done = subs.filter(s => s.done).length; const d = daysLeft(p.data); return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)"><span class="pill ${bm[p.bloqueja] || 'p-gray'}">${p.bloqueja}</span><span style="flex:1;font-size:12.5px">${p.text}${subs.length ? ` <span class="mini">(${done}/${subs.length})</span>` : ''}</span><span class="mini" style="color:${d != null && d < 0 ? 'var(--danger)' : 'var(--text-3)'}">${d != null ? (d < 0 ? 'vençut' : d + 'd') : ''}</span></div>`; }).join('') + `<div class="add-link" onclick="FL.setTab('pend')">Gestionar tasques →</div>`; }
  function offersMini(f) { const ov = f.ofertes.filter(o => o.prima); const pa = primaGlobal(f); if (!ov.length) return '<div class="mini">Cap oferta carregada.</div>'; const min = Math.min(...ov.map(o => o.prima)); const pres = f.ofertes.filter(o => o.presentar && o.prima).length; return `<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:8px"><div><div class="mini">Ofertes</div><b style="font-size:18px">${ov.length}</b></div><div><div class="mini">A presentar</div><b style="font-size:18px;color:var(--brand)">${pres}</b></div><div><div class="mini">Millor prima</div><b style="font-size:18px">${eur(min)}</b></div><div><div class="mini">Estalvi</div><b style="font-size:18px;color:var(--success)">${pa ? eur(pa - min) : '—'}</b></div></div><div class="add-link" onclick="FL.setTab('ofertes')">Veure comparativa →</div>`; }

  // ===== CSV plantilles / import sinis i ofertes / exports =====
  function dl(name, txt) { const b = new Blob([txt], { type: 'text/csv;charset=utf-8' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }
  function dlTpl(t) { const T = { parc: 'matricula;tipus;model;valor;venciment;prima_rc\n1234ABC;Tractora/Camió;Volvo FH;85000;2026-12-31;1300\nR1234ABC;Remolc;Schmitz;22000;2026-12-31;500\n', sini: 'data;matricula;cobertura;tipus;import;estat;periode\n2025-03-14;1234ABC;R.C.;Culpa;1850;Cerrado;2024/25\n2025-06-02;1234ABC;LUNAS;Reclamación;320;Cerrado;2024/25\n', oferta: 'cia;comprum;prima;rc;danys;llunes;assist;defensa;robatori;franquicia;comissio\nReale;1;145000;1;1;1;1;1;1;300;12\nAllianz;0;152000;1;1;0;1;1;0;500;15\n' }; dl('plantilla-' + t + '.csv', T[t] || ''); }
  function parseRows(txt) { txt = txt.replace(/\r/g, ''); const lines = txt.split('\n').filter(l => l.trim()); if (!lines.length) return { head: [], rows: [] }; const sep = lines[0].includes(';') ? ';' : ','; const head = lines[0].split(sep).map(s => s.trim().toLowerCase()); const rows = lines.slice(1).map(l => l.split(sep)); return { head, rows, sep }; }
  function col(head, row, name, idx) { const i = head.indexOf(name); return (i >= 0 ? row[i] : row[idx]); }
  function importSinis(e) {
    const fl = e.target.files[0]; if (!fl) return; const r = new FileReader(); r.onload = () => {
      try {
        const { head, rows } = parseRows(r.result); const sinis = [];
        rows.forEach((c, k) => { const mat = (col(head, c, 'matricula', 1) || '').trim(); if (!mat) return;
          const causa = ((col(head, c, 'cobertura', 2) || '').trim() || 'SIN CLASIFICAR').toUpperCase();
          const est = (col(head, c, 'estat', 5) || '').trim().toLowerCase();
          sinis.push({ n: String(k + 1), mat, causa, tipo: (col(head, c, 'tipus', 3) || '').trim() || 'Indeterminado', estado: /ab|obe|open/.test(est) ? 'Abierto' : 'Cerrado', f_sin: (col(head, c, 'data', 0) || '').trim() || null, imp: parseFloat((col(head, c, 'import', 4) || '0').replace(',', '.')) || 0, per: (col(head, c, 'periode', 6) || '').trim() || null, dp: /da[ñn]os\s*propios/i.test(causa) }); });
        if (!sinis.length) { alert('CSV buit o format incorrecte'); return; }
        if (confirm(`Importar ${sinis.length} sinistres a "${fleet().empresa}"? (reemplaça la sinistralitat actual)`)) { fleet().sinis = sinis; fleet().veh = computeVeh(sinis); fleet().sini_anual_manual = null; render(); save(); }
      } catch (err) { alert('Error: ' + err.message); }
    }; r.readAsText(fl, 'utf-8'); e.target.value = '';
  }
  function importOfertes(e) {
    const fl = e.target.files[0]; if (!fl) return; const r = new FileReader(); r.onload = () => {
      try {
        const { head, rows } = parseRows(r.result); const ofs = [];
        rows.forEach(c => { const cia = (col(head, c, 'cia', 0) || '').trim(); if (!cia) return; const b = v => { const x = (v || '').toString().trim().toLowerCase(); return (x === '1' || x === 'si' || x === 'sí' || x === 'true' || x === 'x') ? 1 : 0; };
          ofs.push({ id: uid(), cia, comprum: !!b(col(head, c, 'comprum', 1)), prima: parseFloat((col(head, c, 'prima', 2) || '').replace(',', '.')) || null, g: { rc: b(col(head, c, 'rc', 3)), danys: b(col(head, c, 'danys', 4)), llunes: b(col(head, c, 'llunes', 5)), assist: b(col(head, c, 'assist', 6)), defensa: b(col(head, c, 'defensa', 7)), robatori: b(col(head, c, 'robatori', 8)) }, franquicia: parseFloat(col(head, c, 'franquicia', 9)) || null, comissio: parseFloat(col(head, c, 'comissio', 10)) || null, pros: '', contres: '', presentar: true }); });
        if (!ofs.length) { alert('CSV buit'); return; }
        if (confirm(`Afegir ${ofs.length} ofertes a la comparativa de "${fleet().empresa}"?`)) { fleet().ofertes = fleet().ofertes.concat(ofs); TAB = 'ofertes'; render(); save(); }
      } catch (err) { alert('Error: ' + err.message); }
    }; r.readAsText(fl, 'utf-8'); e.target.value = '';
  }
  function exportParcCSV() { const f = fleet(); let s = 'matricula;tipus;model;valor;venciment;prima_rc;prima_dp;prima_total\n'; f.parc.forEach(v => { const dp = primaDP(f, v); s += `${v.mat};${v.tipus};${v.model || ''};${v.valor || ''};${v.venciment || ''};${v.prima_rc || ''};${dp != null ? Math.round(dp) : ''};${Math.round(primaTot(f, v))}\n`; }); dl('parc-' + f.empresa.replace(/\s+/g, '_') + '.csv', s); }
  function exportSinisCSV() { const f = fleet(); let s = 'data;matricula;cobertura;tipus;import;estat;periode\n'; f.sinis.forEach(x => { s += `${x.f_sin || ''};${x.mat || ''};${x.causa || ''};${x.tipo || ''};${Math.round(x.imp || 0)};${x.estado || ''};${x.per || ''}\n`; }); dl('lossrun-' + f.empresa.replace(/\s+/g, '_') + '.csv', s); }
  function exportComparativaCSV() { const f = fleet(); const pa = primaGlobal(f); const nv = f.parc.length || 1; const cl = t => (t || '').replace(/[;\n]/g, ' '); let s = 'alternativa;companyia;prima;prima_per_vehicle;estalvi_vs_actual;estalvi_pct;garanties;franquicia;pros;contres\n'; s += `Actual;${f.asseguradora_actual || ''};${Math.round(pa)};${Math.round(pa / nv)};;;RC,Danys,Llunes,Assistència,Defensa,Robatori;;;\n`; f.ofertes.filter(o => o.prima && o.presentar).sort((a, b) => a.prima - b.prima).forEach((o, i) => { const gar = GARANTIES.filter(([k]) => o.g[k]).map(([, l]) => l.split(' ')[0]).join(','); const est = pa ? Math.round(pa - o.prima) : ''; const pct = pa ? Math.round((pa - o.prima) / pa * 100) : ''; s += `Alt ${i + 1};${o.cia || ''};${Math.round(o.prima)};${Math.round(o.prima / nv)};${est};${pct};${gar};${o.franquicia != null ? Math.round(o.franquicia) : ''};${cl(o.pros)};${cl(o.contres)}\n`; }); dl('comparativa-' + f.empresa.replace(/\s+/g, '_') + '.csv', s); }
  function exportExcelClient() {
    const f = fleet(); const pa = primaGlobal(f); const nv = f.parc.length || 1; const alts = f.ofertes.filter(o => o.prima && o.presentar).sort((a, b) => a.prima - b.prima);
    const r = c => '<tr>' + c.map(x => `<td>${x == null ? '' : x}</td>`).join('') + '</tr>'; const hd = c => '<tr>' + c.map(x => `<th style="background:#14294C;color:#fff">${x}</th>`).join('') + '</tr>';
    let t = '<table border="1" cellspacing="0" cellpadding="5" style="font-family:Calibri,Arial">';
    t += r([`<b>Proposta d'assegurança de flota — ${f.empresa}</b>`]); t += r([`${f.parc.length} vehicles · venciment ${fmtDate(f.venciment)}`]); t += r(['']);
    t += hd(['Alternativa', 'Companyia', 'Prima/any', 'Prima/vehicle', 'Estalvi vs actual', 'Garanties', 'Franquícia', 'A favor', 'A tenir en compte']);
    t += r(['Actual', f.asseguradora_actual || '—', Math.round(pa), Math.round(pa / nv), '', 'RC, Danys, Llunes, Assistència, Defensa, Robatori', '', '', '']);
    alts.forEach((o, i) => { const gar = GARANTIES.filter(([k]) => o.g[k]).map(([, l]) => l.split(' ')[0]).join(', '); t += r([`Alternativa ${i + 1}`, o.cia || '—', Math.round(o.prima), Math.round(o.prima / nv), pa ? Math.round(pa - o.prima) : '', gar, o.franquicia != null ? Math.round(o.franquicia) : '', (o.pros || '').replace(/\n/g, ' / '), (o.contres || '').replace(/\n/g, ' / ')]); });
    t += '</table>';
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${t}</body></html>`;
    const b = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'proposta-' + f.empresa.replace(/\s+/g, '_') + '.xls'; a.click(); URL.revokeObjectURL(u);
  }

  // ===== backup / restaura (núvol) =====
  function exportJSON() { const b = new Blob([JSON.stringify(FLEETS, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'brokkom-flotes.json'; a.click(); URL.revokeObjectURL(u); }
  function importJSON(e) {
    const fl = e.target.files[0]; if (!fl) return; const r = new FileReader(); r.onload = async () => {
      try {
        const arr = JSON.parse(r.result); if (!Array.isArray(arr)) throw new Error('El fitxer no és una llista de flotes');
        if (!confirm(`Restaurar ${arr.length} flotes al núvol? S'afegiran com a flotes noves (no esborra les existents).`)) return;
        for (const f of arr) { normalizeFleet(f); f.id = null; await dbInsertFlotaDeep(f); }
        _loaded = false; await loadFlotesFromDB(); _loaded = true; CUR = FLEETS[0] ? FLEETS[0].id : null; render();
        alert('Restauració completada.');
      } catch (err) { alert('Error en la restauració: ' + err.message); }
    }; r.readAsText(fl); e.target.value = '';
  }

  // =====================================================================
  // CSS (scoped a #flotes-root)
  // =====================================================================
  function injectCSS() {
    if (document.getElementById('flotes-css')) return;
    const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
/* Flotes hereta els tokens del tema actiu del CRM (clar o fosc). NO fixem paleta pròpia. */
#flotes-root{color:var(--text);font-size:14px;line-height:1.55;letter-spacing:-.006em}
#flotes-root *,#flotes-root *::before,#flotes-root *::after{box-sizing:border-box}
#flotes-root .wrap{max-width:1320px;margin:0 auto;padding:4px 2px 40px}
#flotes-root .topbar{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;gap:14px;flex-wrap:wrap}
#flotes-root .topbar-actions{display:flex;gap:6px;flex-shrink:0;align-items:center;flex-wrap:wrap}
/* page-title, page-sub i botons (.btn/.btn-primary/.btn-sm): heretats del CRM */
#flotes-root select,#flotes-root input,#flotes-root textarea{font-family:inherit;font-size:13px;padding:6px 9px;border:1px solid var(--border-2);border-radius:var(--r);background:var(--surface);color:var(--text);width:100%}
#flotes-root select:focus,#flotes-root input:focus,#flotes-root textarea:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
#flotes-root .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:12px;margin-bottom:16px}
/* card, metric/metric-label/value/sub, section-title: heretats del CRM */
#flotes-root .table{width:100%;border-collapse:collapse;font-size:12.5px}
#flotes-root .table th{text-align:left;font-size:9.5px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;padding:7px 8px;border-bottom:1px solid var(--border);font-weight:600;white-space:nowrap}
#flotes-root .table td{padding:6px 8px;border-bottom:1px solid var(--border)}
#flotes-root .table tr:last-child td{border-bottom:none}
#flotes-root .table tbody tr:hover{background:var(--surface-2)}
#flotes-root .table .num{text-align:right;font-variant-numeric:tabular-nums}
/* pill i p-success/warning/danger/info/gray: heretats del CRM */
#flotes-root .p-brand{background:var(--brand-soft);color:var(--brand)}
#flotes-root .chart-bar{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:12px}
#flotes-root .chart-label{flex:0 0 160px;color:var(--text-2)}
#flotes-root .chart-track{flex:1;height:7px;background:var(--surface-2);border-radius:4px;overflow:hidden}
#flotes-root .chart-fill{height:100%;background:var(--brand);border-radius:4px;transition:width .4s}
#flotes-root .chart-value{flex:0 0 130px;text-align:right;font-weight:600;font-size:11.5px;font-variant-numeric:tabular-nums}
#flotes-root .subnav{display:flex;gap:2px;border-bottom:1px solid var(--border);margin-bottom:18px;flex-wrap:wrap}
#flotes-root .subnav button{background:none;border:none;border-bottom:2px solid transparent;padding:9px 13px;font-size:13px;color:var(--text-3);cursor:pointer;font-family:inherit;font-weight:500;margin-bottom:-1px}
#flotes-root .subnav button.active{color:var(--brand);border-bottom-color:var(--brand);font-weight:600}
#flotes-root .subnav button:hover:not(.active){color:var(--text-2)}
#flotes-root .toggle-row{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-2);margin-bottom:14px}
#flotes-root .switch{position:relative;width:36px;height:20px;flex-shrink:0}
#flotes-root .switch input{opacity:0;width:0;height:0}
#flotes-root .slider{position:absolute;inset:0;background:var(--border-2);border-radius:20px;transition:.2s;cursor:pointer}
#flotes-root .slider::before{content:"";position:absolute;height:14px;width:14px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
#flotes-root .switch input:checked+.slider{background:var(--brand)}
#flotes-root .switch input:checked+.slider::before{transform:translateX(16px)}
/* empty: heretat del CRM */
#flotes-root .note{font-size:12px;color:var(--text-2);background:var(--info-soft);border:1px solid var(--border);border-radius:var(--r);padding:9px 12px;margin-bottom:14px;line-height:1.5}
#flotes-root .note.warn{background:var(--warning-soft);border-color:var(--border-2)}
#flotes-root .note.ok{background:var(--success-soft);border-color:var(--border-2)}
#flotes-root .cmp-table{width:100%;border-collapse:collapse;font-size:13px}
#flotes-root .cmp-table th,#flotes-root .cmp-table td{padding:8px 11px;border-bottom:1px solid var(--border);text-align:right;font-variant-numeric:tabular-nums}
#flotes-root .cmp-table th:first-child,#flotes-root .cmp-table td:first-child{text-align:left;font-variant-numeric:normal}
#flotes-root .cmp-table thead th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3);border-bottom:2px solid var(--border-2);vertical-align:bottom}
#flotes-root .cmp-col-actual{background:var(--surface-2)}
#flotes-root .cmp-best{background:var(--success-soft)!important}
#flotes-root .cmp-table .rowlbl{color:var(--text-2);font-weight:500}
#flotes-root .cmp-table input{padding:4px 7px;font-size:12.5px;text-align:right;max-width:106px}
#flotes-root .cia-head{font-weight:700;color:var(--brand);font-size:13px}
#flotes-root .flota-select select{width:auto;min-width:210px;font-weight:600}
#flotes-root .mini{font-size:11px;color:var(--text-3)}
#flotes-root .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
#flotes-root .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
@media(max-width:900px){#flotes-root .grid2,#flotes-root .grid3{grid-template-columns:1fr}}
#flotes-root .add-link{font-size:12px;color:var(--brand);cursor:pointer;font-weight:500;display:inline-flex;gap:4px;align-items:center;margin-top:8px}
#flotes-root .add-link:hover{text-decoration:underline}
#flotes-root .bcost{display:flex;gap:22px;flex-wrap:wrap;align-items:center}
#flotes-root .bcost-item .v{font-size:19px;font-weight:700;font-variant-numeric:tabular-nums}
#flotes-root .bcost-item .l{font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
#flotes-root .tpl-area{width:100%;min-height:320px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;white-space:pre;resize:vertical}
#flotes-root .saved{font-size:11px;color:var(--success);opacity:0;transition:opacity .3s}
#flotes-root .saved.show{opacity:1}
#flotes-root .taxbar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;background:var(--brand-soft);border:1px solid var(--border);border-radius:var(--r);padding:10px 14px;margin-bottom:12px}
#flotes-root .taxbar label{font-size:11px;color:var(--text-2);font-weight:600;display:flex;align-items:center;gap:6px}
#flotes-root .taxbar input{width:70px;text-align:right}
`;
    const st = document.createElement('style'); st.id = 'flotes-css'; st.textContent = css; document.head.appendChild(st);
  }

  // =====================================================================
  // EXPOSICIÓ a window
  // =====================================================================
  window.renderFlotes = renderFlotesTab;
  window.FL = {
    selFleet, novaFlota, exportJSON, importJSON, setTab, setInclDP,
    setF, setFG, setTasa, setValor, setRC, setParc, addVeh, delVeh,
    downloadTemplate, importCSV, dlTpl, importSinis, importOfertes,
    setOf, togG, setOfPrima, setOfCom, setOfQuiet, addOferta, delOferta,
    addPend, closePend, addSub, togSub, genSubCIA,
    setDocEstat, setDocData, setDocNota, addDoc, delDoc, resetDocs,
    setFlag, setNConductors, crearOportunitat, renderTpl, tplToTask,
    informeClient, informeCIA, exportParcCSV, exportSinisCSV, exportComparativaCSV, exportExcelClient,
    copyTpl, tplSortida, openFleet, setSort
  };
})();
