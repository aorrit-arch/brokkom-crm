// ==================================================================
// BROKKOM CRM · brokkom-prospeccio.js
// Centre de trucades / Prospecció — cua de treball + mode trucada.
// Taules: prospectes (empreses a trucar) + trucades (historial).
// ==================================================================
(function () {
  'use strict';

  // ---------- estils propis del mòdul ----------
  const css = `
  .pr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
  .pr-kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;box-shadow:var(--shadow-card)}
  .pr-kpi-label{font-size:10.5px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  .pr-kpi-value{font-size:26px;font-weight:700;color:var(--text);line-height:1.1;margin-top:4px;letter-spacing:-0.02em}
  .pr-kpi-sub{font-size:11px;color:var(--text-3);margin-top:2px}
  .pr-kpi.accent .pr-kpi-value{color:var(--brand)}
  .pr-filters{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
  .pr-chip{font-size:12.5px;padding:6px 12px;border-radius:999px;border:1px solid var(--border-2);background:var(--surface);color:var(--text-2);cursor:pointer;transition:all .1s;user-select:none}
  .pr-chip:hover{background:var(--surface-2)}
  .pr-chip.active{background:var(--brand);border-color:var(--brand);color:#fff;font-weight:500}
  .pr-chip .n{opacity:.7;margin-left:4px}
  .pr-row{display:flex;align-items:center;gap:14px;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .08s}
  .pr-row:hover{background:var(--surface-2)}
  .pr-row:last-child{border-bottom:none}
  .pr-row-main{flex:1;min-width:0}
  .pr-row-emp{font-size:14px;font-weight:600;color:var(--text);letter-spacing:-0.01em}
  .pr-row-meta{font-size:12px;color:var(--text-3);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap}
  .pr-row-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
  .pr-hook{font-size:11px;color:var(--warning);background:var(--warning-soft);padding:2px 8px;border-radius:999px;font-weight:500;white-space:nowrap}
  .pr-prio{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .pr-prio.Alta{background:var(--danger)}.pr-prio.Mitjana{background:var(--warning)}.pr-prio.Baixa{background:var(--text-3)}
  /* mode trucada */
  .pr-call-overlay{position:fixed;inset:0;background:rgba(16,24,40,.45);z-index:120;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow-y:auto}
  .pr-call{background:var(--surface);border-radius:var(--r-lg);width:100%;max-width:920px;box-shadow:var(--shadow-pop);overflow:hidden;margin:auto}
  .pr-call-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,var(--brand-soft),transparent)}
  .pr-call-head h2{font-size:18px;font-weight:700;letter-spacing:-0.02em;color:var(--text)}
  .pr-call-head .sub{font-size:12.5px;color:var(--text-2);margin-top:2px}
  .pr-call-body{display:grid;grid-template-columns:1fr 1fr;gap:0}
  .pr-col{padding:18px 22px}
  .pr-col+.pr-col{border-left:1px solid var(--border)}
  .pr-sec-t{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);font-weight:600;margin:0 0 8px}
  .pr-field{margin-bottom:9px}
  .pr-field label{font-size:11px;color:var(--text-2);display:block;margin-bottom:3px;font-weight:500}
  .pr-field input,.pr-field select,.pr-field textarea{font-family:inherit;font-size:13px;padding:7px 9px;border-radius:var(--r-sm);border:1px solid var(--border-2);background:var(--surface);color:var(--text);width:100%;outline:none}
  .pr-field input:focus,.pr-field select:focus,.pr-field textarea:focus{border-color:var(--brand)}
  .pr-field.todo input,.pr-field.todo select{background:#FFFBEB;border-color:#F0D98C}
  .pr-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .pr-complete{height:6px;border-radius:3px;background:var(--surface-2);overflow:hidden;margin:4px 0 14px}
  .pr-complete-bar{height:100%;background:var(--success);border-radius:3px;transition:width .3s}
  .pr-args{display:flex;flex-direction:column;gap:7px;margin-bottom:14px}
  .pr-arg{border-left:3px solid var(--brand);background:var(--brand-soft);border-radius:0 var(--r-sm) var(--r-sm) 0;padding:7px 11px}
  .pr-arg b{font-size:12.5px;color:var(--brand)}
  .pr-arg p{font-size:12px;color:var(--text-2);margin-top:2px;line-height:1.45}
  .pr-hist{max-height:170px;overflow-y:auto}
  .pr-hist-item{font-size:12px;padding:7px 0;border-bottom:1px solid var(--border)}
  .pr-hist-item:last-child{border-bottom:none}
  .pr-hist-res{font-weight:600;color:var(--text)}
  .pr-hist-when{color:var(--text-3);font-size:11px}
  .pr-signals{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}
  .pr-sig{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--info-soft);color:var(--info);font-weight:500}
  .pr-call-foot{padding:16px 22px;border-top:1px solid var(--border);background:var(--surface-2)}
  .pr-call-tel{display:flex;align-items:center;gap:10px;margin-bottom:12px}
  .pr-tel-btn{display:inline-flex;align-items:center;gap:8px;background:var(--success);color:#fff;border:none;border-radius:var(--r);padding:10px 18px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none}
  .pr-tel-btn:hover{filter:brightness(1.05)}
  .pr-tel-num{font-size:14px;color:var(--text-2);font-variant-numeric:tabular-nums}
  .pr-disp{display:flex;flex-wrap:wrap;gap:7px}
  .pr-disp button{font-family:inherit;font-size:12.5px;padding:8px 13px;border-radius:var(--r);border:1px solid var(--border-2);background:var(--surface);color:var(--text);cursor:pointer;font-weight:500}
  .pr-disp button:hover{background:var(--surface-2)}
  .pr-disp button.good{border-color:var(--success);color:var(--success)}
  .pr-disp button.bad{border-color:var(--danger);color:var(--danger)}
  .pr-disp button.warn{border-color:var(--warning);color:var(--warning)}
  @media(max-width:780px){.pr-call-body{grid-template-columns:1fr}.pr-col+.pr-col{border-left:none;border-top:1px solid var(--border)}}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ---------- helpers ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const P = () => window.state.prospectes || [];
  const T = () => window.state.trucades || [];
  const todayMid = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const isToday = d => { if (!d) return false; const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() === todayMid().getTime(); };
  const PRIO_ORD = { Alta: 3, Mitjana: 2, Baixa: 1 };
  const ESTATS = ['Nou', 'No contacta', 'Contactat', 'Interessat', 'Visita', 'Proposta', 'No interessa', 'Convertit'];

  function trucadesDe(pid) {
    return T().filter(t => t.prospecte_id === pid).sort((a, b) => new Date(b.data) - new Date(a.data));
  }

  // completesa de la fitxa (camps clau per pressupostar)
  function completesa(p) {
    const claus = ['telefon', 'contacte', 'mobil', 'contacte_email', 'tipus_transport', 'ambit', 'vehicles_total', 'treballadors', 'facturacio', 'venciment', 'asseguradora_actual'];
    const plens = claus.filter(k => p[k] !== null && p[k] !== undefined && String(p[k]).trim() !== '').length;
    return Math.round((plens / claus.length) * 100);
  }

  function argumentsSuggerits(p) {
    const a = [];
    if (p.venciment) { const d = daysFromNow(p.venciment); if (d >= -15 && d <= 130) a.push(['Venciment a prop', `Caduca el ${fmtDate(p.venciment)}. És el millor moment per oferir-li cotització (es truca 90 dies abans).`]); }
    if (p.adr) a.push(['ADR / mercaderies perilloses', 'Obliga RC Mediambiental. Pregunta si la tenen contractada.']);
    if (p.conveni) a.push(['Conveni col·lectiu', 'RC Patronal + accidents de conveni: el conveni obliga i la pòlissa ho ha de cobrir bé.']);
    if (p.ambit && /interna/i.test(p.ambit)) a.push(['Transport internacional', "El CMR no ho cobreix tot: ICC A + crèdit a l'exportació tapen el forat."]);
    if (p.frigorific) a.push(['Temperatura controlada', "Avaria de l'equip de fred: cobertura específica que sovint falta."]);
    if (p.telematica) a.push(['Telemàtica instal·lada', 'Dossier de risc telemàtic per rebaixar la prima de flota.']);
    if (p.vehicles_total || p.caps_tractora) a.push(['Flota', `${p.vehicles_total || p.caps_tractora || ''} vehicles: RC i danys propis. Revisa cobertures i franquícies.`]);
    if (p.nis2_ciber) a.push(['Ciber / NIS2', 'Ciber transport + compliment NIS2 (obligació legal creixent al sector).']);
    a.push(['Sempre', 'Retribució flexible + salut col·lectiva com a eina de retenció de conductors.']);
    return a;
  }

  // ---------- cua de treball ----------
  let pFilter = 'avui';
  let pSearch = '';
  let pProv = '';

  function aplicaCercaProv(list) {
    let l = list;
    if (pProv) l = l.filter(p => (p.provincia || '') === pProv);
    if (pSearch) {
      const q = pSearch.toLowerCase();
      l = l.filter(p => (p.empresa || '').toLowerCase().includes(q) || (p.municipi || '').toLowerCase().includes(q) || (p.cif || '').toLowerCase().includes(q) || (p.contacte || '').toLowerCase().includes(q));
    }
    return l;
  }

  function comptes() {
    const all = P();
    const trucables = all.filter(p => !p.no_trucar && !['No interessa', 'Convertit'].includes(p.estat));
    const avui = trucables.filter(p => (p.num_intents || 0) === 0 || (p.propera_accio_data && new Date(p.propera_accio_data) <= todayMid()));
    const mai = trucables.filter(p => (p.num_intents || 0) === 0);
    const interessats = all.filter(p => p.estat === 'Interessat');
    const callbacks = all.filter(p => p.propera_accio_data);
    return { avui, mai, interessats, callbacks, tots: all, trucables };
  }

  function getCua() {
    const c = comptes();
    let base;
    if (pFilter === 'avui') base = c.avui;
    else if (pFilter === 'mai') base = c.mai;
    else if (pFilter === 'interessats') base = c.interessats;
    else if (pFilter === 'callbacks') base = c.callbacks;
    else base = c.tots;
    base = aplicaCercaProv(base);
    return base.sort((a, b) => {
      const pa = (PRIO_ORD[b.prioritat] || 0) - (PRIO_ORD[a.prioritat] || 0);
      if (pa !== 0) return pa;
      const da = a.propera_accio_data ? new Date(a.propera_accio_data) : new Date('2100-01-01');
      const db = b.propera_accio_data ? new Date(b.propera_accio_data) : new Date('2100-01-01');
      return da - db;
    });
  }

  // ---------- vista principal ----------
  window.renderProspeccio = function () {
    const c = document.getElementById('tab-content');
    if (!c) return;
    const cnt = comptes();
    const trucadesAvui = T().filter(t => isToday(t.data)).length;
    const callbacksAvui = cnt.tots.filter(p => isToday(p.propera_accio_data)).length;
    const convertitsMes = P().filter(p => p.estat === 'Convertit').length;
    const provincies = [...new Set(P().map(p => p.provincia).filter(Boolean))].sort();
    const cua = getCua();

    c.innerHTML = `
      <div class="topbar">
        <div><div class="page-title">☎️ Centre de trucades</div><div class="page-sub">La teva cua de treball comercial</div></div>
        <div class="topbar-actions">
          <button class="btn btn-primary" onclick="obrirProspecteModal()">+ Nou prospecte</button>
        </div>
      </div>

      <div class="pr-kpis">
        <div class="pr-kpi accent"><div class="pr-kpi-label">Per trucar avui</div><div class="pr-kpi-value">${cnt.avui.length}</div><div class="pr-kpi-sub">a la cua</div></div>
        <div class="pr-kpi"><div class="pr-kpi-label">Trucades avui</div><div class="pr-kpi-value">${trucadesAvui}</div><div class="pr-kpi-sub">registrades</div></div>
        <div class="pr-kpi"><div class="pr-kpi-label">Callbacks avui</div><div class="pr-kpi-value">${callbacksAvui}</div><div class="pr-kpi-sub">programats</div></div>
        <div class="pr-kpi"><div class="pr-kpi-label">Interessats</div><div class="pr-kpi-value">${cnt.interessats.length}</div><div class="pr-kpi-sub">a seguir</div></div>
        <div class="pr-kpi"><div class="pr-kpi-label">Convertits</div><div class="pr-kpi-value">${convertitsMes}</div><div class="pr-kpi-sub">en clients</div></div>
      </div>

      <div class="pr-filters">
        <div class="pr-chip ${pFilter === 'avui' ? 'active' : ''}" onclick="prSetFilter('avui')">Per trucar avui<span class="n">${cnt.avui.length}</span></div>
        <div class="pr-chip ${pFilter === 'mai' ? 'active' : ''}" onclick="prSetFilter('mai')">Mai trucats<span class="n">${cnt.mai.length}</span></div>
        <div class="pr-chip ${pFilter === 'interessats' ? 'active' : ''}" onclick="prSetFilter('interessats')">Interessats<span class="n">${cnt.interessats.length}</span></div>
        <div class="pr-chip ${pFilter === 'callbacks' ? 'active' : ''}" onclick="prSetFilter('callbacks')">Callbacks<span class="n">${cnt.callbacks.length}</span></div>
        <div class="pr-chip ${pFilter === 'tots' ? 'active' : ''}" onclick="prSetFilter('tots')">Tots<span class="n">${cnt.tots.length}</span></div>
        <div style="flex:1"></div>
        <input type="text" placeholder="Cerca empresa, municipi…" value="${esc(pSearch)}" oninput="prSearch(this.value)" style="max-width:220px;font-size:13px;padding:7px 10px;border-radius:var(--r-sm);border:1px solid var(--border-2)">
        ${provincies.length ? `<select onchange="prSetProv(this.value)" style="font-size:13px;padding:7px 10px;border-radius:var(--r-sm);border:1px solid var(--border-2)"><option value="">Tota província</option>${provincies.map(pv => `<option ${pv === pProv ? 'selected' : ''}>${esc(pv)}</option>`).join('')}</select>` : ''}
      </div>

      <div class="card" style="padding:0">
        ${cua.length === 0 ? emptyCua() : cua.map(rowCua).join('')}
      </div>
    `;
  };

  function emptyCua() {
    if (P().length === 0) {
      return `<div class="empty-state"><div class="empty-icon">☎️</div>Encara no tens prospectes.<br><span style="font-size:12px">Crea'n un a mà o, quan la còpia de seguretat funcioni, hi carreguem els 644 de Lleida.</span><br><br><button class="btn btn-primary" onclick="obrirProspecteModal()">+ Nou prospecte</button></div>`;
    }
    return `<div class="empty-state"><div class="empty-icon">✓</div>Cap prospecte en aquest filtre. Bona feina!</div>`;
  }

  function rowCua(p) {
    const tr = trucadesDe(p.id);
    const ult = tr[0];
    const venc = p.venciment ? daysFromNow(p.venciment) : null;
    const hook = (venc !== null && venc >= -15 && venc <= 130) ? `Venciment ${fmtDate(p.venciment)}` : (p.adr ? 'ADR' : (p.conveni ? 'Conveni' : ''));
    const meta = [];
    meta.push(p.municipi || p.provincia || '—');
    if (p.telefon || p.mobil) meta.push('📞 ' + esc(p.telefon || p.mobil));
    if (p.vehicles_total) meta.push(p.vehicles_total + ' vehicles');
    if (ult) meta.push('últim: ' + esc(ult.resultat || '—') + ' · ' + fmtDate(ult.data));
    else meta.push('mai trucat');
    return `
      <div class="pr-row" onclick="obrirTrucada('${p.id}')">
        <span class="pr-prio ${p.prioritat || 'Mitjana'}" title="Prioritat ${esc(p.prioritat || 'Mitjana')}"></span>
        <div class="pr-row-main">
          <div class="pr-row-emp">${esc(p.empresa)}</div>
          <div class="pr-row-meta">${meta.map(m => `<span>${m}</span>`).join('<span>·</span>')}</div>
        </div>
        <div class="pr-row-right">
          ${hook ? `<span class="pr-hook">${esc(hook)}</span>` : ''}
          <span class="pill p-gray">${esc(p.estat || 'Nou')}</span>
        </div>
      </div>`;
  }

  window.prSetFilter = f => { pFilter = f; renderProspeccio(); };
  window.prSearch = v => { pSearch = v; const cua = getCua(); const card = document.querySelector('#tab-content .card'); if (card) card.innerHTML = cua.length === 0 ? emptyCua() : cua.map(rowCua).join(''); };
  window.prSetProv = v => { pProv = v; renderProspeccio(); };

  // ---------- mode trucada ----------
  window.obrirTrucada = function (id) {
    const p = P().find(x => x.id === id);
    if (!p) return;
    const tr = trucadesDe(id);
    const comp = completesa(p);
    const args = argumentsSuggerits(p);
    const tel = p.mobil || p.telefon || '';
    const signals = [];
    if (p.adr) signals.push('ADR'); if (p.conveni) signals.push('Conveni'); if (p.frigorific) signals.push('Frigorífic');
    if (p.telematica) signals.push('Telemàtica'); if (p.naus) signals.push('Naus'); if (p.nis2_ciber) signals.push('Ciber/NIS2');
    if (p.ambit && /interna/i.test(p.ambit)) signals.push('Internacional');

    const f = (label, key, opts) => {
      const v = p[key] == null ? '' : p[key];
      const todo = (v === '' || v === null) ? 'todo' : '';
      if (opts) {
        return `<div class="pr-field ${todo}"><label>${label}</label><select id="pf-${key}">${opts.map(o => `<option ${String(v) === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
      }
      return `<div class="pr-field ${todo}"><label>${label}</label><input id="pf-${key}" value="${esc(v)}"></div>`;
    };

    const html = `
      <div class="pr-call-overlay" onclick="if(event.target===this)tancarTrucada()">
        <div class="pr-call">
          <div class="pr-call-head">
            <div>
              <h2>${esc(p.empresa)}</h2>
              <div class="sub">${esc(p.municipi || '')}${p.provincia ? ' · ' + esc(p.provincia) : ''}${p.cif ? ' · ' + esc(p.cif) : ''} · <span class="pill p-gray">${esc(p.estat || 'Nou')}</span></div>
            </div>
            <button class="btn" onclick="tancarTrucada()">✕</button>
          </div>

          <div class="pr-call-body">
            <div class="pr-col">
              <div class="pr-sec-t">Fitxa · ${comp}% completa</div>
              <div class="pr-complete"><div class="pr-complete-bar" style="width:${comp}%"></div></div>
              ${signals.length ? `<div class="pr-signals">${signals.map(s => `<span class="pr-sig">${s}</span>`).join('')}</div>` : ''}
              <div class="pr-grid2">
                ${f('Persona contacte', 'contacte')}
                ${f('Càrrec', 'carrec')}
                ${f('Telèfon', 'telefon')}
                ${f('Mòbil', 'mobil')}
                ${f('Email', 'contacte_email')}
                ${f('Treballadors', 'treballadors')}
                ${f('Tipus', 'tipus_transport', ['', 'Mercaderies', 'Viatgers', 'Logística'])}
                ${f('Àmbit', 'ambit', ['', 'Local', 'Nacional', 'Internacional'])}
                ${f('Vehicles (total)', 'vehicles_total')}
                ${f('Facturació', 'facturacio')}
                ${f('Venciment', 'venciment')}
                ${f('Asseguradora actual', 'asseguradora_actual')}
              </div>
              <div class="pr-field"><label>Notes de la fitxa</label><textarea id="pf-notes" rows="2">${esc(p.notes || '')}</textarea></div>
              <button class="btn btn-sm" onclick="desaDadesTrucada('${p.id}')">💾 Desar dades</button>
            </div>

            <div class="pr-col">
              <div class="pr-sec-t">Arguments per a la trucada</div>
              <div class="pr-args">
                ${args.map(a => `<div class="pr-arg"><b>${esc(a[0])}</b><p>${esc(a[1])}</p></div>`).join('')}
              </div>
              <div class="pr-sec-t">Historial (${tr.length})</div>
              <div class="pr-hist">
                ${tr.length === 0 ? '<div style="font-size:12px;color:var(--text-3);padding:6px 0">Cap trucada encara.</div>' : tr.map(t => `
                  <div class="pr-hist-item">
                    <span class="pr-hist-res">${esc(t.resultat || '—')}</span> <span class="pr-hist-when">· ${fmtDate(t.data)}</span>
                    ${t.resum ? `<div style="color:var(--text-2);margin-top:2px">${esc(t.resum)}</div>` : ''}
                    ${t.callback_data ? `<div style="color:var(--info);margin-top:2px">↻ Tornar a trucar: ${fmtDate(t.callback_data)}</div>` : ''}
                  </div>`).join('')}
              </div>
            </div>
          </div>

          <div class="pr-call-foot">
            <div class="pr-call-tel">
              ${tel ? `<a class="pr-tel-btn" href="tel:${esc(tel)}">📞 Trucar</a><span class="pr-tel-num">${esc(tel)}</span>` : '<span style="font-size:12px;color:var(--text-3)">Sense telèfon — afegeix-lo a la fitxa</span>'}
            </div>
            <div class="pr-field"><label>Resum de la conversa</label><textarea id="pf-resum" rows="2" placeholder="Què s'ha parlat…"></textarea></div>
            <div class="pr-disp">
              <button onclick="registrarTrucada('${p.id}','No contesta')">No contesta</button>
              <button onclick="registrarTrucada('${p.id}','Comunica')">Comunica</button>
              <button class="bad" onclick="registrarTrucada('${p.id}','No interessa')">No interessa</button>
              <button class="warn" onclick="prCallback('${p.id}')">↻ Tornar a trucar…</button>
              <button class="good" onclick="registrarTrucada('${p.id}','Interessat')">Interessat</button>
              <button class="good" onclick="registrarTrucada('${p.id}','Cita')">Cita / Visita</button>
            </div>
          </div>
        </div>
      </div>`;
    document.getElementById('modal-container').innerHTML = html;
  };

  window.tancarTrucada = () => { document.getElementById('modal-container').innerHTML = ''; };

  // recull els camps editats de la fitxa al mode trucada
  function recullDades(id) {
    const get = k => { const el = document.getElementById('pf-' + k); return el ? el.value.trim() : undefined; };
    const numOrNull = v => (v === '' || v == null) ? null : (isNaN(parseFloat(v)) ? null : parseFloat(v));
    const txtOrNull = v => (v === '' || v == null) ? null : v;
    return {
      contacte: get('contacte'), carrec: get('carrec'), telefon: get('telefon'), mobil: get('mobil'),
      contacte_email: get('contacte_email'), treballadors: get('treballadors'),
      tipus_transport: txtOrNull(get('tipus_transport')), ambit: txtOrNull(get('ambit')),
      vehicles_total: numOrNull(get('vehicles_total')), facturacio: get('facturacio'),
      venciment: txtOrNull(get('venciment')), asseguradora_actual: get('asseguradora_actual'),
      notes: get('notes')
    };
  }

  window.desaDadesTrucada = async function (id) {
    const dades = recullDades(id);
    try {
      const { error } = await supabase.from('prospectes').update(dades).eq('id', id);
      if (error) throw error;
      await refreshData('prospectes', { silent: true });
      toast('Dades desades');
      obrirTrucada(id);
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  // registrar resultat de trucada → insereix trucada + actualitza prospecte
  window.registrarTrucada = async function (id, resultat, callbackData) {
    const p = P().find(x => x.id === id);
    if (!p) return;
    const resumEl = document.getElementById('pf-resum');
    const resum = resumEl ? resumEl.value.trim() : '';
    const dades = recullDades(id) || {};

    // mapeig resultat → estat
    let estat = p.estat;
    if (resultat === 'Interessat') estat = 'Interessat';
    else if (resultat === 'Cita') estat = 'Visita';
    else if (resultat === 'No interessa') estat = 'No interessa';
    else if (['No contesta', 'Comunica'].includes(resultat) && (p.estat === 'Nou' || !p.estat)) estat = 'No contacta';
    else if (resultat === 'Tornar a trucar' && (p.estat === 'Nou' || !p.estat)) estat = 'Contactat';

    const updates = {
      ...dades,
      estat,
      darrera_trucada: new Date().toISOString().slice(0, 10),
      num_intents: (p.num_intents || 0) + 1,
      propera_accio: callbackData ? 'Tornar a trucar' : null,
      propera_accio_data: callbackData || null
    };

    try {
      const { error: e1 } = await supabase.from('trucades').insert([{
        prospecte_id: id, user_id: state.user.id, mediador_id: state.user.id,
        data: new Date().toISOString(), resultat, resum: resum || null,
        callback_data: callbackData ? new Date(callbackData).toISOString() : null
      }]);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('prospectes').update(updates).eq('id', id);
      if (e2) throw e2;

      await refreshData('trucades', { silent: true });
      await refreshData('prospectes', { silent: true });
      updateNavBadges();

      if (resultat === 'Interessat' || resultat === 'Cita') {
        toast('Registrat — interessat!');
        prBifurcacio(id);
      } else {
        tancarTrucada();
        toast('Trucada registrada');
        renderProspeccio();
      }
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  // programar callback (demana data)
  window.prCallback = function (id) {
    const d = prompt('Tornar a trucar quin dia? (format AAAA-MM-DD)', new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    if (!d) return;
    registrarTrucada(id, 'Tornar a trucar', d);
  };

  // bifurcació quan és interessat
  function prBifurcacio(id) {
    const p = P().find(x => x.id === id);
    if (!p) return;
    const html = `
      <div class="modal-overlay" onclick="if(event.target===this)tancarTrucada()">
        <div class="modal" style="max-width:440px">
          <div class="modal-title">Interessat! I ara?</div>
          <div class="modal-sub">${esc(p.empresa)} — tria el següent pas</div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
            <button class="btn btn-primary" onclick="convertirEnClient('${id}')">→ Convertir en client</button>
            <button class="btn" onclick="crearOportunitatProspecte('${id}')">+ Crear oportunitat</button>
            <button class="btn" onclick="tancarTrucada();renderProspeccio()">Deixar-ho per ara (seguir trucant)</button>
          </div>
        </div>
      </div>`;
    document.getElementById('modal-container').innerHTML = html;
  }

  window.convertirEnClient = async function (id) {
    const p = P().find(x => x.id === id);
    if (!p) return;
    try {
      const nou = {
        user_id: state.user.id,
        empresa: p.empresa, cif: p.cif, sector: 'Transport mercaderies',
        treballadors: p.treballadors, contacte: p.contacte, carrec: p.carrec,
        email: p.contacte_email, telefon: p.mobil || p.telefon, adreca: p.adreca,
        facturacio: p.facturacio,
        notes: `Origen: prospecció (${p.municipi || ''}). ${p.notes || ''}`.trim()
      };
      const { data, error } = await supabase.from('clients').insert([nou]).select().single();
      if (error) throw error;
      await supabase.from('prospectes').update({ estat: 'Convertit', convertit_client_id: data?.id || null }).eq('id', id);
      await refreshData('clients', { silent: true });
      await refreshData('prospectes', { silent: true });
      updateNavBadges();
      tancarTrucada();
      toast('Convertit en client ✓');
      renderProspeccio();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  window.crearOportunitatProspecte = async function (id) {
    const p = P().find(x => x.id === id);
    if (!p) return;
    const args = argumentsSuggerits(p);
    const producte = prompt('Producte / ram de l\'oportunitat:', args[0] ? args[0][0] : '');
    if (!producte) return;
    try {
      const { error } = await supabase.from('oportunitats').insert([{
        user_id: state.user.id, empresa: p.empresa, producte,
        argument: args[0] ? args[0][1] : '', prioritat: p.prioritat || 'Mitjana', estat: 'Detectada'
      }]);
      if (error) throw error;
      await refreshData('oportunitats', { silent: true });
      updateNavBadges();
      tancarTrucada();
      toast('Oportunitat creada ✓');
      renderProspeccio();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  // ---------- nou / editar prospecte ----------
  window.obrirProspecteModal = function (id) {
    const p = id ? P().find(x => x.id === id) : {};
    const g = (k, d = '') => p && p[k] != null ? p[k] : d;
    const chk = k => p && p[k] ? 'checked' : '';
    const opt = (k, arr) => arr.map(o => `<option ${String(g(k)) === o ? 'selected' : ''}>${o}</option>`).join('');
    const html = `
      <div class="modal-overlay" onclick="if(event.target===this)tancarTrucada()">
        <div class="modal" style="max-width:620px">
          <div class="modal-title">${id ? 'Editar' : 'Nou'} prospecte</div>
          <div class="modal-sub">Empresa de la base de trucades</div>
          <div class="form-grid">
            <div class="form-row"><label>Empresa *</label><input id="np-empresa" value="${esc(g('empresa'))}"></div>
            <div class="form-row"><label>CIF</label><input id="np-cif" value="${esc(g('cif'))}"></div>
          </div>
          <div class="form-grid-3">
            <div class="form-row"><label>Municipi</label><input id="np-municipi" value="${esc(g('municipi'))}"></div>
            <div class="form-row"><label>Província</label><input id="np-provincia" value="${esc(g('provincia'))}"></div>
            <div class="form-row"><label>Telèfon</label><input id="np-telefon" value="${esc(g('telefon'))}"></div>
          </div>
          <div class="form-grid-3">
            <div class="form-row"><label>Contacte</label><input id="np-contacte" value="${esc(g('contacte'))}"></div>
            <div class="form-row"><label>Càrrec</label><input id="np-carrec" value="${esc(g('carrec'))}"></div>
            <div class="form-row"><label>Mòbil</label><input id="np-mobil" value="${esc(g('mobil'))}"></div>
          </div>
          <div class="form-grid-3">
            <div class="form-row"><label>Tipus</label><select id="np-tipus_transport"><option value=""></option>${opt('tipus_transport', ['Mercaderies', 'Viatgers', 'Logística'])}</select></div>
            <div class="form-row"><label>Àmbit</label><select id="np-ambit"><option value=""></option>${opt('ambit', ['Local', 'Nacional', 'Internacional'])}</select></div>
            <div class="form-row"><label>Vehicles</label><input id="np-vehicles_total" type="number" value="${esc(g('vehicles_total'))}"></div>
          </div>
          <div class="form-grid-3">
            <div class="form-row"><label>Treballadors</label><input id="np-treballadors" value="${esc(g('treballadors'))}"></div>
            <div class="form-row"><label>Facturació</label><input id="np-facturacio" value="${esc(g('facturacio'))}"></div>
            <div class="form-row"><label>Venciment</label><input id="np-venciment" type="date" value="${esc(g('venciment'))}"></div>
          </div>
          <div class="form-grid-3">
            <div class="form-row"><label>Prioritat</label><select id="np-prioritat">${opt('prioritat', ['Alta', 'Mitjana', 'Baixa'])}</select></div>
            <div class="form-row"><label>Campanya</label><input id="np-campanya" value="${esc(g('campanya'))}" placeholder="ex: Lleida ADR"></div>
            <div class="form-row"><label>Origen</label><input id="np-origen" value="${esc(g('origen', 'Manual'))}"></div>
          </div>
          <div class="form-row" style="display:flex;gap:16px;flex-wrap:wrap;margin-top:4px">
            <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="np-adr" ${chk('adr')} style="width:auto"> ADR</label>
            <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="np-conveni" ${chk('conveni')} style="width:auto"> Conveni</label>
            <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="np-frigorific" ${chk('frigorific')} style="width:auto"> Frigorífic</label>
            <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="np-telematica" ${chk('telematica')} style="width:auto"> Telemàtica</label>
            <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="np-no_trucar" ${chk('no_trucar')} style="width:auto"> No trucar (RGPD)</label>
          </div>
          <div class="form-row"><label>Notes</label><textarea id="np-notes">${esc(g('notes'))}</textarea></div>
          <div class="modal-actions">
            ${id ? `<button class="btn" onclick="esborraProspecte('${id}')" style="color:var(--danger);margin-right:auto">🗑 Esborrar</button>` : ''}
            <button class="btn" onclick="tancarTrucada()">Cancel·lar</button>
            <button class="btn btn-primary" onclick="desaProspecte('${id || ''}')">Desar</button>
          </div>
        </div>
      </div>`;
    document.getElementById('modal-container').innerHTML = html;
  };

  window.desaProspecte = async function (id) {
    const v = k => { const el = document.getElementById('np-' + k); return el ? el.value.trim() : ''; };
    const cb = k => { const el = document.getElementById('np-' + k); return el ? el.checked : false; };
    const empresa = v('empresa');
    if (!empresa) { toast('Empresa obligatòria', 'error'); return; }
    const numOrNull = x => x === '' ? null : (isNaN(parseFloat(x)) ? null : parseFloat(x));
    const txtOrNull = x => x === '' ? null : x;
    const obj = {
      empresa, cif: v('cif'), municipi: v('municipi'), provincia: v('provincia'),
      telefon: v('telefon'), contacte: v('contacte'), carrec: v('carrec'), mobil: v('mobil'),
      tipus_transport: txtOrNull(v('tipus_transport')), ambit: txtOrNull(v('ambit')),
      vehicles_total: numOrNull(v('vehicles_total')), treballadors: v('treballadors'),
      facturacio: v('facturacio'), venciment: txtOrNull(v('venciment')),
      prioritat: v('prioritat') || 'Mitjana', campanya: v('campanya'), origen: v('origen'),
      adr: cb('adr'), conveni: cb('conveni'), frigorific: cb('frigorific'),
      telematica: cb('telematica'), no_trucar: cb('no_trucar'), notes: v('notes')
    };
    try {
      if (id) {
        const { error } = await supabase.from('prospectes').update(obj).eq('id', id);
        if (error) throw error;
      } else {
        obj.user_id = state.user.id;
        obj.estat = 'Nou';
        const { error } = await supabase.from('prospectes').insert([obj]);
        if (error) throw error;
      }
      await refreshData('prospectes', { silent: true });
      updateNavBadges();
      tancarTrucada();
      toast('Prospecte desat');
      renderProspeccio();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  window.esborraProspecte = async function (id) {
    if (!confirm('Esborrar aquest prospecte i el seu historial de trucades?')) return;
    try {
      const { error } = await supabase.from('prospectes').delete().eq('id', id);
      if (error) throw error;
      await refreshData('prospectes', { silent: true });
      await refreshData('trucades', { silent: true });
      updateNavBadges();
      tancarTrucada();
      toast('Prospecte esborrat');
      renderProspeccio();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  console.log('☎️ Mòdul Prospecció carregat');
})();
