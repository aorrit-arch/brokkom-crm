// ==================================================================
// BROKKOM CRM v2 — App principal
// Stack: Supabase (BD + Auth) + Vercel Function (IA) + Vanilla JS
// ==================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Config Supabase (públic per disseny - autenticació via JWT)
const SUPABASE_URL = 'https://ovzvdmxbuoysckprjlej.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_s4ojmx3-jLvBd3gCRtPdyQ_dPS100N9';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estat global de l'app
window.state = {
  user: null,
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
  usuaris: [],
  currentTab: 'dashboard'
};
window.supabase = supabase;

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

// Helpers
window.uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2,5);
window.fmt = n => new Intl.NumberFormat('ca-ES').format(Math.round(n||0));
window.fmtEur = n => fmt(n) + '€';
window.fmtDate = d => { if(!d) return '—'; const dt = typeof d==='string'?new Date(d):d; return dt.toLocaleDateString('ca-ES'); };
window.daysFromNow = d => Math.ceil((new Date(d)-new Date())/86400000);

window.toast = (msg, type='success') => {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(()=>t.remove(), 4000);
};

window.isAdmin = () => state.profile?.rol === 'admin';

// ==================================================================
// AUTENTICACIÓ
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
    // L'event de login el captura el listener i carrega l'app
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
    // Actualitzar el nom al profile (es crea automàticament via trigger)
    if (data.user) {
      // Esperem un moment perquè el trigger creï el profile
      await new Promise(r => setTimeout(r, 500));
      await supabase.from('profiles').update({ nom }).eq('id', data.user.id);
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
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  if (!email) { toast('Posa primer el teu email', 'error'); return; }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    toast('Email de recuperació enviat (si l\'adreça existeix)');
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
// CÀRREGA INICIAL DE L'APP
// ==================================================================

async function loadProfile() {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', state.user.id).single();
  if (error) throw error;
  state.profile = data;
}

async function loadUserConfig() {
  const { data, error } = await supabase.from('user_config').select('*').eq('user_id', state.user.id).single();
  if (error && error.code !== 'PGRST116') console.warn('Config:', error);
  state.config = data || {
    mediadors: ['Brokkom'],
    rams: ['Multiriscos industrial','Accidents conveni col·lectiu','Vehicles RC','RC Patronal','RC Mediambiental','Mercaderies CMR/ICC','Pèrdua de beneficis','Ciber','Salut col·lectiva','Retribució flexible','Plans de pensions','Vida','Altres'],
    model_fast: 'claude-haiku-4-5-20251001',
    model_smart: 'claude-haiku-4-5-20251001'
  };
}

async function loadAllData() {
  const fetchAll = async (table) => {
    const { data, error } = await supabase.from(table).select('*');
    if (error) { console.warn(`Error loading ${table}:`, error.message); return []; }
    return data || [];
  };
  const [clients, ofertes, consolidats, seguiments, oportunitats, venciments, tasques, asseguradores, posts, inbox, notes, agenda, esborranys] = await Promise.all([
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
    fetchAll('esborranys')
  ]);
  state.clients = clients;
  state.ofertes = ofertes;
  state.consolidats = consolidats;
  state.seguiments = seguiments;
  state.oportunitats = oportunitats;
  state.venciments = venciments;
  state.tasques = tasques;
  state.asseguradores = asseguradores;
  state.posts = posts;
  state.inbox = inbox;
  state.notes = notes;
  state.agenda = agenda;
  state.esborranys = esborranys;
  if (isAdmin()) {
    const { data: users } = await supabase.from('profiles').select('*');
    state.usuaris = users || [];
  }
}

window.refreshData = async (only) => {
  if (!only || only === 'clients') state.clients = (await supabase.from('clients').select('*')).data || [];
  if (!only || only === 'ofertes') state.ofertes = (await supabase.from('ofertes').select('*')).data || [];
  if (!only || only === 'consolidats') state.consolidats = (await supabase.from('consolidats').select('*')).data || [];
  if (!only || only === 'seguiments') state.seguiments = (await supabase.from('seguiments').select('*')).data || [];
  if (!only || only === 'oportunitats') state.oportunitats = (await supabase.from('oportunitats').select('*')).data || [];
  if (!only || only === 'venciments') state.venciments = (await supabase.from('venciments').select('*')).data || [];
  if (!only || only === 'tasques') state.tasques = (await supabase.from('tasques').select('*')).data || [];
  if (!only || only === 'asseguradores') state.asseguradores = (await supabase.from('asseguradores').select('*')).data || [];
  if (!only || only === 'posts') state.posts = (await supabase.from('posts').select('*')).data || [];
  if (!only || only === 'inbox') state.inbox = (await supabase.from('inbox_items').select('*')).data || [];
  if (!only || only === 'notes') state.notes = (await supabase.from('notes').select('*')).data || [];
  if (!only || only === 'agenda') state.agenda = (await supabase.from('agenda_events').select('*')).data || [];
  if (!only || only === 'esborranys') state.esborranys = (await supabase.from('esborranys').select('*')).data || [];
  updateNavBadges();
};

async function startApp() {
  document.getElementById('app-loading').classList.add('hidden');
  document.getElementById('auth-page').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');

  // Mostrar info usuari
  const nomMostrar = state.profile.nom || state.profile.email;
  document.getElementById('user-info-block').innerHTML = `
    <strong>${nomMostrar}</strong>
    <div>${state.profile.email}</div>
    <div style="margin-top:4px"><span class="role-badge ${state.profile.rol==='admin'?'role-admin':'role-agent'}">${state.profile.rol}</span></div>
    <button class="btn-logout" onclick="doLogout()">Tancar sessió</button>
  `;

  // Mostrar opcions d'admin
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin());
  });

  // Carregar dades
  try {
    await loadAllData();
  } catch (err) {
    toast('Error carregant dades: ' + err.message, 'error');
  }

  // Navegació
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      const tab = el.dataset.tab;
      if (tab) showTab(tab);
    });
  });

  // Render inicial
  showTab('dashboard');
}

function showLogin() {
  document.getElementById('app-loading').classList.add('hidden');
  document.getElementById('auth-page').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
}

// Listener canvis d'autenticació
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    state.user = session.user;
    try {
      await loadProfile();
      await loadUserConfig();
      await startApp();
    } catch (err) {
      toast('Error en arrencar: ' + err.message, 'error');
      console.error(err);
    }
  } else if (event === 'SIGNED_OUT') {
    state.user = null;
    state.profile = null;
    showLogin();
  }
});

// Verificar sessió inicial
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    state.user = session.user;
    try {
      await loadProfile();
      await loadUserConfig();
      await startApp();
    } catch (err) {
      console.error(err);
      showLogin();
    }
  } else {
    showLogin();
  }
})();
