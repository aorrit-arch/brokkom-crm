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

// --- Injectar la pestanya al menú i al routing ---
(function bk2InjectaInformes() {
  // 1. Element de menú després de Consolidats
  const ancla = document.querySelector('.nav-item[data-tab="consolidats"]');
  if (ancla && !document.querySelector('.nav-item[data-tab="informes"]')) {
    const el = document.createElement('div');
    el.className = 'nav-item';
    el.dataset.tab = 'informes';
    el.innerHTML = '<span class="nav-item-icon">📈</span><span class="nav-item-text">Informes</span>';
    el.addEventListener('click', () => showTab('informes'));
    ancla.after(el);
  }
  // 2. Routing: embolcallar renderCurrentTab
  const original = window.renderCurrentTab;
  window.renderCurrentTab = function () {
    if (state.currentTab === 'informes') {
      const c = document.getElementById('tab-content');
      if (c) { c.innerHTML = ''; try { return window.renderInformes(); } catch (e) { console.error('renderInformes:', e); } }
    }
    return original();
  };
  // 3. Estils d'impressió addicionals
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
