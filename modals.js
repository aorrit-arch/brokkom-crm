// ==================================================================
// BROKKOM CRM v2 — Modals i IA
// ==================================================================

window.openModal = (type, data = {}) => {
  let html = '';

  if (type === 'client') {
    html = `
      <div class="modal-title">${data.id?'Editar':'Nou'} client</div>
      <div class="form-grid">
        <div class="form-row"><label>Empresa *</label><input type="text" id="m-empresa" value="${data.empresa||''}"></div>
        <div class="form-row"><label>CIF</label><input type="text" id="m-cif" value="${data.cif||''}"></div>
      </div>
      <div class="form-grid">
        <div class="form-row"><label>Sector</label><select id="m-sector">
          <option value="">—</option>
          ${['Transport mercaderies','Logística','Transport viatgers','ADR / mercaderies perilloses','Altres'].map(s => `<option ${data.sector===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="form-row"><label>Treballadors</label><input type="text" id="m-treballadors" value="${data.treballadors||''}"></div>
      </div>
      <div class="form-grid">
        <div class="form-row"><label>Contacte</label><input type="text" id="m-contacte" value="${data.contacte||''}"></div>
        <div class="form-row"><label>Càrrec</label><input type="text" id="m-carrec" value="${data.carrec||''}"></div>
      </div>
      <div class="form-grid">
        <div class="form-row"><label>Email</label><input type="email" id="m-email" value="${data.email||''}"></div>
        <div class="form-row"><label>Telèfon</label><input type="tel" id="m-telefon" value="${data.telefon||''}"></div>
      </div>
      <div class="form-row"><label>Adreça</label><input type="text" id="m-adreca" value="${data.adreca||''}"></div>
      <div class="form-row"><label>Facturació</label><input type="text" id="m-facturacio" value="${data.facturacio||''}"></div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes">${data.notes||''}</textarea></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveClient('${data.id||''}')">Guardar</button>
      </div>
    `;
  } else if (type === 'oferta') {
    html = `
      <div class="modal-title">${data.id?'Editar':'Nova'} oferta</div>
      <div class="form-row"><label>Client *</label><select id="m-client_id">
        <option value="">— selecciona —</option>
        ${state.clients.map(c => `<option value="${c.id}" ${c.id===data.client_id?'selected':''}>${c.empresa}</option>`).join('')}
      </select></div>
      <div class="form-grid">
        <div class="form-row"><label>Ram</label><select id="m-ram">
          <option value="">—</option>
          ${state.config.rams.map(r => `<option ${data.ram===r?'selected':''}>${r}</option>`).join('')}
        </select></div>
        <div class="form-row"><label>Asseguradora actual</label><select id="m-asseguradora_actual">
          <option value="">—</option>
          ${state.asseguradores.map(a => `<option ${data.asseguradora_actual===a.nom?'selected':''}>${a.nom}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-grid-3">
        <div class="form-row"><label>Prima actual</label><input type="number" id="m-prima_actual" value="${data.prima_actual||''}" step="0.01"></div>
        <div class="form-row"><label>Prima Brokkom</label><input type="number" id="m-prima_brokkom" value="${data.prima_brokkom||''}" step="0.01"></div>
        <div class="form-row"><label>Asseguradora prop.</label><select id="m-asseguradora">
          <option value="">—</option>
          ${state.asseguradores.map(a => `<option ${data.asseguradora===a.nom?'selected':''}>${a.nom}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row"><label>Estat</label><select id="m-estat">
        ${[...ESTATS_PIPELINE, ESTATS_PERDUDA].map(e => `<option ${data.estat===e?'selected':''}>${e}</option>`).join('')}
      </select></div>
      <div class="form-grid">
        <div class="form-row"><label>Data oferta</label><input type="date" id="m-data_oferta" value="${data.data_oferta||new Date().toISOString().slice(0,10)}"></div>
        <div class="form-row"><label>Venciment</label><input type="date" id="m-venciment" value="${data.venciment||''}"></div>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes">${data.notes||''}</textarea></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveOferta('${data.id||''}')">Guardar</button>
      </div>
    `;
  } else if (type === 'consolidat') {
    html = `
      <div class="modal-title">Tancar com a guanyada</div>
      <div class="modal-sub">Passarà a Consolidats</div>
      <div class="form-row"><label>Client *</label><select id="m-client_id">
        ${state.clients.map(c => `<option value="${c.id}" ${c.id===data.client_id?'selected':''}>${c.empresa}</option>`).join('')}
      </select></div>
      <div class="form-grid">
        <div class="form-row"><label>Ram</label><select id="m-ram">${state.config.rams.map(r => `<option ${data.ram===r?'selected':''}>${r}</option>`).join('')}</select></div>
        <div class="form-row"><label>Asseguradora</label><select id="m-asseguradora">${state.asseguradores.map(a => `<option ${data.asseguradora===a.nom?'selected':''}>${a.nom}</option>`).join('')}</select></div>
      </div>
      <div class="form-grid">
        <div class="form-row"><label>Núm. pòlissa</label><input type="text" id="m-num_polissa" placeholder="Per ERP"></div>
        <div class="form-row"><label>Data tancament *</label><input type="date" id="m-data_tancament" value="${new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="form-row"><label>Prima anual *</label><input type="number" id="m-prima_anual" value="${data.prima_brokkom||''}" step="0.01"></div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes"></textarea></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveConsolidat('${data._fromOfertaId||''}')">Tancar guanyada</button>
      </div>
    `;
  } else if (type === 'seguiment') {
    html = `
      <div class="modal-title">Nou seguiment</div>
      <div class="form-row"><label>Client *</label><select id="m-client_id">
        <option value="">—</option>
        ${state.clients.map(c => `<option value="${c.id}" ${c.id===data.client_id?'selected':''}>${c.empresa}</option>`).join('')}
      </select></div>
      <div class="form-grid">
        <div class="form-row"><label>Data</label><input type="date" id="m-data" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="form-row"><label>Canal</label><select id="m-canal"><option>Email</option><option>Telèfon</option><option>Reunió</option><option>WhatsApp</option><option>Altres</option></select></div>
      </div>
      <div class="form-row"><label>Resum</label><textarea id="m-resum"></textarea></div>
      <div class="form-row"><label>Proper pas</label><input type="text" id="m-proper_pas"></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveSeguiment()">Guardar</button>
      </div>
    `;
  } else if (type === 'venciment') {
    html = `
      <div class="modal-title">Nou venciment</div>
      <div class="form-row"><label>Empresa *</label><input type="text" id="m-empresa"></div>
      <div class="form-grid">
        <div class="form-row"><label>Ram</label><select id="m-ram">${state.config.rams.map(r => `<option>${r}</option>`).join('')}</select></div>
        <div class="form-row"><label>Asseguradora</label><select id="m-asseguradora"><option value="">—</option>${state.asseguradores.map(a => `<option>${a.nom}</option>`).join('')}</select></div>
      </div>
      <div class="form-grid">
        <div class="form-row"><label>Data venciment *</label><input type="date" id="m-data_venciment"></div>
        <div class="form-row"><label>Prima actual</label><input type="number" id="m-prima_actual" step="0.01"></div>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes"></textarea></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveVenciment()">Guardar</button>
      </div>
    `;
  } else if (type === 'tasca') {
    html = `
      <div class="modal-title">Nova tasca</div>
      <div class="form-row"><label>Títol *</label><input type="text" id="m-titol"></div>
      <div class="form-row"><label>Descripció</label><textarea id="m-descripcio"></textarea></div>
      <div class="form-grid-3">
        <div class="form-row"><label>Prioritat</label><select id="m-prioritat"><option>Alta</option><option selected>Mitjana</option><option>Baixa</option></select></div>
        <div class="form-row"><label>Categoria</label><select id="m-categoria"><option value="comercial">Comercial</option><option value="seguiment">Seguiment</option><option value="admin">Admin</option><option value="comunicacio">Comunicació</option></select></div>
        <div class="form-row"><label>Data límit</label><input type="date" id="m-data_limit"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveTasca()">Guardar</button>
      </div>
    `;
  } else if (type === 'asseguradora') {
    html = `
      <div class="modal-title">Nova asseguradora</div>
      <div class="form-row"><label>Nom *</label><input type="text" id="m-nom"></div>
      <div class="form-row"><label>Rams (separats per coma)</label><input type="text" id="m-rams"></div>
      <div class="form-grid-3">
        <div class="form-row"><label>Contacte</label><input type="text" id="m-contacte_intern"></div>
        <div class="form-row"><label>Email</label><input type="email" id="m-email"></div>
        <div class="form-row"><label>Telèfon</label><input type="tel" id="m-telefon"></div>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes"></textarea></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveAsseguradora()">Guardar</button>
      </div>
    `;
  }

  document.getElementById('modal-container').innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
};

window.closeModal = () => { document.getElementById('modal-container').innerHTML = ''; };

const getVal = id => document.getElementById(id)?.value || null;
const getNum = id => { const v = parseFloat(getVal(id)); return isNaN(v) ? null : v; };

window.saveClient = async (id) => {
  const empresa = getVal('m-empresa')?.trim();
  if (!empresa) { toast('Empresa obligatòria','error'); return; }
  const data = {
    empresa, cif: getVal('m-cif'), sector: getVal('m-sector'), treballadors: getVal('m-treballadors'),
    contacte: getVal('m-contacte'), carrec: getVal('m-carrec'), email: getVal('m-email'),
    telefon: getVal('m-telefon'), adreca: getVal('m-adreca'), facturacio: getVal('m-facturacio'),
    notes: getVal('m-notes')
  };
  let err;
  if (id) { ({ error: err } = await supabase.from('clients').update(data).eq('id', id)); }
  else { data.user_id = state.user.id; ({ error: err } = await supabase.from('clients').insert(data)); }
  if (err) { toast('Error: '+err.message,'error'); return; }
  await refreshData('clients');
  closeModal();
  showTab('clients');
  toast('Guardat');
};

window.saveOferta = async (id) => {
  const client_id = getVal('m-client_id');
  if (!client_id) { toast('Selecciona client','error'); return; }
  const estat = getVal('m-estat');
  const data = {
    client_id, ram: getVal('m-ram'),
    asseguradora_actual: getVal('m-asseguradora_actual'),
    asseguradora: getVal('m-asseguradora'),
    prima_actual: getNum('m-prima_actual'),
    prima_brokkom: getNum('m-prima_brokkom'),
    estat, data_oferta: getVal('m-data_oferta'),
    venciment: getVal('m-venciment') || null,
    notes: getVal('m-notes'),
    empresa: state.clients.find(c=>c.id===client_id)?.empresa
  };
  if (estat === 'Tancada guanyada') {
    if (id) await supabase.from('ofertes').delete().eq('id', id);
    closeModal();
    openModal('consolidat', { ...data, _fromOfertaId: id });
    return;
  }
  let err;
  if (id) { ({ error: err } = await supabase.from('ofertes').update(data).eq('id', id)); }
  else { data.user_id = state.user.id; ({ error: err } = await supabase.from('ofertes').insert(data)); }
  if (err) { toast('Error: '+err.message,'error'); return; }
  await refreshData('ofertes');
  closeModal();
  showTab('pipeline');
  toast('Guardat');
};

window.saveConsolidat = async (fromOfertaId) => {
  const client_id = getVal('m-client_id');
  const prima = getNum('m-prima_anual');
  if (!client_id || !prima) { toast('Camps obligatoris','error'); return; }
  const cli = state.clients.find(c=>c.id===client_id);
  const data = {
    user_id: state.user.id, client_id, empresa: cli.empresa,
    ram: getVal('m-ram'), asseguradora: getVal('m-asseguradora'),
    num_polissa: getVal('m-num_polissa'),
    data_tancament: getVal('m-data_tancament'),
    prima_anual: prima, notes: getVal('m-notes')
  };
  const { error } = await supabase.from('consolidats').insert(data);
  if (error) { toast('Error: '+error.message,'error'); return; }
  await refreshData('consolidats');
  closeModal();
  showTab('consolidats');
  toast('Tancament registrat ✓');
};

window.saveSeguiment = async () => {
  const client_id = getVal('m-client_id');
  if (!client_id) { toast('Selecciona client','error'); return; }
  const { error } = await supabase.from('seguiments').insert({
    user_id: state.user.id, client_id,
    data: getVal('m-data'), canal: getVal('m-canal'),
    resum: getVal('m-resum'), proper_pas: getVal('m-proper_pas')
  });
  if (error) { toast('Error: '+error.message,'error'); return; }
  await refreshData('seguiments');
  closeModal();
  showTab('seguiments');
  toast('Guardat');
};

window.saveVenciment = async () => {
  const empresa = getVal('m-empresa')?.trim();
  const data_venciment = getVal('m-data_venciment');
  if (!empresa || !data_venciment) { toast('Empresa i data obligatòries','error'); return; }
  const { error } = await supabase.from('venciments').insert({
    user_id: state.user.id, empresa, ram: getVal('m-ram'),
    asseguradora: getVal('m-asseguradora'),
    data_venciment, prima_actual: getNum('m-prima_actual'),
    notes: getVal('m-notes')
  });
  if (error) { toast('Error: '+error.message,'error'); return; }
  await refreshData('venciments');
  closeModal();
  showTab('venciments');
  toast('Guardat');
};

window.saveTasca = async () => {
  const titol = getVal('m-titol')?.trim();
  if (!titol) { toast('Títol obligatori','error'); return; }
  const { error } = await supabase.from('tasques').insert({
    user_id: state.user.id, titol,
    descripcio: getVal('m-descripcio'),
    prioritat: getVal('m-prioritat'),
    categoria: getVal('m-categoria'),
    data_limit: getVal('m-data_limit') || null,
    estat: 'pendent'
  });
  if (error) { toast('Error: '+error.message,'error'); return; }
  await refreshData('tasques');
  closeModal();
  showTab('tasques');
  toast('Guardat');
};

window.saveAsseguradora = async () => {
  const nom = getVal('m-nom')?.trim();
  if (!nom) { toast('Nom obligatori','error'); return; }
  const { error } = await supabase.from('asseguradores').insert({
    nom, rams: getVal('m-rams')?.split(',').map(s=>s.trim()).filter(Boolean) || [],
    contacte_intern: getVal('m-contacte_intern'),
    email: getVal('m-email'), telefon: getVal('m-telefon'),
    notes: getVal('m-notes')
  });
  if (error) { toast('Error: '+error.message,'error'); return; }
  await refreshData('asseguradores');
  closeModal();
  showTab('asseguradores');
  toast('Guardat');
};

// ==================================================================
// IA
// ==================================================================
window.callAnthropicAPI = async (prompt, model) => {
  const modelToUse = model || state.config.model_fast;
  const response = await fetch('/api/ai-proxy', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ model: modelToUse, max_tokens: 2048, messages: [{role:'user', content:prompt}] })
  });
  const text = await response.text();
  let parsed; try { parsed = JSON.parse(text); } catch(e) {}
  if (!response.ok) throw new Error(parsed?.error?.message || text);
  return parsed.content[0].text;
};

window.processarIA = async () => {
  const text = document.getElementById('ia-input').value.trim();
  if (!text) { toast('Enganxa text','error'); return; }
  const div = document.getElementById('ia-result-content');
  document.getElementById('ia-result').classList.remove('hidden');
  div.innerHTML = '<div class="empty-state"><span class="loader"></span> Processant...</div>';
  const prompt = `Ets el CRM de Brokkom (sector transport). Analitza i extreu JSON:
{
  "clients":[{"empresa":"","cif":"","contacte":"","carrec":"","email":"","telefon":"","sector":"","facturacio":"","treballadors":"","adreca":"","notes":""}],
  "ofertes":[{"empresa":"","ram":"","prima_actual":0,"prima_brokkom":0,"asseguradora":"","estat":"Lead|Qualificat|Cotitzant|Oferta enviada|En negociació","notes":""}],
  "venciments":[{"empresa":"","ram":"","data_venciment":"YYYY-MM-DD","prima_actual":0,"asseguradora":""}],
  "oportunitats":[{"empresa":"","producte":"","argument":"","prioritat":"Alta|Mitjana|Baixa"}],
  "seguiments":[{"empresa":"","data":"YYYY-MM-DD","canal":"Email|Telèfon|Reunió|WhatsApp","resum":"","proper_pas":""}],
  "resum":"",
  "alertes":[]
}
Regles: si dada no apareix deixa-la buida; números sense €; en català.

TEXT:
${text}

Retorna NOMÉS JSON.`;
  try {
    const result = await callAnthropicAPI(prompt, state.config.model_fast);
    let parsed;
    try { parsed = JSON.parse(result.replace(/```json\n?|\n?```/g,'').trim()); }
    catch(e) { div.innerHTML = `<div style="white-space:pre-wrap;font-size:13px">${result}</div>`; return; }
    let html = '';
    if (parsed.resum) html += `<div style="padding:12px;background:var(--info-bg);border-radius:var(--radius);margin-bottom:12px;font-size:13px">${parsed.resum}</div>`;
    if (parsed.alertes?.length) html += `<div class="section-title">⚠️ Alertes</div><ul style="font-size:13px;padding-left:20px;margin-bottom:14px">${parsed.alertes.map(a=>`<li>${a}</li>`).join('')}</ul>`;
    const secs = [
      {key:'clients',label:'🏢 Clients',fn:c=>`<strong>${c.empresa}</strong> ${c.cif?'· '+c.cif:''}<br><span style="font-size:11px;color:var(--text-3)">${c.contacte||''} ${c.email||''}</span>`},
      {key:'ofertes',label:'📄 Ofertes',fn:o=>`<strong>${o.empresa}</strong> · ${o.ram}<br><span style="font-size:11px;color:var(--text-3)">${o.prima_actual?fmtEur(o.prima_actual):'?'} → ${o.prima_brokkom?fmtEur(o.prima_brokkom):'?'}</span>`},
      {key:'venciments',label:'📅 Venciments',fn:v=>`<strong>${v.empresa}</strong> · ${v.ram}<br><span style="font-size:11px;color:var(--text-3)">Venciment: ${fmtDate(v.data_venciment)}</span>`},
      {key:'oportunitats',label:'💡 Oportunitats',fn:o=>`<strong>${o.empresa}</strong> · ${o.producte} <span class="pill p-${o.prioritat==='Alta'?'danger':o.prioritat==='Mitjana'?'pend':'success'}">${o.prioritat}</span><br><span style="font-size:11px;color:var(--text-3)">${o.argument}</span>`},
      {key:'seguiments',label:'📞 Seguiments',fn:s=>`<strong>${s.empresa}</strong> · ${s.canal}<br><span style="font-size:11px;color:var(--text-3)">${s.resum}</span>`}
    ];
    secs.forEach(sec => {
      if (parsed[sec.key]?.length) {
        html += `<div class="section-title">${sec.label}</div>`;
        parsed[sec.key].forEach((item,idx) => {
          html += `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px;background:var(--surface-2);border-radius:var(--radius);margin-bottom:6px;font-size:13px"><div style="flex:1">${sec.fn(item)}</div><button class="btn btn-sm" onclick="iaImport('${sec.key}',${idx})">+ Importar</button></div>`;
        });
      }
    });
    div.innerHTML = html || '<div class="empty-state">Cap dada estructurada</div>';
    window._iaParsed = parsed;
  } catch(err) {
    div.innerHTML = `<div style="color:var(--danger)">Error: ${err.message}</div>`;
  }
};

window.iaImport = async (key, idx) => {
  const item = window._iaParsed[key][idx];
  let err;
  if (key === 'clients') {
    ({ error: err } = await supabase.from('clients').insert({ ...item, user_id: state.user.id }));
  } else if (key === 'ofertes') {
    let cli = state.clients.find(c => c.empresa.toLowerCase() === item.empresa?.toLowerCase());
    if (!cli) {
      const { data } = await supabase.from('clients').insert({ empresa: item.empresa, user_id: state.user.id }).select().single();
      cli = data;
      await refreshData('clients');
    }
    ({ error: err } = await supabase.from('ofertes').insert({ ...item, client_id: cli.id, user_id: state.user.id, empresa: cli.empresa, data_oferta: new Date().toISOString().slice(0,10) }));
  } else if (key === 'venciments') {
    ({ error: err } = await supabase.from('venciments').insert({ ...item, user_id: state.user.id }));
  } else if (key === 'oportunitats') {
    let cli = state.clients.find(c => c.empresa.toLowerCase() === item.empresa?.toLowerCase());
    ({ error: err } = await supabase.from('oportunitats').insert({ ...item, client_id: cli?.id, user_id: state.user.id, estat: 'Detectada' }));
  } else if (key === 'seguiments') {
    let cli = state.clients.find(c => c.empresa.toLowerCase() === item.empresa?.toLowerCase());
    if (cli) ({ error: err } = await supabase.from('seguiments').insert({ ...item, client_id: cli.id, user_id: state.user.id }));
  }
  if (err) { toast('Error: '+err.message,'error'); return; }
  await refreshData(key);
  toast('Importat');
};

window.regenerarOportunitats = async () => {
  if (state.clients.length === 0) { toast('Cal tenir clients primer','error'); return; }
  toast('Regenerant amb IA...');
  const prompt = `Per a aquests clients de Brokkom (transport), detecta oportunitats:
- RC Patronal / Mediambiental ADR si tenen flota o conveni
- Telemàtica / Dossier Risc si tenen flota
- Complement IT, pèrdua carnet, CAP per conductors
- Multiriscos i avaria frigorífic per naus
- Pla pensions i vida risc per gerents
- ICC A + crèdit exportació per CMR internacional
- Retribució flexible i salut col·lectiva sempre

Clients: ${JSON.stringify(state.clients.map(c=>({empresa:c.empresa,sector:c.sector,treballadors:c.treballadors,notes:c.notes})))}

Retorna NOMÉS JSON array: [{"empresa":"","producte":"","argument":"","prioritat":"Alta|Mitjana|Baixa"}]`;
  try {
    const result = await callAnthropicAPI(prompt, state.config.model_smart);
    const opps = JSON.parse(result.replace(/```json\n?|\n?```/g,'').trim());
    let added = 0;
    for (const o of opps) {
      const cli = state.clients.find(c => c.empresa.toLowerCase() === o.empresa.toLowerCase());
      if (cli) {
        const ja = state.oportunitats.find(x => x.client_id === cli.id && x.producte === o.producte);
        if (!ja) {
          await supabase.from('oportunitats').insert({ ...o, client_id: cli.id, user_id: state.user.id, estat: 'Detectada' });
          added++;
        }
      }
    }
    await refreshData('oportunitats');
    if (state.currentTab === 'oportunitats') showTab('oportunitats');
    toast(`${added} oportunitats noves`);
  } catch(err) { toast('Error: '+err.message,'error'); }
};

window.iaAccio = async (tipus) => {
  if (tipus === 'clients-fred') {
    const llindar = new Date(); llindar.setDate(llindar.getDate()-15);
    const freds = state.clients.filter(c => {
      const ult = state.seguiments.filter(s => s.client_id === c.id).sort((a,b) => new Date(b.data) - new Date(a.data))[0];
      return !ult || new Date(ult.data) < llindar;
    });
    if (freds.length === 0) { toast('Cap client fred — bona feina!'); return; }
    document.getElementById('ia-result').classList.remove('hidden');
    document.getElementById('ia-result-content').innerHTML = `<div class="section-title">🥶 Clients sense contacte 15+ dies (${freds.length})</div>` + freds.map(c => `<div style="padding:8px;background:var(--surface-2);border-radius:var(--radius);margin-bottom:6px;font-size:13px;display:flex;justify-content:space-between"><strong>${c.empresa}</strong><button class="btn btn-sm" onclick="openModal('seguiment',{client_id:'${c.id}'})">+ Seguiment</button></div>`).join('');
    return;
  }
  let prompt = '';
  if (tipus === 'resum-pipeline') {
    prompt = `Resum executiu del pipeline de Brokkom (3-4 paràgrafs català). Estat, oportunitats, alertes, accions recomanades.\nOfertes: ${JSON.stringify(state.ofertes.slice(0,20))}\nConsolidats últims: ${JSON.stringify(state.consolidats.slice(0,10))}`;
  }
  document.getElementById('ia-result').classList.remove('hidden');
  document.getElementById('ia-result-content').innerHTML = '<div class="empty-state"><span class="loader"></span> Processant...</div>';
  try {
    const result = await callAnthropicAPI(prompt, state.config.model_smart);
    document.getElementById('ia-result-content').innerHTML = `<div style="white-space:pre-wrap;font-size:13px;line-height:1.7">${result}</div>`;
  } catch(err) {
    document.getElementById('ia-result-content').innerHTML = `<div style="color:var(--danger)">Error: ${err.message}</div>`;
  }
};
