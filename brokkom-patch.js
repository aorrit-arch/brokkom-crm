// ==================================================================
// BROKKOM CRM · brokkom-patch.js — 08/06/2026
// Es carrega DESPRÉS de modules.js i modals.js.
// Sobreescriu funcions per arreglar la IA i afegir Notes.
// NO toca cap altre fitxer.
// ==================================================================
console.log('🩹 brokkom-patch.js carregant...');

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
      const payload = { ...item, user_id: state.user.id };
      if (!payload.tipus) payload.tipus = 'empresa';
      mustOk(await supabase.from('clients').insert(payload));

    } else if (key === 'venciments') {
      const cid = await _patchTrobaOCreaClient(item.empresa);
      mustOk(await supabase.from('venciments').insert({ ...item, client_id: cid, user_id: state.user.id }));

    } else if (key === 'ofertes') {
      const cid = await _patchTrobaOCreaClient(item.empresa);
      mustOk(await supabase.from('ofertes').insert({
        ...item, client_id: cid, user_id: state.user.id,
        estat: item.estat || 'Lead'
      }));

    } else if (key === 'seguiments') {
      const cid = await _patchTrobaOCreaClient(item.empresa);
      mustOk(await supabase.from('seguiments').insert({
        client_id: cid, user_id: state.user.id,
        data: item.data || new Date().toISOString().slice(0, 10),
        canal: item.canal, resum: item.resum, proper_pas: item.proper_pas
      }));

    } else if (key === 'oportunitats') {
      const cid = await _patchTrobaOCreaClient(item.empresa);
      mustOk(await supabase.from('oportunitats').insert({
        client_id: cid, empresa: item.empresa, user_id: state.user.id,
        producte: item.producte, argument: item.argument,
        prioritat: item.prioritat, estat: 'Detectada'
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
                  <option value="agent" ${u.rol === 'agent' ? 'selected' : ''}>agent</option>
                  <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>admin</option>
                </select>
              ` : `<span class="role-badge ${u.rol === 'admin' ? 'role-admin' : 'role-agent'}">${u.rol || 'agent'}</span>`}
            </td>
            <td>${u.actiu ? '✓' : '✗'}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
};

console.log('✅ brokkom-patch.js carregat (IA + Notes + fixes)');
