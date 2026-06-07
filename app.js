// ==================================================================
// BROKKOM CRM · app.js
// Base: auth, càrrega de dades, helpers
// ==================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ovzvdmxbuoysckprjlej.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_s4ojmx3-jLvBd3gCRtPdyQ_dPS100N9';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabase;

// ==================================================================
// State
// ==================================================================
window.state = {
  user: null,
  mediador: null,
  profile: null,
  config: null,
  clients: [],
  ofertes: [],
  consolidats: [],
  seguiments: [],
  oportunitats: [],
  venciments: [],
  tasques: [],
  asseguradores: [],
  posts: [],
  inbox: [],
  notes: [],
  agenda: [],
  esborranys: [],
  vinculacions: [],
  comparticions: [],
  usuaris: [],
  mediadors: [],
  currentTab: 'dashboard'
};

// ==================================================================
// Constants
// ==================================================================
const TOPICS = [
  {id:'brokkom',i:'🚀',n:'Nova etapa Brokkom',sub:'Post corporatiu',a:['Qui és Brokkom: la corredoria que entén el transport per dins','Per a on va Brokkom: més digital, més proactiu','El que ens diferencia: construïm protecció, no venem pòlisses','Especialització real vs eslògan']},
  {id:'ciber',i:'🔒',n:'Ciber + NIS2',sub:'Risc + obligació legal',a:['El teu camió pot ser hackejat — GPS com a vector d\'atac','NIS2 obliga el transport: saps si compliu?','Ransomware a una flota: qui paga sense ciber?','Multes NIS2: fins al 2% de la facturació']},
  {id:'ppe',i:'👷',n:'PPE / conductor',sub:'Protecció del conductor',a:['Vehicle assegurat, conductor no: el gap invisible','Complement IT: quan l\'accident no és del vehicle','Pèrdua de carnet = pèrdua de feina','Renovació CAP i protecció del professional']},
  {id:'cmr',i:'🌍',n:'CMR vs ICC A',sub:'Mercaderies internacionals',a:['CMR no ho cobreix tot: el gap exportador','ICC A: la diferència en un sinistre internacional','3 errors en transport internacional','Crèdit exportació + ICC A']},
  {id:'acc',i:'🤝',n:'Accidents conveni',sub:'RC Patronal',a:['El conveni obliga, la pòlissa ha de cobrir','Mort o invalidesa: capitals reals?','RC Patronal: el risc que no es vol descobrir tard','Conveni col·lectiu i cobertura']},
  {id:'ret',i:'💰',n:'Retribució flexible',sub:'Estalvi fiscal',a:['Pagar el mateix, rebre més','Retribució flexible per a conductors','Cost zero per a l\'empresa','Com implantar-la al transport']},
  {id:'sal',i:'❤️',n:'Salut col·lectiva',sub:'Retenció de talent',a:['Conductors sans, empresa forta','Cost baix, impacte alt','La sanitat pública no és suficient','Sense augmentar nòmina']},
  {id:'nis',i:'⚠️',n:'NIS2 específic',sub:'Compliment normatiu',a:['NIS2 no és opcional al transport','5 passos per preparar la teva empresa','NIS2 + ciber: protecció legal','Multes i responsabilitat del gerent']}
];
window.TOPICS = TOPICS;

const ESTATS_PIPELINE = ['Lead','Qualificat','Cotitzant','Oferta enviada','En negociació','Tancada guanyada'];
const ESTATS_PERDUDA = 'Tancada perduda';
window.ESTATS_PIPELINE = ESTATS_PIPELINE;
window.ESTATS_PERDUDA = ESTATS_PERDUDA;

window.SECTORS = ['Transport mercaderies','Logística','Transport viatgers','ADR / mercaderies perilloses','Construcció','Comerç','Hostaleria','Serveis professionals','Indústria','Sanitat','Educació','Tecnologia','Altres'];
window.ORIGENS = ['Recomanació','Campanya','Web','LinkedIn','Cold call','Networking','ERP existent','Reactivació ex-client','Altres'];

const AVATAR_COLORS = ['#2B2926','#5F5E5A','#908E89','#0F766E','#4A6FA5','#B07B3E','#5B4B9C','#2C7A5E'];

// ==================================================================
// Helpers globals
// ==================================================================
window.uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2,5);
window.fmt = n => new Intl.NumberFormat('ca-ES').format(Math.round(n||0));
window.fmtEur = n => fmt(n) + '€';
window.fmtDate = d => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('ca-ES');
};
window.fmtDateShort = d => {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('ca-ES', {day:'numeric', month:'short'});
};
window.daysFromNow = d => Math.ceil((new Date(d) - new Date()) / 86400000);
window.daysBetween = (d1, d2) => Math.ceil((new Date(d2) - new Date(d1)) / 86400000);

window.toast = (msg, type = 'success') => {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  const container = document.getElementById('toast-container');
  if (container) container.appendChild(t);
  setTimeout(() => t.remove(), 4000);
};

window.isAdmin = () => state.mediador?.rol === 'admin';

window.getInitials = (nomOrEmail) => {
  if (!nomOrEmail) return '?';
  const s = String(nomOrEmail).split('@')[0];
  const parts = s.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
};

window.getAvatarColor = (id) => {
  if (!id) return AVATAR_COLORS[0];
  const hash = String(id).split('').reduce((h, c) => h + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

window.getMediadorByUserId = (userId) => {
  if (!userId) return null;
  return state.mediadors.find(m => m.user_id === userId) || null;
};

window.renderAvatar = (userId, size = 'sm') => {
  const m = getMediadorByUserId(userId);
  const nom = m?.nom || m?.email || '?';
  const color = getAvatarColor(userId);
  const initials = getInitials(nom);
  return `<span class="avatar ${size}" style="background:${color}" title="${nom}">${initials}</span>`;
};

window.canEditClient = (clientId) => {
  if (isAdmin()) return true;
  const c = state.clients.find(x => x.id === clientId);
  if (!c) return false;
  if (c.user_id === state.user?.id) return true;
  return state.comparticions.some(s =>
    s.recurs_tipus === 'client' && s.recurs_id === clientId &&
    s.compartit_amb_id === state.user?.id && s.permis === 'editor'
  );
};

window.getSharedWith = (recursTipus, recursId) => {
  return state.comparticions
    .filter(s => s.recurs_tipus === recursTipus && s.recurs_id === recursId)
    .map(s => ({
      ...s,
      mediador: state.mediadors.find(m => m.user_id === s.compartit_amb_id)
    }));
};

// ==================================================================
// API call amb retry per a errors 429/529
// ==================================================================
window.apiCallWithRetry = async (url, options, maxRetries = 3) => {
  const delays = [2000, 5000, 10000];
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if ((response.status === 429 || response.status === 529) && attempt < maxRetries) {
        const delay = delays[attempt] || 10000;
        console.warn(`API ${response.status}, reintentant en ${delay}ms (intent ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (!response.ok) {
        const txt = await response.text();
        let parsedErr;
        try { parsedErr = JSON.parse(txt); } catch (e) {}
        const errMsg = parsedErr?.error?.message || txt;
        if (response.status === 429 || response.status === 529) {
          throw new Error("Els servidors d'IA estan saturats. Torna a provar en un moment.");
        }
        throw new Error(errMsg);
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && err.name === 'TypeError') {
        const delay = delays[attempt] || 10000;
        console.warn(`Error de xarxa, reintentant en ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
};

// ==================================================================
// Auth
// ==================================================================
window.switchAuthTab = (tab) => {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('signup-form').classList.toggle('hidden', tab !== 'signup');
};

window.doLogin = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Entrant...';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (err) {
    toast('Error: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Iniciar sessió';
  }
};

window.doSignup = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-signup');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Creant compte...';
  const nom = document.getElementById('signup-nom').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  try {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nom } }
    });
    if (error) throw error;
    if (data.user) {
      await new Promise(r => setTimeout(r, 500));
      const { data: existing } = await supabase.from('mediadors').select('id').eq('user_id', data.user.id).maybeSingle();
      if (!existing) {
        await supabase.from('mediadors').insert({
          user_id: data.user.id,
          nom, email,
          rol: 'agent',
          actiu: true
        });
      }
    }
    toast('Compte creat! Inicia sessió');
    switchAuthTab('login');
    document.getElementById('login-email').value = email;
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Crear compte';
  }
};

window.recoverPassword = async (e) => {
  if (e?.preventDefault) e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  if (!email) { toast('Posa primer el teu email', 'error'); return; }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    toast("Email de recuperació enviat (si l'adreça existeix)");
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
};

window.doLogout = async () => {
  if (!confirm('Vols tancar sessió?')) return;
  await supabase.auth.signOut();
  location.reload();
};

// ==================================================================
// Carregar dades (robust — no bloqueja si manca el mediador)
// ==================================================================
async function loadMediador() {
  try {
    const { data, error } = await supabase
      .from('mediadors')
      .select('*')
      .eq('user_id', state.user.id)
      .maybeSingle();

    if (error) {
      console.warn('Error carregant mediador:', error);
      // Fallback: crear un objecte mínim perquè l'app no es bloquegi
      state.mediador = {
        user_id: state.user.id,
        email: state.user.email,
        nom: state.user.email,
        rol: 'agent',
        actiu: true
      };
    } else if (!data) {
      console.warn('Mediador no trobat per a user_id', state.user.id);
      // Fallback també — possible problema de RLS o no creat encara
      state.mediador = {
        user_id: state.user.id,
        email: state.user.email,
        nom: state.user.email,
        rol: 'agent',
        actiu: true
      };
      toast("Sense perfil de mediador. Contacta l'administrador.", 'warning');
    } else {
      state.mediador = data;
    }
    state.profile = state.mediador;
  } catch (err) {
    console.error('Error fatal carregant mediador:', err);
    state.mediador = {
      user_id: state.user.id,
      email: state.user.email,
      nom: state.user.email,
      rol: 'agent',
      actiu: true
    };
    state.profile = state.mediador;
  }
}

async function loadUserConfig() {
  try {
    const { data, error } = await supabase
      .from('user_config')
      .select('*')
      .eq('user_id', state.user.id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') console.warn('Config:', error);
    state.config = data || {
      mediadors: ['Brokkom'],
      rams: ['Multiriscos industrial','Accidents conveni col·lectiu','Vehicles RC','RC Patronal','RC Mediambiental','Mercaderies CMR/ICC','Pèrdua de beneficis','Ciber','Salut col·lectiva','Retribució flexible','Plans de pensions','Vida','Altres'],
      model_fast: 'claude-haiku-4-5-20251001',
      model_smart: 'claude-haiku-4-5-20251001',
      llindar_contacte_dies: 21,
      llindar_oferta_sense_resposta_dies: 14
    };
  } catch (err) {
    console.error('Error config:', err);
    state.config = {
      rams: ['Multiriscos','Vehicles','RC','Vida','Salut','Altres'],
      model_fast: 'claude-haiku-4-5-20251001',
      model_smart: 'claude-haiku-4-5-20251001'
    };
  }
}

async function loadAllData() {
  const fetchAll = async (table) => {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`Error loading ${table}:`, error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn(`Error loading ${table}:`, err.message);
      return [];
    }
  };

  const results = await Promise.all([
    fetchAll('clients'),
    fetchAll('ofertes'),
    fetchAll('consolidats'),
    fetchAll('seguiments'),
    fetchAll('oportunitats'),
    fetchAll('venciments'),
    fetchAll('tasques'),
    fetchAll('asseguradores'),
    fetchAll('posts'),
    fetchAll('inbox_items'),
    fetchAll('notes'),
    fetchAll('agenda_events'),
    fetchAll('esborranys'),
    fetchAll('vinculacions'),
    fetchAll('comparticions'),
    fetchAll('mediadors')
  ]);

  state.clients = results[0];
  state.ofertes = results[1];
  state.consolidats = results[2];
  state.seguiments = results[3];
  state.oportunitats = results[4];
  state.venciments = results[5];
  state.tasques = results[6];
  state.asseguradores = results[7];
  state.posts = results[8];
  state.inbox = results[9];
  state.notes = results[10];
  state.agenda = results[11];
  state.esborranys = results[12];
  state.vinculacions = results[13];
  state.comparticions = results[14];
  state.mediadors = results[15];
  state.usuaris = state.mediadors;
}

window.refreshData = async (only) => {
  const reload = async (table, key) => {
    try {
      const { data } = await supabase.from(table).select('*');
      state[key] = data || [];
    } catch (err) {
      console.warn('refresh ' + table + ':', err.message);
    }
  };
  if (!only || only === 'clients') await reload('clients', 'clients');
  if (!only || only === 'ofertes') await reload('ofertes', 'ofertes');
  if (!only || only === 'consolidats') await reload('consolidats', 'consolidats');
  if (!only || only === 'seguiments') await reload('seguiments', 'seguiments');
  if (!only || only === 'oportunitats') await reload('oportunitats', 'oportunitats');
  if (!only || only === 'venciments') await reload('venciments', 'venciments');
  if (!only || only === 'tasques') await reload('tasques', 'tasques');
  if (!only || only === 'asseguradores') await reload('asseguradores', 'asseguradores');
  if (!only || only === 'posts') await reload('posts', 'posts');
  if (!only || only === 'inbox') await reload('inbox_items', 'inbox');
  if (!only || only === 'notes') await reload('notes', 'notes');
  if (!only || only === 'agenda') await reload('agenda_events', 'agenda');
  if (!only || only === 'esborranys') await reload('esborranys', 'esborranys');
  if (!only || only === 'vinculacions') await reload('vinculacions', 'vinculacions');
  if (!only || only === 'comparticions') await reload('comparticions', 'comparticions');
  if (!only || only === 'mediadors') {
    await reload('mediadors', 'mediadors');
    state.usuaris = state.mediadors;
  }
  if (typeof updateNavBadges === 'function') updateNavBadges();
};

// ==================================================================
// Startup
// ==================================================================
async function startApp() {
  try {
    document.getElementById('app-loading').classList.add('hidden');
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    const m = state.mediador;
    const nomMostrar = m?.nom || m?.email || 'Usuari';
    const initials = getInitials(nomMostrar);
    const avatarColor = getAvatarColor(m?.user_id || state.user?.id);

    document.getElementById('user-info-block').innerHTML = `
      <div class="user-avatar" style="background:${avatarColor}">${initials}</div>
      <div class="user-info">
        <div class="user-name">${nomMostrar}</div>
        <div class="user-role">
          <span class="role-badge ${isAdmin() ? 'role-admin' : 'role-agent'}">${m?.rol || 'agent'}</span>
        </div>
      </div>
      <button class="user-logout" onclick="doLogout()" title="Tancar sessió">⏻</button>
    `;

    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', !isAdmin());
    });

    await loadAllData();

    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.dataset.tab;
        if (tab) showTab(tab);
      });
    });

    if (typeof showTab === 'function') {
      showTab('dashboard');
    } else {
      console.error('showTab no està definit — modules.js no carregat');
      document.getElementById('tab-content').innerHTML = '<div class="empty-state">Error: modules.js no carregat</div>';
    }
  } catch (err) {
    console.error('Error a startApp:', err);
    toast('Error: ' + err.message, 'error');
    document.getElementById('app-loading').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('tab-content').innerHTML = '<div class="empty-state">Error carregant: ' + err.message + '</div>';
  }
}

function showLogin() {
  document.getElementById('app-loading').classList.add('hidden');
  document.getElementById('auth-page').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
}

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    state.user = session.user;
    try {
      await loadMediador();
      await loadUserConfig();
      await startApp();
    } catch (err) {
      console.error('Error en SIGNED_IN:', err);
      toast("Error en arrencar: " + err.message, 'error');
    }
  } else if (event === 'SIGNED_OUT') {
    state.user = null;
    state.mediador = null;
    state.profile = null;
    showLogin();
  }
});

(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      state.user = session.user;
      await loadMediador();
      await loadUserConfig();
      await startApp();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error('Error inicial:', err);
    showLogin();
  }
})();
