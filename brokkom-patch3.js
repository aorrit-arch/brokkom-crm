// ==================================================================
// BROKKOM CRM · brokkom-patch3.js — 12/06/2026
// Es carrega DESPRÉS de brokkom-patch2.js. NO toca cap altre fitxer.
//
// Arregla dos problemes reportats:
//
//   1. "NO CARREGA LA BBDD"
//      app.js talla cada consulta a Supabase als 5 segons, sense
//      reintents i sense avisar. Quan el projecte Free de Supabase
//      està "adormit" (primera connexió del dia) o la xarxa va lenta,
//      TOTES les taules cauen per timeout i el CRM apareix buit tot
//      i que les dades hi són.
//      → Aquest patch fa una recàrrega robusta (20s + 2 reintents)
//        després del login, re-renderitza quan arriben les dades, i
//        mostra un banner amb botó "Reintentar" si realment no hi ha
//        connexió amb la base de dades.
//
//   2. "NO IMPORTA VIA BÚSTIA IA"
//      La IA retorna "" per als camps que no troba. Inserir "" en una
//      columna de tipus data (venciment, data_venciment) o numèrica
//      fa que Postgres rebutgi la fila ("invalid input syntax for
//      type date") i l'import falla.
//      → Aquest patch saneja el payload abans d'inserir: converteix
//        "" → null, valida dates (YYYY-MM-DD), converteix números i
//        només envia columnes que existeixen a la taula.
// ==================================================================
console.log('🩹 brokkom-patch3.js carregant...');

// ------------------------------------------------------------------
// 1) CÀRREGA ROBUSTA DE DADES
// ------------------------------------------------------------------
const BK3_TABLES = {
  clients: 'clients', ofertes: 'ofertes', consolidats: 'consolidats',
  seguiments: 'seguiments', oportunitats: 'oportunitats', venciments: 'venciments',
  tasques: 'tasques', asseguradores: 'asseguradores', posts: 'posts',
  inbox: 'inbox_items', notes: 'notes', agenda: 'agenda_events',
  esborranys: 'esborranys', vinculacions: 'vinculacions',
  comparticions: 'comparticions', mediadors: 'mediadors'
};

function bk3Timeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout: ' + label)), ms))
  ]);
}

// Consulta amb timeout generós + reintents amb espera creixent.
async function bk3Fetch(table, { timeout = 20000, retries = 2 } = {}) {
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const { data, error } = await bk3Timeout(
        window.supabase.from(table).select('*'),
        timeout,
        table
      );
      if (error) {
        // Taula inexistent → no és un problema de connexió: tornem buit.
        if (/does not exist|relation|schema cache/i.test(error.message)) {
          return { data: [], ok: true };
        }
        throw new Error(error.message);
      }
      return { data: data || [], ok: true };
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  console.warn(`⚠️ [patch3] ${table}:`, lastErr?.message);
  return { data: null, ok: false, error: lastErr };
}

// Carrega totes les taules. Retorna quantes han fallat de debò.
window.bk3LoadAll = async function() {
  const keys = Object.keys(BK3_TABLES);
  const results = await Promise.all(keys.map(k => bk3Fetch(BK3_TABLES[k])));
  let fallades = 0;
  keys.forEach((k, i) => {
    if (results[i].ok) {
      state[k] = results[i].data;
    } else {
      fallades++;
      // No sobreescrivim amb buit el que ja tinguem carregat.
      if (!Array.isArray(state[k])) state[k] = [];
    }
  });
  state.usuaris = state.mediadors;
  // Recuperar el mediador real (rol admin, nom...) si ha arribat ara
  if (state.mediadors?.length && state.user) {
    const real = state.mediadors.find(m => m.user_id === state.user.id);
    if (real) { state.mediador = real; state.profile = real; }
  }
  return { fallades, total: keys.length };
};

// Banner visible quan la BBDD no respon
function bk3Banner(show, missatge) {
  let b = document.getElementById('bk3-db-banner');
  if (!show) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('div');
    b.id = 'bk3-db-banner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#FAEEDA;color:#633806;font-size:13px;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.12)';
    document.body.appendChild(b);
  }
  b.innerHTML = `
    <span>⚠️ ${missatge}</span>
    <button onclick="bk3Reintentar()" style="font-family:inherit;font-size:12px;padding:5px 12px;border-radius:6px;border:1px solid #633806;background:#fff;cursor:pointer">Reintentar</button>
  `;
}

window.bk3Reintentar = async function() {
  bk3Banner(true, 'Connectant amb la base de dades…');
  const { fallades, total } = await window.bk3LoadAll();
  if (fallades === 0) {
    bk3Banner(false);
    if (typeof refreshUserUI === 'function') refreshUserUI();
    if (typeof renderCurrentTab === 'function') renderCurrentTab();
    if (typeof updateNavBadges === 'function') updateNavBadges();
    toast('Dades carregades correctament');
  } else if (fallades === total) {
    bk3Banner(true, "No s'ha pogut connectar amb la base de dades. Si fa dies que no entres, el projecte de Supabase pot estar pausat: entra a supabase.com i prem \u201cRestore\u201d.");
  } else {
    bk3Banner(true, `Algunes dades no s'han pogut carregar (${fallades} de ${total} taules).`);
  }
};

// refreshData robust (substitueix el d'app.js — mateixa signatura)
window.refreshData = async function(only, opts = {}) {
  if (only && BK3_TABLES[only]) {
    const r = await bk3Fetch(BK3_TABLES[only], { timeout: 15000, retries: 1 });
    if (r.ok) {
      state[only] = r.data;
      if (only === 'mediadors') state.usuaris = state.mediadors;
    }
  } else {
    await window.bk3LoadAll();
  }
  if (typeof updateNavBadges === 'function') updateNavBadges();
  if (!opts.silent && typeof renderCurrentTab === 'function') renderCurrentTab();
};

// Passada de recuperació després del login: espera que hi hagi sessió i,
// si la càrrega inicial d'app.js (timeouts de 5s) ha deixat el CRM buit,
// torna a carregar-ho tot amb paciència.
(function bk3Recuperacio() {
  let intents = 0;
  const timer = setInterval(async () => {
    intents++;
    if (intents > 60) { clearInterval(timer); return; } // màx ~30s esperant login
    if (!window.state?.user || !window.supabase) return;
    clearInterval(timer);

    // Donem 2 segons de marge a la càrrega d'app.js i comprovem.
    setTimeout(async () => {
      const buit = ['clients','ofertes','consolidats','seguiments']
        .every(k => !state[k] || state[k].length === 0);
      const { fallades, total } = await window.bk3LoadAll();
      if (fallades === total) {
        bk3Banner(true, "No s'ha pogut connectar amb la base de dades. Si fa dies que no entres, el projecte de Supabase pot estar pausat: entra a supabase.com i prem \u201cRestore\u201d.");
        return;
      }
      bk3Banner(false);
      // Re-render només si abans no hi havia res (per no molestar)
      const araHiHa = ['clients','ofertes','consolidats','seguiments']
        .some(k => state[k] && state[k].length > 0);
      if (buit && araHiHa) {
        if (typeof refreshUserUI === 'function') refreshUserUI();
        if (typeof renderCurrentTab === 'function') renderCurrentTab();
      }
      if (typeof updateNavBadges === 'function') updateNavBadges();
    }, 2000);
  }, 500);
})();

// ------------------------------------------------------------------
// 2) SANEJAMENT DELS IMPORTS DE LA BÚSTIA IA
// ------------------------------------------------------------------
function bk3Date(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function bk3Num(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return v === 0 || isNaN(v) ? null : v;
  let s = String(v).replace(/[€\s]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.'); // 1.209,50
  else if (s.includes(',')) s = s.replace(',', '.');                                  // 1209,50
  const n = parseFloat(s);
  return isNaN(n) || n === 0 ? null : n;
}
function bk3Text(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Columnes vàlides i tipus per taula (només s'envia el que hi és)
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

async function bk3TrobaOCreaClient(nom) {
  if (!nom) return null;
  const n = String(nom).trim().toLowerCase();
  let cli = state.clients.find(c =>
    (c.empresa || '').toLowerCase() === n || (c.nom || '').toLowerCase() === n
  );
  if (cli) return cli.id;
  try {
    const { data, error } = await window.supabase.from('clients')
      .insert({ empresa: String(nom).trim(), tipus: 'empresa', user_id: state.user.id })
      .select().single();
    if (error) throw error;
    state.clients.push(data);
    return data.id;
  } catch (e) {
    console.warn("[patch3] No s'ha pogut crear client:", e.message);
    return null;
  }
}

// Substitueix el _iaImport de brokkom-patch.js — mateixa UI (marca
// "✓ Importat", refresc silenciós), però amb dades sanejades.
window._iaImport = async function(key, idx) {
  const parsed = window._iaParsed;
  if (!parsed || !parsed[key] || !parsed[key][idx]) return;
  const item = parsed[key][idx];
  const btn = document.getElementById(`ia-btn-${key}-${idx}`);
  const card = document.getElementById(`ia-item-${key}-${idx}`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  const mustOk = ({ error }) => { if (error) throw new Error(error.message); };
  const sb = window.supabase;

  try {
    const net = bk3Clean(key, item);

    if (key === 'clients') {
      if (!net.empresa && !net.nom) throw new Error('Falta el nom o l\u2019empresa');
      if (!net.tipus) net.tipus = 'empresa';
      mustOk(await sb.from('clients').insert({ ...net, user_id: state.user.id }));

    } else if (key === 'ofertes') {
      const cid = await bk3TrobaOCreaClient(item.empresa);
      const estatsValids = (window.ESTATS_PIPELINE || []).concat([window.ESTATS_PERDUDA]);
      if (!net.estat || !estatsValids.includes(net.estat)) net.estat = 'Lead';
      mustOk(await sb.from('ofertes').insert({ ...net, client_id: cid, user_id: state.user.id }));

    } else if (key === 'venciments') {
      if (!net.data_venciment) throw new Error('La data de venciment no és vàlida — afegeix-la a mà des de Venciments');
      const cid = await bk3TrobaOCreaClient(item.empresa);
      mustOk(await sb.from('venciments').insert({ ...net, client_id: cid, user_id: state.user.id }));

    } else if (key === 'seguiments') {
      const cid = await bk3TrobaOCreaClient(item.empresa);
      mustOk(await sb.from('seguiments').insert({
        ...net,
        data: net.data || new Date().toISOString().slice(0, 10),
        client_id: cid, user_id: state.user.id
      }));

    } else if (key === 'oportunitats') {
      const cid = await bk3TrobaOCreaClient(item.empresa);
      mustOk(await sb.from('oportunitats').insert({
        ...net, client_id: cid, user_id: state.user.id, estat: 'Detectada'
      }));
    }

    if (card) card.classList.add('imported');
    if (btn) { btn.textContent = '✓ Importat'; btn.disabled = true; }

    // Refresc silenciós (sense re-render → les fitxes pendents es mantenen)
    try {
      const { data } = await sb.from(key).select('*');
      if (data) state[key] = data;
    } catch (e) { /* l'import ja és fet */ }
    if (typeof updateNavBadges === 'function') updateNavBadges();
    toast('Importat al CRM');

  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '+ Importar'; }
    toast('Error important: ' + e.message, 'error');
  }
};

console.log('✅ brokkom-patch3.js carregat (càrrega robusta BBDD + import IA sanejat)');
