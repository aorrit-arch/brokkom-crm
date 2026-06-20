// ==================================================================
// BROKKOM CRM · modals.js v1 — Modals Notion + Share
// ==================================================================
console.log('🪟 modals.js carregat');

window.closeModal = function() {
  document.getElementById('modal-container').innerHTML = '';
};

window.openModal = function(type, data = {}) {
  let html = '';

  if (type === 'client') {
    const isEdit = !!data.id;
    const tipus = data.tipus || 'empresa';
    html = `
      <div class="modal-title">${isEdit?'Editar':'Nou'} client</div>
      <div class="modal-sub">Empresa o particular</div>

      <div class="tipus-toggle">
        <button type="button" class="tipus-opt ${tipus==='empresa'?'active':''}" onclick="document.getElementById('m-tipus').value='empresa';document.querySelectorAll('.tipus-opt').forEach(e=>e.classList.toggle('active', e.textContent.trim().startsWith('🏢')));document.getElementById('camps-empresa').classList.remove('hidden');document.getElementById('camps-particular').classList.add('hidden')">🏢 Empresa</button>
        <button type="button" class="tipus-opt ${tipus==='particular'?'active':''}" onclick="document.getElementById('m-tipus').value='particular';document.querySelectorAll('.tipus-opt').forEach(e=>e.classList.toggle('active', e.textContent.trim().startsWith('👤')));document.getElementById('camps-empresa').classList.add('hidden');document.getElementById('camps-particular').classList.remove('hidden')">👤 Particular</button>
      </div>
      <input type="hidden" id="m-tipus" value="${tipus}">

      <div id="camps-empresa" class="${tipus==='particular'?'hidden':''}">
        <div class="form-grid">
          <div class="form-row"><label>Empresa *</label><input type="text" id="m-empresa" value="${data.empresa||''}"></div>
          <div class="form-row"><label>CIF</label><input type="text" id="m-cif" value="${data.cif||''}"></div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Sector</label>
            <select id="m-sector">
              <option value="">—</option>
              ${(window.SECTORS||[]).map(s => `<option ${data.sector===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Treballadors</label><input type="text" id="m-treballadors" value="${data.treballadors||''}"></div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Contacte principal</label><input type="text" id="m-contacte" value="${data.contacte||''}"></div>
          <div class="form-row"><label>Càrrec</label><input type="text" id="m-carrec" value="${data.carrec||''}" placeholder="Gerent, RRHH, responsable flota..."></div>
        </div>
        <div class="form-row"><label>Facturació</label><input type="text" id="m-facturacio" value="${data.facturacio||''}" placeholder="ex: 4,2M€"></div>
      </div>

      <div id="camps-particular" class="${tipus==='empresa'?'hidden':''}">
        <div class="form-grid">
          <div class="form-row"><label>Nom complet *</label><input type="text" id="m-nom" value="${data.nom||data.empresa||''}"></div>
          <div class="form-row"><label>DNI</label><input type="text" id="m-dni" value="${data.dni||''}"></div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Data naixement</label><input type="date" id="m-data-naix" value="${data.data_naixement||''}"></div>
          <div class="form-row"><label>Professió</label><input type="text" id="m-professio" value="${data.professio||''}"></div>
        </div>
        <div class="form-row"><label>Empresa on treballa</label><input type="text" id="m-empresa-part" value="${data.empresa||''}" placeholder="Pot ser client de Brokkom?"></div>
      </div>

      <div class="form-grid">
        <div class="form-row"><label>Email</label><input type="email" id="m-email" value="${data.email||''}"></div>
        <div class="form-row"><label>Telèfon</label><input type="tel" id="m-telefon" value="${data.telefon||''}"></div>
      </div>
      <div class="form-row"><label>Adreça</label><input type="text" id="m-adreca" value="${data.adreca||''}"></div>

      <div class="form-grid">
        <div class="form-row"><label>Origen</label>
          <select id="m-origen">
            <option value="">—</option>
            ${(window.ORIGENS||[]).map(o => `<option ${data.origen===o?'selected':''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Estat</label>
          <select id="m-estat-cli">
            <option value="prospect" ${data.estat==='prospect'?'selected':''}>Prospect</option>
            <option value="actiu" ${data.estat==='actiu'?'selected':''}>Actiu</option>
            <option value="ex-client" ${data.estat==='ex-client'?'selected':''}>Ex-client</option>
          </select>
        </div>
      </div>

      <div class="form-row"><label>Notes estratègiques</label><textarea id="m-notes" placeholder="Història, peculiaritats, necessitats, oportunitats...">${data.notes||''}</textarea></div>

      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveClient('${data.id||''}')">Guardar</button>
      </div>
    `;
  }

  else if (type === 'oferta') {
    const clientOptions = state.clients.map(c => `<option value="${c.id}" ${c.id===data.client_id?'selected':''}>${c.tipus==='particular'?(c.nom||c.empresa):(c.empresa||c.nom)}</option>`).join('');
    const ramOptions = (state.config?.rams||[]).map(r => `<option ${data.ram===r?'selected':''}>${r}</option>`).join('');
    const assegOptions = state.asseguradores.map(a => `<option ${data.asseguradora===a.nom?'selected':''}>${a.nom}</option>`).join('');
    const estatOptions = [...(window.ESTATS_PIPELINE||[]), window.ESTATS_PERDUDA].map(e => `<option ${data.estat===e?'selected':''}>${e}</option>`).join('');
    html = `
      <div class="modal-title">${data.id?'Editar':'Nova'} oferta</div>
      <div class="modal-sub">Oportunitat comercial</div>

      <div class="form-row">
        <label>Client *</label>
        <div style="display:flex;gap:6px">
          <select id="m-clientId" style="flex:1"><option value="">— selecciona —</option>${clientOptions}</select>
          <button class="btn btn-sm" type="button" onclick="openQuickClient('oferta')">+ Nou</button>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-row"><label>Ram</label><select id="m-ram"><option value="">—</option>${ramOptions}</select></div>
        <div class="form-row"><label>Asseguradora actual</label><select id="m-asseg-actual"><option value="">—</option>${state.asseguradores.map(a => `<option ${data.asseguradora_actual===a.nom?'selected':''}>${a.nom}</option>`).join('')}</select></div>
      </div>

      <div class="form-grid-3">
        <div class="form-row"><label>Prima actual</label><input type="number" id="m-prima-actual" value="${data.prima_actual||''}" step="0.01"></div>
        <div class="form-row"><label>Prima Brokkom</label><input type="number" id="m-prima-brokkom" value="${data.prima_brokkom||''}" step="0.01"></div>
        <div class="form-row"><label>Asseguradora prop.</label><select id="m-asseg"><option value="">—</option>${assegOptions}</select></div>
      </div>

      <div class="form-grid">
        <div class="form-row"><label>Estat</label><select id="m-estat">${estatOptions}</select></div>
        <div class="form-row"><label>Data oferta</label><input type="date" id="m-data-oferta" value="${data.data_oferta||new Date().toISOString().slice(0,10)}"></div>
      </div>

      <div class="form-row"><label>Venciment pòlissa actual</label><input type="date" id="m-venciment" value="${data.venciment||''}"></div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes">${data.notes||''}</textarea></div>

      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveOferta('${data.id||''}')">Guardar</button>
      </div>
    `;
  }

  else if (type === 'seguiment') {
    const clientOptions = state.clients.map(c => `<option value="${c.id}" ${c.id===data.client_id?'selected':''}>${c.tipus==='particular'?(c.nom||c.empresa):(c.empresa||c.nom)}</option>`).join('');
    html = `
      <div class="modal-title">Nou seguiment</div>
      <div class="modal-sub">Registra una interacció</div>

      <div class="form-row">
        <label>Client *</label>
        <div style="display:flex;gap:6px">
          <select id="m-clientId" style="flex:1"><option value="">—</option>${clientOptions}</select>
          <button class="btn btn-sm" type="button" onclick="openQuickClient('seguiment')">+ Nou</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-row"><label>Data</label><input type="date" id="m-data" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="form-row"><label>Canal</label>
          <select id="m-canal">
            <option>Email</option><option>Telèfon</option><option>Reunió</option><option>WhatsApp</option><option>Altres</option>
          </select>
        </div>
      </div>
      <div class="form-row"><label>Resum</label><textarea id="m-resum" placeholder="Què s'ha parlat, decidit, acordat..."></textarea></div>
      <div class="form-row"><label>Proper pas</label><input type="text" id="m-proper-pas" placeholder="Acció concreta acordada"></div>

      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveSeguiment()">Guardar</button>
      </div>
    `;
  }

  else if (type === 'venciment') {
    const ramOptions = (state.config?.rams||[]).map(r => `<option>${r}</option>`).join('');
    const assegOptions = state.asseguradores.map(a => `<option>${a.nom}</option>`).join('');
    html = `
      <div class="modal-title">Nou venciment</div>
      <div class="modal-sub">Alarma 90/30/7</div>
      <div class="form-row"><label>Empresa *</label><input type="text" id="m-empresa" value="${data.empresa||''}"></div>
      <div class="form-grid">
        <div class="form-row"><label>Ram</label><select id="m-ram">${ramOptions}</select></div>
        <div class="form-row"><label>Asseguradora</label><select id="m-asseg"><option value="">—</option>${assegOptions}</select></div>
      </div>
      <div class="form-grid">
        <div class="form-row"><label>Data venciment *</label><input type="date" id="m-data"></div>
        <div class="form-row"><label>Prima actual</label><input type="number" id="m-prima" step="0.01"></div>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes"></textarea></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveVenciment()">Guardar</button>
      </div>
    `;
  }

  else if (type === 'tasca') {
    html = `
      <div class="modal-title">Nova tasca</div>
      <div class="form-row"><label>Títol *</label><input type="text" id="m-titol"></div>
      <div class="form-row"><label>Descripció</label><textarea id="m-descripcio"></textarea></div>
      <div class="form-grid-3">
        <div class="form-row"><label>Prioritat</label>
          <select id="m-prioritat">
            <option>Alta</option><option selected>Mitjana</option><option>Baixa</option>
          </select>
        </div>
        <div class="form-row"><label>Categoria</label>
          <select id="m-categoria">
            <option value="comercial">Comercial</option><option value="comunicacio">Comunicació</option>
            <option value="admin">Admin</option><option value="seguiment">Seguiment</option>
          </select>
        </div>
        <div class="form-row"><label>Data límit</label><input type="date" id="m-data-limit"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveTasca()">Guardar</button>
      </div>
    `;
  }

  else if (type === 'asseguradora') {
    html = `
      <div class="modal-title">Nova asseguradora</div>
      <div class="form-row"><label>Nom *</label><input type="text" id="m-nom"></div>
      <div class="form-row"><label>Rams (separats per coma)</label><input type="text" id="m-rams" placeholder="Multiriscos, Vehicles, RC..."></div>
      <div class="form-grid-3">
        <div class="form-row"><label>Contacte intern</label><input type="text" id="m-contacte"></div>
        <div class="form-row"><label>Email</label><input type="email" id="m-email"></div>
        <div class="form-row"><label>Telèfon</label><input type="tel" id="m-telefon"></div>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes" placeholder="Competitivitat, particularitats..."></textarea></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveAsseguradora()">Guardar</button>
      </div>
    `;
  }

  else if (type === 'consolidat') {
    const clientOptions = state.clients.map(c => `<option value="${c.id}" ${c.id===data.client_id?'selected':''}>${c.tipus==='particular'?(c.nom||c.empresa):(c.empresa||c.nom)}</option>`).join('');
    const ramOptions = (state.config?.rams||[]).map(r => `<option ${data.ram===r?'selected':''}>${r}</option>`).join('');
    const assegOptions = state.asseguradores.map(a => `<option ${data.asseguradora===a.nom?'selected':''}>${a.nom}</option>`).join('');
    html = `
      <div class="modal-title">Tancar oferta com a guanyada</div>
      <div class="modal-sub">Passa a Consolidats</div>
      <div class="form-row"><label>Client *</label><select id="m-clientId"><option value="">—</option>${clientOptions}</select></div>
      <div class="form-grid">
        <div class="form-row"><label>Ram</label><select id="m-ram">${ramOptions}</select></div>
        <div class="form-row"><label>Asseguradora</label><select id="m-asseg">${assegOptions}</select></div>
      </div>
      <div class="form-row"><label>Núm. pòlissa</label><input type="text" id="m-num-polissa" placeholder="Per traçabilitat amb ERP"></div>
      <div class="form-grid">
        <div class="form-row"><label>Data tancament *</label><input type="date" id="m-data-tanc" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="form-row"><label>Prima anual *</label><input type="number" id="m-prima-anual" value="${data.prima_brokkom||''}" step="0.01"></div>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes"></textarea></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveConsolidat('${data.id||''}')">Tancar com a guanyada</button>
      </div>
    `;
  }

  else if (type === 'quick-client') {
    html = `
      <div class="modal-title">Crear client ràpid</div>
      <div class="modal-sub">Camps mínims · pots completar-lo després</div>
      <div class="tipus-toggle">
        <button type="button" class="tipus-opt active" onclick="document.getElementById('qc-tipus').value='empresa';this.classList.add('active');this.nextElementSibling.classList.remove('active')">🏢 Empresa</button>
        <button type="button" class="tipus-opt" onclick="document.getElementById('qc-tipus').value='particular';this.classList.add('active');this.previousElementSibling.classList.remove('active')">👤 Particular</button>
      </div>
      <input type="hidden" id="qc-tipus" value="empresa">
      <div class="form-row"><label>Nom *</label><input type="text" id="qc-nom" placeholder="Empresa o nom complet"></div>
      <div class="form-grid">
        <div class="form-row"><label>Telèfon</label><input type="tel" id="qc-telefon"></div>
        <div class="form-row"><label>Email</label><input type="email" id="qc-email"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveQuickClient()">Crear i continuar</button>
      </div>
    `;
  }

  else if (type === 'oportunitat') {
    const clientOptions = state.clients.map(c => `<option value="${c.id}" ${c.id===data.client_id?'selected':''}>${c.tipus==='particular'?(c.nom||c.empresa):(c.empresa||c.nom)}</option>`).join('');
    const prio = data.prioritat || 'Mitjana';
    const est = data.estat || 'Detectada';
    html = `
      <div class="modal-title">Nova oportunitat</div>
      <div class="modal-sub">Afegeix una oportunitat manualment</div>
      <div class="form-row"><label>Client (opcional)</label><select id="m-opp-client"><option value="">— cap / escriu empresa a sota —</option>${clientOptions}</select></div>
      <div class="form-row"><label>Empresa (si no és client)</label><input type="text" id="m-opp-empresa" value="${data.empresa||''}" placeholder="Nom de l'empresa"></div>
      <div class="form-row"><label>Producte / ram *</label><input type="text" id="m-opp-producte" value="${data.producte||''}" placeholder="RC Patronal, Ciber, Salut col·lectiva..."></div>
      <div class="form-row"><label>Argument</label><textarea id="m-opp-argument" placeholder="Per què és una oportunitat">${data.argument||''}</textarea></div>
      <div class="form-grid">
        <div class="form-row"><label>Prioritat</label>
          <select id="m-opp-prioritat">
            <option ${prio==='Alta'?'selected':''}>Alta</option>
            <option ${prio==='Mitjana'?'selected':''}>Mitjana</option>
            <option ${prio==='Baixa'?'selected':''}>Baixa</option>
          </select>
        </div>
        <div class="form-row"><label>Estat</label>
          <select id="m-opp-estat">
            <option ${est==='Detectada'?'selected':''}>Detectada</option>
            <option ${est==='En treball'?'selected':''}>En treball</option>
            <option ${est==='Presentada'?'selected':''}>Presentada</option>
            <option ${est==='Descartada'?'selected':''}>Descartada</option>
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveOportunitat()">Guardar</button>
      </div>
    `;
  }

  if (html) {
    document.getElementById('modal-container').innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
  }
};

// ==================================================================
// CRUD funcions
// ==================================================================
window.saveClient = async function(id) {
  const tipus = document.getElementById('m-tipus').value;
  const isParticular = tipus === 'particular';
  const nomCamp = isParticular ? document.getElementById('m-nom').value.trim() : document.getElementById('m-empresa').value.trim();
  if (!nomCamp) { toast(isParticular?'Nom obligatori':'Empresa obligatòria','error'); return; }

  const dades = {
    tipus,
    email: document.getElementById('m-email').value.trim() || null,
    telefon: document.getElementById('m-telefon').value.trim() || null,
    adreca: document.getElementById('m-adreca').value.trim() || null,
    origen: document.getElementById('m-origen').value || null,
    estat: document.getElementById('m-estat-cli').value || null,
    notes: document.getElementById('m-notes').value.trim() || null
  };

  if (isParticular) {
    dades.nom = nomCamp;
    dades.empresa = document.getElementById('m-empresa-part').value.trim() || null;
    dades.dni = document.getElementById('m-dni').value.trim() || null;
    dades.data_naixement = document.getElementById('m-data-naix').value || null;
    dades.professio = document.getElementById('m-professio').value.trim() || null;
  } else {
    dades.empresa = nomCamp;
    dades.cif = document.getElementById('m-cif').value.trim() || null;
    dades.sector = document.getElementById('m-sector').value || null;
    dades.treballadors = document.getElementById('m-treballadors').value.trim() || null;
    dades.contacte = document.getElementById('m-contacte').value.trim() || null;
    dades.carrec = document.getElementById('m-carrec').value.trim() || null;
    dades.facturacio = document.getElementById('m-facturacio').value.trim() || null;
  }

  try {
    if (id) {
      const { error } = await supabase.from('clients').update(dades).eq('id', id);
      if (error) throw error;
    } else {
      dades.user_id = state.user.id;
      const { error } = await supabase.from('clients').insert(dades);
      if (error) throw error;
    }
    await refreshData('clients');
    closeModal();
    if (state._clientObert) renderCurrentTab();
    else renderClients();
    updateNavBadges();
    toast('Client guardat');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveOferta = async function(id) {
  const clientId = document.getElementById('m-clientId').value;
  if (!clientId) { toast('Selecciona client','error'); return; }
  const cli = state.clients.find(c => c.id === clientId);
  const estat = document.getElementById('m-estat').value;
  const dades = {
    client_id: clientId,
    empresa: cli ? (cli.empresa || cli.nom) : '',
    ram: document.getElementById('m-ram').value || null,
    asseguradora_actual: document.getElementById('m-asseg-actual').value || null,
    asseguradora: document.getElementById('m-asseg').value || null,
    prima_actual: parseFloat(document.getElementById('m-prima-actual').value) || null,
    prima_brokkom: parseFloat(document.getElementById('m-prima-brokkom').value) || null,
    estat,
    data_oferta: document.getElementById('m-data-oferta').value || null,
    venciment: document.getElementById('m-venciment').value || null,
    notes: document.getElementById('m-notes').value || null
  };
  if (estat === 'Tancada guanyada') {
    if (id) await supabase.from('ofertes').delete().eq('id', id);
    closeModal();
    openModal('consolidat', { ...dades, prima_brokkom: dades.prima_brokkom });
    return;
  }
  try {
    if (id) {
      const { error } = await supabase.from('ofertes').update(dades).eq('id', id);
      if (error) throw error;
    } else {
      dades.user_id = state.user.id;
      const { error } = await supabase.from('ofertes').insert(dades);
      if (error) throw error;
    }
    await refreshData('ofertes');
    closeModal();
    renderCurrentTab();
    updateNavBadges();
    toast('Oferta guardada');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveConsolidat = async function(id) {
  const clientId = document.getElementById('m-clientId').value;
  const primaAnual = parseFloat(document.getElementById('m-prima-anual').value);
  if (!clientId) { toast('Selecciona client','error'); return; }
  if (!primaAnual) { toast('Prima obligatòria','error'); return; }
  const cli = state.clients.find(c => c.id === clientId);
  const dades = {
    client_id: clientId,
    empresa: cli ? (cli.empresa || cli.nom) : '',
    ram: document.getElementById('m-ram').value || null,
    asseguradora: document.getElementById('m-asseg').value || null,
    num_polissa: document.getElementById('m-num-polissa').value.trim() || null,
    data_tancament: document.getElementById('m-data-tanc').value,
    prima_anual: primaAnual,
    notes: document.getElementById('m-notes').value || null,
    user_id: state.user.id
  };
  try {
    const { error } = await supabase.from('consolidats').insert(dades);
    if (error) throw error;
    await refreshData();
    closeModal();
    showTab('consolidats');
    toast('Tancament registrat ✓');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveSeguiment = async function() {
  const clientId = document.getElementById('m-clientId').value;
  if (!clientId) { toast('Selecciona client','error'); return; }
  const dades = {
    client_id: clientId,
    data: document.getElementById('m-data').value,
    canal: document.getElementById('m-canal').value,
    resum: document.getElementById('m-resum').value || null,
    proper_pas: document.getElementById('m-proper-pas').value || null,
    user_id: state.user.id
  };
  try {
    const { error } = await supabase.from('seguiments').insert(dades);
    if (error) throw error;
    await refreshData('seguiments');
    closeModal();
    if (typeof renderCurrentTab === 'function') renderCurrentTab();
    toast('Seguiment guardat');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveVenciment = async function() {
  const empresa = document.getElementById('m-empresa').value.trim();
  const data = document.getElementById('m-data').value;
  if (!empresa || !data) { toast('Empresa i data obligatòries','error'); return; }
  const dades = {
    empresa,
    ram: document.getElementById('m-ram').value || null,
    asseguradora: document.getElementById('m-asseg').value || null,
    data_venciment: data,
    prima_actual: parseFloat(document.getElementById('m-prima').value) || null,
    notes: document.getElementById('m-notes').value || null,
    user_id: state.user.id
  };
  try {
    const { error } = await supabase.from('venciments').insert(dades);
    if (error) throw error;
    await refreshData('venciments');
    closeModal();
    renderCurrentTab();
    updateNavBadges();
    toast('Venciment registrat');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveTasca = async function() {
  const titol = document.getElementById('m-titol').value.trim();
  if (!titol) { toast('Títol obligatori','error'); return; }
  const dades = {
    titol,
    descripcio: document.getElementById('m-descripcio').value || null,
    prioritat: document.getElementById('m-prioritat').value,
    categoria: document.getElementById('m-categoria').value,
    data_limit: document.getElementById('m-data-limit').value || null,
    estat: 'pendent',
    user_id: state.user.id
  };
  try {
    const { error } = await supabase.from('tasques').insert(dades);
    if (error) throw error;
    await refreshData('tasques');
    closeModal();
    renderCurrentTab();
    updateNavBadges();
    toast('Tasca creada');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveOportunitat = async function() {
  const clientId = document.getElementById('m-opp-client').value || null;
  const empresaInput = document.getElementById('m-opp-empresa').value.trim();
  const producte = document.getElementById('m-opp-producte').value.trim();
  if (!producte) { toast('Producte / ram obligatori','error'); return; }
  let empresa = empresaInput;
  if (clientId && !empresa) {
    const cli = state.clients.find(c => c.id === clientId);
    if (cli) empresa = cli.tipus==='particular' ? (cli.nom||cli.empresa) : (cli.empresa||cli.nom);
  }
  const dades = {
    client_id: clientId,
    empresa: empresa || null,
    producte,
    argument: document.getElementById('m-opp-argument').value.trim() || null,
    prioritat: document.getElementById('m-opp-prioritat').value,
    estat: document.getElementById('m-opp-estat').value,
    data_deteccio: new Date().toISOString().slice(0,10),
    user_id: state.user.id
  };
  try {
    const { error } = await supabase.from('oportunitats').insert(dades);
    if (error) throw error;
    await refreshData('oportunitats');
    closeModal();
    renderCurrentTab();
    updateNavBadges();
    toast('Oportunitat creada');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveAsseguradora = async function() {
  const nom = document.getElementById('m-nom').value.trim();
  if (!nom) { toast('Nom obligatori','error'); return; }
  const dades = {
    nom,
    rams: document.getElementById('m-rams').value.split(',').map(s => s.trim()).filter(Boolean),
    contacte_intern: document.getElementById('m-contacte').value || null,
    email: document.getElementById('m-email').value || null,
    telefon: document.getElementById('m-telefon').value || null,
    notes: document.getElementById('m-notes').value || null,
    user_id: state.user.id
  };
  try {
    const { error } = await supabase.from('asseguradores').insert(dades);
    if (error) throw error;
    await refreshData('asseguradores');
    closeModal();
    renderAsseguradores();
    toast('Asseguradora guardada');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

// ==================================================================
// QUICK CLIENT (creació ràpida des de desplegables)
// ==================================================================
window.openQuickClient = function(returnTo) {
  state._quickClientReturn = returnTo;
  openModal('quick-client');
};

window.saveQuickClient = async function() {
  const tipus = document.getElementById('qc-tipus').value;
  const nom = document.getElementById('qc-nom').value.trim();
  if (!nom) { toast('Nom obligatori','error'); return; }
  const dades = {
    tipus,
    user_id: state.user.id,
    telefon: document.getElementById('qc-telefon').value.trim() || null,
    email: document.getElementById('qc-email').value.trim() || null
  };
  if (tipus === 'particular') {
    dades.nom = nom;
  } else {
    dades.empresa = nom;
  }
  try {
    const { data, error } = await supabase.from('clients').insert(dades).select().single();
    if (error) throw error;
    await refreshData('clients');
    closeModal();

    // Reobre el modal anterior amb el nou client preseleccionat
    const ret = state._quickClientReturn;
    if (ret === 'oferta') openModal('oferta', { client_id: data.id });
    else if (ret === 'seguiment') openModal('seguiment', { client_id: data.id });
    else if (ret === 'venciment') openModal('venciment', { client_id: data.id, empresa: nom });
    else openModal('client', data);

    toast('Client creat — completa l\'altre formulari');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

// ==================================================================
// SHARE MODAL — Compartir client amb altres mediadors
// ==================================================================
window.openShareModal = function(recursTipus, recursId) {
  const recurs = recursTipus === 'client'
    ? state.clients.find(c => c.id === recursId)
    : state.tasques.find(t => t.id === recursId);
  if (!recurs) return;

  const nom = recursTipus === 'client'
    ? (recurs.empresa || recurs.nom || '?')
    : recurs.titol;

  const shares = window.getSharedWith(recursTipus, recursId);
  const sharedUserIds = new Set(shares.map(s => s.compartit_amb_id));
  sharedUserIds.add(recurs.user_id);

  const altresMediadors = state.mediadors.filter(m => !sharedUserIds.has(m.user_id) && m.actiu);

  const html = `
    <div class="modal-title">↗ Compartir ${recursTipus === 'client' ? 'client' : 'tasca'}</div>
    <div class="modal-sub">${nom}</div>

    <div style="font-size:10.5px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em;font-weight:500;margin-bottom:8px">Amb accés</div>

    <div class="share-row">
      ${window.renderAvatar ? window.renderAvatar(recurs.user_id,'md') : ''}
      <div class="share-info">
        <div class="share-name">${window.getMediadorByUserId(recurs.user_id)?.nom || 'Tu'}</div>
        <div class="share-email">${window.getMediadorByUserId(recurs.user_id)?.email || ''}</div>
      </div>
      <span style="font-size:11px;color:var(--text-3)">Propietari</span>
    </div>

    ${shares.map(s => `
      <div class="share-row">
        ${window.renderAvatar ? window.renderAvatar(s.compartit_amb_id,'md') : ''}
        <div class="share-info">
          <div class="share-name">${s.mediador?.nom || s.mediador?.email || '?'}</div>
          <div class="share-email">${s.mediador?.email || ''}</div>
        </div>
        <select onchange="changeSharePermission('${s.id}',this.value)" style="font-size:11px;padding:3px 6px;width:auto">
          <option value="editor" ${s.permis==='editor'?'selected':''}>Pot editar</option>
          <option value="viewer" ${s.permis==='viewer'?'selected':''}>Només veure</option>
        </select>
        <button class="btn btn-sm" onclick="removeShare('${s.id}','${recursTipus}','${recursId}')" style="color:var(--danger);padding:3px 6px">✕</button>
      </div>
    `).join('')}

    ${altresMediadors.length > 0 ? `
      <div style="font-size:10.5px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em;font-weight:500;margin:14px 0 8px">Disponibles</div>
      ${altresMediadors.map(m => `
        <div class="share-row">
          ${window.renderAvatar ? window.renderAvatar(m.user_id,'md') : ''}
          <div class="share-info">
            <div class="share-name">${m.nom || m.email}</div>
            <div class="share-email">${m.email}</div>
          </div>
          <button class="btn btn-sm" onclick="addShare('${recursTipus}','${recursId}','${m.user_id}')">Convidar</button>
        </div>
      `).join('')}
    ` : ''}

    <div style="border-top:0.5px solid var(--border);margin-top:16px;padding-top:14px;display:flex;align-items:center;gap:8px">
      <span style="font-size:11.5px;color:var(--text-3)">🔒 Privat dins de l'equip Brokkom</span>
      <button class="btn btn-sm" onclick="closeModal()" style="margin-left:auto">Tancar</button>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
};

window.addShare = async function(recursTipus, recursId, withUserId) {
  try {
    const { error } = await supabase.from('comparticions').insert({
      recurs_tipus: recursTipus,
      recurs_id: recursId,
      propietari_id: state.user.id,
      compartit_amb_id: withUserId,
      permis: 'editor'
    });
    if (error) throw error;
    await refreshData('comparticions');
    openShareModal(recursTipus, recursId);
    toast('Compartit');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.removeShare = async function(shareId, recursTipus, recursId) {
  try {
    const { error } = await supabase.from('comparticions').delete().eq('id', shareId);
    if (error) throw error;
    await refreshData('comparticions');
    openShareModal(recursTipus, recursId);
    toast('Esborrat');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.changeSharePermission = async function(shareId, nouPermis) {
  try {
    const { error } = await supabase.from('comparticions').update({ permis: nouPermis }).eq('id', shareId);
    if (error) throw error;
    await refreshData('comparticions');
    toast('Permís actualitzat');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

// Stubs per a mòduls que vindran al següent sprint
window.saveNota = () => {};
window.saveAgendaEvent = () => {};
window.saveEsborrany = () => {};
window.saveInboxQuick = () => {};
window.saveInboxImage = () => {};
window.handleImageSelected = () => {};
window.resetImageCapture = () => {};
window.switchCaptureMode = () => {};
window.showImageLightbox = () => {};
window.deleteInboxItem = () => {};
window.processInboxIA = () => {};
window.processInboxImageIA = () => {};
window.promoteInbox = () => {};
window.markInboxProcessed = () => {};

console.log('✅ modals.js carregat correctament');// ==================================================================
// BROKKOM CRM · modals.js v1 — Modals Notion + Share
// ==================================================================
console.log('🪟 modals.js carregat');

window.closeModal = function() {
  document.getElementById('modal-container').innerHTML = '';
};

window.openModal = function(type, data = {}) {
  let html = '';

  if (type === 'client') {
    const isEdit = !!data.id;
    const tipus = data.tipus || 'empresa';
    html = `
      <div class="modal-title">${isEdit?'Editar':'Nou'} client</div>
      <div class="modal-sub">Empresa o particular</div>

      <div class="tipus-toggle">
        <button type="button" class="tipus-opt ${tipus==='empresa'?'active':''}" onclick="document.getElementById('m-tipus').value='empresa';document.querySelectorAll('.tipus-opt').forEach(e=>e.classList.toggle('active', e.textContent.trim().startsWith('🏢')));document.getElementById('camps-empresa').classList.remove('hidden');document.getElementById('camps-particular').classList.add('hidden')">🏢 Empresa</button>
        <button type="button" class="tipus-opt ${tipus==='particular'?'active':''}" onclick="document.getElementById('m-tipus').value='particular';document.querySelectorAll('.tipus-opt').forEach(e=>e.classList.toggle('active', e.textContent.trim().startsWith('👤')));document.getElementById('camps-empresa').classList.add('hidden');document.getElementById('camps-particular').classList.remove('hidden')">👤 Particular</button>
      </div>
      <input type="hidden" id="m-tipus" value="${tipus}">

      <div id="camps-empresa" class="${tipus==='particular'?'hidden':''}">
        <div class="form-grid">
          <div class="form-row"><label>Empresa *</label><input type="text" id="m-empresa" value="${data.empresa||''}"></div>
          <div class="form-row"><label>CIF</label><input type="text" id="m-cif" value="${data.cif||''}"></div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Sector</label>
            <select id="m-sector">
              <option value="">—</option>
              ${(window.SECTORS||[]).map(s => `<option ${data.sector===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Treballadors</label><input type="text" id="m-treballadors" value="${data.treballadors||''}"></div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Contacte principal</label><input type="text" id="m-contacte" value="${data.contacte||''}"></div>
          <div class="form-row"><label>Càrrec</label><input type="text" id="m-carrec" value="${data.carrec||''}" placeholder="Gerent, RRHH, responsable flota..."></div>
        </div>
        <div class="form-row"><label>Facturació</label><input type="text" id="m-facturacio" value="${data.facturacio||''}" placeholder="ex: 4,2M€"></div>
      </div>

      <div id="camps-particular" class="${tipus==='empresa'?'hidden':''}">
        <div class="form-grid">
          <div class="form-row"><label>Nom complet *</label><input type="text" id="m-nom" value="${data.nom||data.empresa||''}"></div>
          <div class="form-row"><label>DNI</label><input type="text" id="m-dni" value="${data.dni||''}"></div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Data naixement</label><input type="date" id="m-data-naix" value="${data.data_naixement||''}"></div>
          <div class="form-row"><label>Professió</label><input type="text" id="m-professio" value="${data.professio||''}"></div>
        </div>
        <div class="form-row"><label>Empresa on treballa</label><input type="text" id="m-empresa-part" value="${data.empresa||''}" placeholder="Pot ser client de Brokkom?"></div>
      </div>

      <div class="form-grid">
        <div class="form-row"><label>Email</label><input type="email" id="m-email" value="${data.email||''}"></div>
        <div class="form-row"><label>Telèfon</label><input type="tel" id="m-telefon" value="${data.telefon||''}"></div>
      </div>
      <div class="form-row"><label>Adreça</label><input type="text" id="m-adreca" value="${data.adreca||''}"></div>

      <div class="form-grid">
        <div class="form-row"><label>Origen</label>
          <select id="m-origen">
            <option value="">—</option>
            ${(window.ORIGENS||[]).map(o => `<option ${data.origen===o?'selected':''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Estat</label>
          <select id="m-estat-cli">
            <option value="prospect" ${data.estat==='prospect'?'selected':''}>Prospect</option>
            <option value="actiu" ${data.estat==='actiu'?'selected':''}>Actiu</option>
            <option value="ex-client" ${data.estat==='ex-client'?'selected':''}>Ex-client</option>
          </select>
        </div>
      </div>

      <div class="form-row"><label>Notes estratègiques</label><textarea id="m-notes" placeholder="Història, peculiaritats, necessitats, oportunitats...">${data.notes||''}</textarea></div>

      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveClient('${data.id||''}')">Guardar</button>
      </div>
    `;
  }

  else if (type === 'oferta') {
    const clientOptions = state.clients.map(c => `<option value="${c.id}" ${c.id===data.client_id?'selected':''}>${c.tipus==='particular'?(c.nom||c.empresa):(c.empresa||c.nom)}</option>`).join('');
    const ramOptions = (state.config?.rams||[]).map(r => `<option ${data.ram===r?'selected':''}>${r}</option>`).join('');
    const assegOptions = state.asseguradores.map(a => `<option ${data.asseguradora===a.nom?'selected':''}>${a.nom}</option>`).join('');
    const estatOptions = [...(window.ESTATS_PIPELINE||[]), window.ESTATS_PERDUDA].map(e => `<option ${data.estat===e?'selected':''}>${e}</option>`).join('');
    html = `
      <div class="modal-title">${data.id?'Editar':'Nova'} oferta</div>
      <div class="modal-sub">Oportunitat comercial</div>

      <div class="form-row">
        <label>Client *</label>
        <div style="display:flex;gap:6px">
          <select id="m-clientId" style="flex:1"><option value="">— selecciona —</option>${clientOptions}</select>
          <button class="btn btn-sm" type="button" onclick="openQuickClient('oferta')">+ Nou</button>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-row"><label>Ram</label><select id="m-ram"><option value="">—</option>${ramOptions}</select></div>
        <div class="form-row"><label>Asseguradora actual</label><select id="m-asseg-actual"><option value="">—</option>${state.asseguradores.map(a => `<option ${data.asseguradora_actual===a.nom?'selected':''}>${a.nom}</option>`).join('')}</select></div>
      </div>

      <div class="form-grid-3">
        <div class="form-row"><label>Prima actual</label><input type="number" id="m-prima-actual" value="${data.prima_actual||''}" step="0.01"></div>
        <div class="form-row"><label>Prima Brokkom</label><input type="number" id="m-prima-brokkom" value="${data.prima_brokkom||''}" step="0.01"></div>
        <div class="form-row"><label>Asseguradora prop.</label><select id="m-asseg"><option value="">—</option>${assegOptions}</select></div>
      </div>

      <div class="form-grid">
        <div class="form-row"><label>Estat</label><select id="m-estat">${estatOptions}</select></div>
        <div class="form-row"><label>Data oferta</label><input type="date" id="m-data-oferta" value="${data.data_oferta||new Date().toISOString().slice(0,10)}"></div>
      </div>

      <div class="form-row"><label>Venciment pòlissa actual</label><input type="date" id="m-venciment" value="${data.venciment||''}"></div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes">${data.notes||''}</textarea></div>

      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveOferta('${data.id||''}')">Guardar</button>
      </div>
    `;
  }

  else if (type === 'seguiment') {
    const clientOptions = state.clients.map(c => `<option value="${c.id}" ${c.id===data.client_id?'selected':''}>${c.tipus==='particular'?(c.nom||c.empresa):(c.empresa||c.nom)}</option>`).join('');
    html = `
      <div class="modal-title">Nou seguiment</div>
      <div class="modal-sub">Registra una interacció</div>

      <div class="form-row">
        <label>Client *</label>
        <div style="display:flex;gap:6px">
          <select id="m-clientId" style="flex:1"><option value="">—</option>${clientOptions}</select>
          <button class="btn btn-sm" type="button" onclick="openQuickClient('seguiment')">+ Nou</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-row"><label>Data</label><input type="date" id="m-data" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="form-row"><label>Canal</label>
          <select id="m-canal">
            <option>Email</option><option>Telèfon</option><option>Reunió</option><option>WhatsApp</option><option>Altres</option>
          </select>
        </div>
      </div>
      <div class="form-row"><label>Resum</label><textarea id="m-resum" placeholder="Què s'ha parlat, decidit, acordat..."></textarea></div>
      <div class="form-row"><label>Proper pas</label><input type="text" id="m-proper-pas" placeholder="Acció concreta acordada"></div>

      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveSeguiment()">Guardar</button>
      </div>
    `;
  }

  else if (type === 'venciment') {
    const ramOptions = (state.config?.rams||[]).map(r => `<option>${r}</option>`).join('');
    const assegOptions = state.asseguradores.map(a => `<option>${a.nom}</option>`).join('');
    html = `
      <div class="modal-title">Nou venciment</div>
      <div class="modal-sub">Alarma 90/30/7</div>
      <div class="form-row"><label>Empresa *</label><input type="text" id="m-empresa" value="${data.empresa||''}"></div>
      <div class="form-grid">
        <div class="form-row"><label>Ram</label><select id="m-ram">${ramOptions}</select></div>
        <div class="form-row"><label>Asseguradora</label><select id="m-asseg"><option value="">—</option>${assegOptions}</select></div>
      </div>
      <div class="form-grid">
        <div class="form-row"><label>Data venciment *</label><input type="date" id="m-data"></div>
        <div class="form-row"><label>Prima actual</label><input type="number" id="m-prima" step="0.01"></div>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes"></textarea></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveVenciment()">Guardar</button>
      </div>
    `;
  }

  else if (type === 'tasca') {
    html = `
      <div class="modal-title">Nova tasca</div>
      <div class="form-row"><label>Títol *</label><input type="text" id="m-titol"></div>
      <div class="form-row"><label>Descripció</label><textarea id="m-descripcio"></textarea></div>
      <div class="form-grid-3">
        <div class="form-row"><label>Prioritat</label>
          <select id="m-prioritat">
            <option>Alta</option><option selected>Mitjana</option><option>Baixa</option>
          </select>
        </div>
        <div class="form-row"><label>Categoria</label>
          <select id="m-categoria">
            <option value="comercial">Comercial</option><option value="comunicacio">Comunicació</option>
            <option value="admin">Admin</option><option value="seguiment">Seguiment</option>
          </select>
        </div>
        <div class="form-row"><label>Data límit</label><input type="date" id="m-data-limit"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveTasca()">Guardar</button>
      </div>
    `;
  }

  else if (type === 'asseguradora') {
    html = `
      <div class="modal-title">Nova asseguradora</div>
      <div class="form-row"><label>Nom *</label><input type="text" id="m-nom"></div>
      <div class="form-row"><label>Rams (separats per coma)</label><input type="text" id="m-rams" placeholder="Multiriscos, Vehicles, RC..."></div>
      <div class="form-grid-3">
        <div class="form-row"><label>Contacte intern</label><input type="text" id="m-contacte"></div>
        <div class="form-row"><label>Email</label><input type="email" id="m-email"></div>
        <div class="form-row"><label>Telèfon</label><input type="tel" id="m-telefon"></div>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes" placeholder="Competitivitat, particularitats..."></textarea></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveAsseguradora()">Guardar</button>
      </div>
    `;
  }

  else if (type === 'consolidat') {
    const clientOptions = state.clients.map(c => `<option value="${c.id}" ${c.id===data.client_id?'selected':''}>${c.tipus==='particular'?(c.nom||c.empresa):(c.empresa||c.nom)}</option>`).join('');
    const ramOptions = (state.config?.rams||[]).map(r => `<option ${data.ram===r?'selected':''}>${r}</option>`).join('');
    const assegOptions = state.asseguradores.map(a => `<option ${data.asseguradora===a.nom?'selected':''}>${a.nom}</option>`).join('');
    html = `
      <div class="modal-title">Tancar oferta com a guanyada</div>
      <div class="modal-sub">Passa a Consolidats</div>
      <div class="form-row"><label>Client *</label><select id="m-clientId"><option value="">—</option>${clientOptions}</select></div>
      <div class="form-grid">
        <div class="form-row"><label>Ram</label><select id="m-ram">${ramOptions}</select></div>
        <div class="form-row"><label>Asseguradora</label><select id="m-asseg">${assegOptions}</select></div>
      </div>
      <div class="form-row"><label>Núm. pòlissa</label><input type="text" id="m-num-polissa" placeholder="Per traçabilitat amb ERP"></div>
      <div class="form-grid">
        <div class="form-row"><label>Data tancament *</label><input type="date" id="m-data-tanc" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="form-row"><label>Prima anual *</label><input type="number" id="m-prima-anual" value="${data.prima_brokkom||''}" step="0.01"></div>
      </div>
      <div class="form-row"><label>Notes</label><textarea id="m-notes"></textarea></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveConsolidat('${data.id||''}')">Tancar com a guanyada</button>
      </div>
    `;
  }

  else if (type === 'quick-client') {
    html = `
      <div class="modal-title">Crear client ràpid</div>
      <div class="modal-sub">Camps mínims · pots completar-lo després</div>
      <div class="tipus-toggle">
        <button type="button" class="tipus-opt active" onclick="document.getElementById('qc-tipus').value='empresa';this.classList.add('active');this.nextElementSibling.classList.remove('active')">🏢 Empresa</button>
        <button type="button" class="tipus-opt" onclick="document.getElementById('qc-tipus').value='particular';this.classList.add('active');this.previousElementSibling.classList.remove('active')">👤 Particular</button>
      </div>
      <input type="hidden" id="qc-tipus" value="empresa">
      <div class="form-row"><label>Nom *</label><input type="text" id="qc-nom" placeholder="Empresa o nom complet"></div>
      <div class="form-grid">
        <div class="form-row"><label>Telèfon</label><input type="tel" id="qc-telefon"></div>
        <div class="form-row"><label>Email</label><input type="email" id="qc-email"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel·lar</button>
        <button class="btn btn-primary" onclick="saveQuickClient()">Crear i continuar</button>
      </div>
    `;
  }

  if (html) {
    document.getElementById('modal-container').innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
  }
};

// ==================================================================
// CRUD funcions
// ==================================================================
window.saveClient = async function(id) {
  const tipus = document.getElementById('m-tipus').value;
  const isParticular = tipus === 'particular';
  const nomCamp = isParticular ? document.getElementById('m-nom').value.trim() : document.getElementById('m-empresa').value.trim();
  if (!nomCamp) { toast(isParticular?'Nom obligatori':'Empresa obligatòria','error'); return; }

  const dades = {
    tipus,
    email: document.getElementById('m-email').value.trim() || null,
    telefon: document.getElementById('m-telefon').value.trim() || null,
    adreca: document.getElementById('m-adreca').value.trim() || null,
    origen: document.getElementById('m-origen').value || null,
    estat: document.getElementById('m-estat-cli').value || null,
    notes: document.getElementById('m-notes').value.trim() || null
  };

  if (isParticular) {
    dades.nom = nomCamp;
    dades.empresa = document.getElementById('m-empresa-part').value.trim() || null;
    dades.dni = document.getElementById('m-dni').value.trim() || null;
    dades.data_naixement = document.getElementById('m-data-naix').value || null;
    dades.professio = document.getElementById('m-professio').value.trim() || null;
  } else {
    dades.empresa = nomCamp;
    dades.cif = document.getElementById('m-cif').value.trim() || null;
    dades.sector = document.getElementById('m-sector').value || null;
    dades.treballadors = document.getElementById('m-treballadors').value.trim() || null;
    dades.contacte = document.getElementById('m-contacte').value.trim() || null;
    dades.carrec = document.getElementById('m-carrec').value.trim() || null;
    dades.facturacio = document.getElementById('m-facturacio').value.trim() || null;
  }

  try {
    if (id) {
      const { error } = await supabase.from('clients').update(dades).eq('id', id);
      if (error) throw error;
    } else {
      dades.user_id = state.user.id;
      const { error } = await supabase.from('clients').insert(dades);
      if (error) throw error;
    }
    await refreshData('clients');
    closeModal();
    if (state._clientObert) renderCurrentTab();
    else renderClients();
    updateNavBadges();
    toast('Client guardat');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveOferta = async function(id) {
  const clientId = document.getElementById('m-clientId').value;
  if (!clientId) { toast('Selecciona client','error'); return; }
  const cli = state.clients.find(c => c.id === clientId);
  const estat = document.getElementById('m-estat').value;
  const dades = {
    client_id: clientId,
    empresa: cli ? (cli.empresa || cli.nom) : '',
    ram: document.getElementById('m-ram').value || null,
    asseguradora_actual: document.getElementById('m-asseg-actual').value || null,
    asseguradora: document.getElementById('m-asseg').value || null,
    prima_actual: parseFloat(document.getElementById('m-prima-actual').value) || null,
    prima_brokkom: parseFloat(document.getElementById('m-prima-brokkom').value) || null,
    estat,
    data_oferta: document.getElementById('m-data-oferta').value || null,
    venciment: document.getElementById('m-venciment').value || null,
    notes: document.getElementById('m-notes').value || null
  };
  if (estat === 'Tancada guanyada') {
    if (id) await supabase.from('ofertes').delete().eq('id', id);
    closeModal();
    openModal('consolidat', { ...dades, prima_brokkom: dades.prima_brokkom });
    return;
  }
  try {
    if (id) {
      const { error } = await supabase.from('ofertes').update(dades).eq('id', id);
      if (error) throw error;
    } else {
      dades.user_id = state.user.id;
      const { error } = await supabase.from('ofertes').insert(dades);
      if (error) throw error;
    }
    await refreshData('ofertes');
    closeModal();
    renderCurrentTab();
    updateNavBadges();
    toast('Oferta guardada');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveConsolidat = async function(id) {
  const clientId = document.getElementById('m-clientId').value;
  const primaAnual = parseFloat(document.getElementById('m-prima-anual').value);
  if (!clientId) { toast('Selecciona client','error'); return; }
  if (!primaAnual) { toast('Prima obligatòria','error'); return; }
  const cli = state.clients.find(c => c.id === clientId);
  const dades = {
    client_id: clientId,
    empresa: cli ? (cli.empresa || cli.nom) : '',
    ram: document.getElementById('m-ram').value || null,
    asseguradora: document.getElementById('m-asseg').value || null,
    num_polissa: document.getElementById('m-num-polissa').value.trim() || null,
    data_tancament: document.getElementById('m-data-tanc').value,
    prima_anual: primaAnual,
    notes: document.getElementById('m-notes').value || null,
    user_id: state.user.id
  };
  try {
    const { error } = await supabase.from('consolidats').insert(dades);
    if (error) throw error;
    await refreshData();
    closeModal();
    showTab('consolidats');
    toast('Tancament registrat ✓');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveSeguiment = async function() {
  const clientId = document.getElementById('m-clientId').value;
  if (!clientId) { toast('Selecciona client','error'); return; }
  const dades = {
    client_id: clientId,
    data: document.getElementById('m-data').value,
    canal: document.getElementById('m-canal').value,
    resum: document.getElementById('m-resum').value || null,
    proper_pas: document.getElementById('m-proper-pas').value || null,
    user_id: state.user.id
  };
  try {
    const { error } = await supabase.from('seguiments').insert(dades);
    if (error) throw error;
    await refreshData('seguiments');
    closeModal();
    if (typeof renderCurrentTab === 'function') renderCurrentTab();
    toast('Seguiment guardat');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveVenciment = async function() {
  const empresa = document.getElementById('m-empresa').value.trim();
  const data = document.getElementById('m-data').value;
  if (!empresa || !data) { toast('Empresa i data obligatòries','error'); return; }
  const dades = {
    empresa,
    ram: document.getElementById('m-ram').value || null,
    asseguradora: document.getElementById('m-asseg').value || null,
    data_venciment: data,
    prima_actual: parseFloat(document.getElementById('m-prima').value) || null,
    notes: document.getElementById('m-notes').value || null,
    user_id: state.user.id
  };
  try {
    const { error } = await supabase.from('venciments').insert(dades);
    if (error) throw error;
    await refreshData('venciments');
    closeModal();
    renderCurrentTab();
    updateNavBadges();
    toast('Venciment registrat');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveTasca = async function() {
  const titol = document.getElementById('m-titol').value.trim();
  if (!titol) { toast('Títol obligatori','error'); return; }
  const dades = {
    titol,
    descripcio: document.getElementById('m-descripcio').value || null,
    prioritat: document.getElementById('m-prioritat').value,
    categoria: document.getElementById('m-categoria').value,
    data_limit: document.getElementById('m-data-limit').value || null,
    estat: 'pendent',
    user_id: state.user.id
  };
  try {
    const { error } = await supabase.from('tasques').insert(dades);
    if (error) throw error;
    await refreshData('tasques');
    closeModal();
    renderCurrentTab();
    updateNavBadges();
    toast('Tasca creada');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.saveAsseguradora = async function() {
  const nom = document.getElementById('m-nom').value.trim();
  if (!nom) { toast('Nom obligatori','error'); return; }
  const dades = {
    nom,
    rams: document.getElementById('m-rams').value.split(',').map(s => s.trim()).filter(Boolean),
    contacte_intern: document.getElementById('m-contacte').value || null,
    email: document.getElementById('m-email').value || null,
    telefon: document.getElementById('m-telefon').value || null,
    notes: document.getElementById('m-notes').value || null,
    user_id: state.user.id
  };
  try {
    const { error } = await supabase.from('asseguradores').insert(dades);
    if (error) throw error;
    await refreshData('asseguradores');
    closeModal();
    renderAsseguradores();
    toast('Asseguradora guardada');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

// ==================================================================
// QUICK CLIENT (creació ràpida des de desplegables)
// ==================================================================
window.openQuickClient = function(returnTo) {
  state._quickClientReturn = returnTo;
  openModal('quick-client');
};

window.saveQuickClient = async function() {
  const tipus = document.getElementById('qc-tipus').value;
  const nom = document.getElementById('qc-nom').value.trim();
  if (!nom) { toast('Nom obligatori','error'); return; }
  const dades = {
    tipus,
    user_id: state.user.id,
    telefon: document.getElementById('qc-telefon').value.trim() || null,
    email: document.getElementById('qc-email').value.trim() || null
  };
  if (tipus === 'particular') {
    dades.nom = nom;
  } else {
    dades.empresa = nom;
  }
  try {
    const { data, error } = await supabase.from('clients').insert(dades).select().single();
    if (error) throw error;
    await refreshData('clients');
    closeModal();

    // Reobre el modal anterior amb el nou client preseleccionat
    const ret = state._quickClientReturn;
    if (ret === 'oferta') openModal('oferta', { client_id: data.id });
    else if (ret === 'seguiment') openModal('seguiment', { client_id: data.id });
    else if (ret === 'venciment') openModal('venciment', { client_id: data.id, empresa: nom });
    else openModal('client', data);

    toast('Client creat — completa l\'altre formulari');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

// ==================================================================
// SHARE MODAL — Compartir client amb altres mediadors
// ==================================================================
window.openShareModal = function(recursTipus, recursId) {
  const recurs = recursTipus === 'client'
    ? state.clients.find(c => c.id === recursId)
    : state.tasques.find(t => t.id === recursId);
  if (!recurs) return;

  const nom = recursTipus === 'client'
    ? (recurs.empresa || recurs.nom || '?')
    : recurs.titol;

  const shares = window.getSharedWith(recursTipus, recursId);
  const sharedUserIds = new Set(shares.map(s => s.compartit_amb_id));
  sharedUserIds.add(recurs.user_id);

  const altresMediadors = state.mediadors.filter(m => !sharedUserIds.has(m.user_id) && m.actiu);

  const html = `
    <div class="modal-title">↗ Compartir ${recursTipus === 'client' ? 'client' : 'tasca'}</div>
    <div class="modal-sub">${nom}</div>

    <div style="font-size:10.5px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em;font-weight:500;margin-bottom:8px">Amb accés</div>

    <div class="share-row">
      ${window.renderAvatar ? window.renderAvatar(recurs.user_id,'md') : ''}
      <div class="share-info">
        <div class="share-name">${window.getMediadorByUserId(recurs.user_id)?.nom || 'Tu'}</div>
        <div class="share-email">${window.getMediadorByUserId(recurs.user_id)?.email || ''}</div>
      </div>
      <span style="font-size:11px;color:var(--text-3)">Propietari</span>
    </div>

    ${shares.map(s => `
      <div class="share-row">
        ${window.renderAvatar ? window.renderAvatar(s.compartit_amb_id,'md') : ''}
        <div class="share-info">
          <div class="share-name">${s.mediador?.nom || s.mediador?.email || '?'}</div>
          <div class="share-email">${s.mediador?.email || ''}</div>
        </div>
        <select onchange="changeSharePermission('${s.id}',this.value)" style="font-size:11px;padding:3px 6px;width:auto">
          <option value="editor" ${s.permis==='editor'?'selected':''}>Pot editar</option>
          <option value="viewer" ${s.permis==='viewer'?'selected':''}>Només veure</option>
        </select>
        <button class="btn btn-sm" onclick="removeShare('${s.id}','${recursTipus}','${recursId}')" style="color:var(--danger);padding:3px 6px">✕</button>
      </div>
    `).join('')}

    ${altresMediadors.length > 0 ? `
      <div style="font-size:10.5px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em;font-weight:500;margin:14px 0 8px">Disponibles</div>
      ${altresMediadors.map(m => `
        <div class="share-row">
          ${window.renderAvatar ? window.renderAvatar(m.user_id,'md') : ''}
          <div class="share-info">
            <div class="share-name">${m.nom || m.email}</div>
            <div class="share-email">${m.email}</div>
          </div>
          <button class="btn btn-sm" onclick="addShare('${recursTipus}','${recursId}','${m.user_id}')">Convidar</button>
        </div>
      `).join('')}
    ` : ''}

    <div style="border-top:0.5px solid var(--border);margin-top:16px;padding-top:14px;display:flex;align-items:center;gap:8px">
      <span style="font-size:11.5px;color:var(--text-3)">🔒 Privat dins de l'equip Brokkom</span>
      <button class="btn btn-sm" onclick="closeModal()" style="margin-left:auto">Tancar</button>
    </div>
  `;
  document.getElementById('modal-container').innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
};

window.addShare = async function(recursTipus, recursId, withUserId) {
  try {
    const { error } = await supabase.from('comparticions').insert({
      recurs_tipus: recursTipus,
      recurs_id: recursId,
      propietari_id: state.user.id,
      compartit_amb_id: withUserId,
      permis: 'editor'
    });
    if (error) throw error;
    await refreshData('comparticions');
    openShareModal(recursTipus, recursId);
    toast('Compartit');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.removeShare = async function(shareId, recursTipus, recursId) {
  try {
    const { error } = await supabase.from('comparticions').delete().eq('id', shareId);
    if (error) throw error;
    await refreshData('comparticions');
    openShareModal(recursTipus, recursId);
    toast('Esborrat');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

window.changeSharePermission = async function(shareId, nouPermis) {
  try {
    const { error } = await supabase.from('comparticions').update({ permis: nouPermis }).eq('id', shareId);
    if (error) throw error;
    await refreshData('comparticions');
    toast('Permís actualitzat');
  } catch (err) { toast('Error: '+err.message,'error'); }
};

// Stubs per a mòduls que vindran al següent sprint
window.saveNota = () => {};
window.saveAgendaEvent = () => {};
window.saveEsborrany = () => {};
window.saveInboxQuick = () => {};
window.saveInboxImage = () => {};
window.handleImageSelected = () => {};
window.resetImageCapture = () => {};
window.switchCaptureMode = () => {};
window.showImageLightbox = () => {};
window.deleteInboxItem = () => {};
window.processInboxIA = () => {};
window.processInboxImageIA = () => {};
window.promoteInbox = () => {};
window.markInboxProcessed = () => {};

console.log('✅ modals.js carregat correctament');
