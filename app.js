// ==================================================================
// BROKKOM CRM · app.js v3 — AUTOSUFICIENT
// Funciona sense modules.js ni modals.js (per ara)
// ==================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ovzvdmxbuoysckprjlej.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_s4ojmx3-jLvBd3gCRtPdyQ_dPS100N9';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabase;

console.log('🚀 app.js carregat — Brokkom CRM v3');

// State global
window.state = {
  user: null,
  mediador: null,
  profile: null,
  config: null,
  clients: [], ofertes: [], consolidats: [], seguiments: [],
  oportunitats: [], venciments: [], tasques: [], asseguradores: [],
  posts: [], inbox: [], notes: [], agenda: [], esborranys: [],
  vinculacions: [], comparticions: [],
  usuaris: [], mediadors: [],
  currentTab: 'dashboard'
};

window.ESTATS_PIPELINE = ['Lead','Qualificat','Cotitzant','Oferta enviada','En negociació','Tancada guanyada'];
window.ESTATS_PERDUDA = 'Tancada perduda';
window.TOPICS = [];

// Helpers
window.uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2,5);
window.fmt = n => new Intl.NumberFormat('ca-ES').format(Math.round(n||0));
window.fmtEur = n => fmt(n) + '€';
window.fmtDate = d => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('ca-ES');
};
window.daysFromNow = d => Math.ceil((new Date(d) - new Date()) / 86400000);
window.isAdmin = () => state.mediador?.rol === 'admin';
window.getInitials = (s) => {
  if (!s) return '?';
  const str = String(s).split('@')[0];
  const parts = str.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.slice(0, 2).toUpperCase();
};

window.toast = (msg, type = 'success') => {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  const container = document.getElementById('toast-container');
  if (container) container.appendChild(t);
  setTimeout(() => t.remove(), 4000);
};

// ==================================================================
// AUTH
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
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value
    });
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
  btn.innerHTML = '<span class="loader"></span> Creant...';
  try {
    const nom = document.getElementById('signup-nom').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nom } } });
    if (error) throw error;
    if (data.user) {
      await new Promise(r => setTimeout(r, 500));
      const { data: existing } = await supabase.from('mediadors').select('id').eq('user_id', data.user.id).maybeSingle();
      if (!existing) {
        await supabase.from('mediadors').insert({
          user_id: data.user.id, nom, email, rol: 'agent', actiu: true
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
    await supabase.auth.resetPasswordForEmail(email);
    toast('Email de recuperació enviat');
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
};

window.doLogout = async () => {
  if (!confirm('Tancar sessió?')) return;
  await supabase.auth.signOut();
  location.reload();
};

// ==================================================================
// CÀRREGA DE DADES (robust)
// ==================================================================
async function loadMediador() {
  console.log('📥 Carregant mediador per a user_id:', state.user.id);
  try {
    const { data, error } = await supabase
      .from('mediadors')
      .select('*')
      .eq('user_id', state.user.id)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ Error mediador:', error.message);
    }

    state.mediador = data || {
      user_id: state.user.id,
      email: state.user.email,
      nom: state.user.email,
      rol: 'agent',
      actiu: true
    };
    state.profile = state.mediador;
    console.log('✅ Mediador carregat:', state.mediador.nom, '· rol:', state.mediador.rol);
  } catch (err) {
    console.error('❌ Error fatal mediador:', err);
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
    const { data } = await supabase
      .from('user_config').select('*')
      .eq('user_id', state.user.id).maybeSingle();
    state.config = data || {
      rams: ['Multiriscos industrial','Accidents conveni col·lectiu','Vehicles RC','RC Patronal','Mercaderies CMR/ICC','Ciber','Salut col·lectiva','Vida','Altres'],
      model_fast: 'claude-haiku-4-5-20251001',
      model_smart: 'claude-haiku-4-5-20251001'
    };
  } catch (err) {
    console.warn('Config error:', err.message);
    state.config = { rams: ['Multiriscos','Vehicles','Vida','Altres'], model_fast: 'claude-haiku-4-5-20251001', model_smart: 'claude-haiku-4-5-20251001' };
  }
}

async function loadAllData() {
  console.log('📥 Carregant totes les dades...');
  const fetchAll = async (table) => {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.warn(`⚠️ ${table}:`, error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn(`⚠️ ${table}:`, err.message);
      return [];
    }
  };

  const tables = ['clients','ofertes','consolidats','seguiments','oportunitats','venciments','tasques','asseguradores','posts','inbox_items','notes','agenda_events','esborranys','vinculacions','comparticions','mediadors'];
  const stateKeys = ['clients','ofertes','consolidats','seguiments','oportunitats','venciments','tasques','asseguradores','posts','inbox','notes','agenda','esborranys','vinculacions','comparticions','mediadors'];

  const results = await Promise.all(tables.map(t => fetchAll(t)));
  tables.forEach((t, i) => {
    state[stateKeys[i]] = results[i];
  });
  state.usuaris = state.mediadors;
  console.log('✅ Dades carregades:', tables.map((t,i) => `${t}:${results[i].length}`).join(' · '));
}

window.refreshData = async (only) => {
  const map = {
    clients: 'clients', ofertes: 'ofertes', consolidats: 'consolidats',
    seguiments: 'seguiments', oportunitats: 'oportunitats', venciments: 'venciments',
    tasques: 'tasques', asseguradores: 'asseguradores', posts: 'posts',
    inbox: 'inbox_items', notes: 'notes', agenda: 'agenda_events',
    esborranys: 'esborranys', vinculacions: 'vinculacions',
    comparticions: 'comparticions', mediadors: 'mediadors'
  };
  if (only && map[only]) {
    const { data } = await supabase.from(map[only]).select('*');
    state[only] = data || [];
    if (only === 'mediadors') state.usuaris = state.mediadors;
  } else {
    await loadAllData();
  }
  if (typeof updateNavBadges === 'function') updateNavBadges();
  if (typeof renderCurrentTab === 'function') renderCurrentTab();
};

// ==================================================================
// NAVEGACIÓ I RENDER BÀSIC (autosuficient)
// ==================================================================
window.updateNavBadges = () => {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('nav-clients', state.clients.length);
  set('nav-pipeline', state.ofertes.filter(o => !['Tancada guanyada','Tancada perduda'].includes(o.estat)).length);
  set('nav-consolidats', state.consolidats.length);
  set('nav-opps', state.oportunitats.filter(o => o.estat !== 'Descartada').length);
  set('nav-venc', state.venciments.length);
  set('nav-tasques', state.tasques.filter(t => t.estat === 'pendent').length);
  set('nav-inbox', state.inbox.filter(i => i.estat === 'pendent').length);
  set('nav-notes', state.notes.length);
  set('nav-esborranys', (state.esborranys || []).filter(e => e.estat !== 'arxivat').length);
  const now = new Date(); now.setHours(0,0,0,0);
  set('nav-agenda', state.agenda.filter(e => new Date(e.data_inici) >= now).length);
};

window.showTab = (tab) => {
  state.currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  renderCurrentTab();
  updateNavBadges();
};

window.renderCurrentTab = () => {
  const tab = state.currentTab;
  const c = document.getElementById('tab-content');
  if (!c) return;
  c.innerHTML = '';

  // Si modules.js està carregat i té el render, l'usem
  const renderers = {
    dashboard: window.renderDashboard,
    clients: window.renderClients,
    pipeline: window.renderPipeline,
    consolidats: window.renderConsolidats,
    seguiments: window.renderSeguiments,
    oportunitats: window.renderOpps,
    venciments: window.renderVenciments,
    tasques: window.renderTasques,
    asseguradores: window.renderAsseguradores,
    comunicacio: window.renderComunicacio,
    usuaris: window.renderUsuaris,
    ia: window.renderIA,
    config: window.renderConfig,
    inbox: window.renderInbox,
    notes: window.renderNotes,
    agenda: window.renderAgenda,
    esborranys: window.renderEsborranys
  };

  if (typeof renderers[tab] === 'function') {
    try {
      renderers[tab]();
      return;
    } catch (err) {
      console.error(`Error render ${tab}:`, err);
    }
  }

  // Fallback: render bàsic intern
  renderBasicTab(tab);
};

// Render bàsic per quan modules.js falla o no hi és
function renderBasicTab(tab) {
  const c = document.getElementById('tab-content');
  const titulars = {
    dashboard: ['🏠 Tauler', "Resum comercial d'avui"],
    clients: ['👥 Clients', `${state.clients.length} clients a la cartera`],
    pipeline: ['🎯 Pipeline', "Ofertes actives"],
    consolidats: ['🏆 Consolidats', "Tancaments guanyats"],
    seguiments: ['📞 Seguiments', "Historial d'interaccions"],
    oportunitats: ['💡 Oportunitats', "Cross-selling i upselling"],
    venciments: ['📆 Venciments', "Sistema 90/30/7"],
    tasques: ['✓ Tasques', "Pendents i fetes"],
    asseguradores: ['🛡️ Asseguradores', "Catàleg"],
    comunicacio: ['📰 Posts LinkedIn', "Calendari editorial"],
    usuaris: ['👤 Usuaris', "Mediadors registrats"],
    ia: ['🤖 IA assistent', "Processament intel·ligent"],
    config: ['⚙️ Configuració', "Preferències i dades"],
    inbox: ['📥 Bústia', "Captura ràpida"],
    notes: ['💭 Notes', "Idees i comentaris"],
    agenda: ['📅 Agenda', "Esdeveniments"],
    esborranys: ['📝 Esborranys', "A mig fer"]
  };
  const [tit, sub] = titulars[tab] || [tab, ''];

  let preview = '';
  if (tab === 'dashboard') {
    const ofertesObertes = state.ofertes.filter(o => !['Tancada guanyada','Tancada perduda'].includes(o.estat));
    const tancMes = state.consolidats.filter(c => {
      const d = new Date(c.data_tancament);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    preview = `
      <div class="metrics">
        <div class="metric">
          <div class="metric-label">Pipeline</div>
          <div class="metric-value">${ofertesObertes.length}</div>
          <div class="metric-sub">ofertes obertes</div>
        </div>
        <div class="metric">
          <div class="metric-label">Tancaments mes</div>
          <div class="metric-value">${tancMes.length}</div>
          <div class="metric-sub">guanyats</div>
        </div>
        <div class="metric">
          <div class="metric-label">Clients</div>
          <div class="metric-value">${state.clients.length}</div>
          <div class="metric-sub">a la cartera</div>
        </div>
        <div class="metric">
          <div class="metric-label">Oportunitats</div>
          <div class="metric-value">${state.oportunitats.filter(o => o.estat !== 'Descartada').length}</div>
          <div class="metric-sub">detectades</div>
        </div>
      </div>
    `;
  } else if (tab === 'clients' && state.clients.length > 0) {
    preview = `
      <div class="card">
        <div style="font-size:12px;color:var(--text-3);margin-bottom:10px">Últims clients afegits:</div>
        ${state.clients.slice(0, 10).map(c => `
          <div style="padding:8px 0;border-bottom:0.5px solid var(--border);display:flex;justify-content:space-between;font-size:13px">
            <span style="font-weight:500">${c.empresa || c.nom || '?'}</span>
            <span style="color:var(--text-3);font-size:11px">${c.cif || c.email || ''}</span>
          </div>
        `).join('')}
      </div>
    `;
  } else if (tab === 'usuaris' && isAdmin()) {
    preview = `
      <div class="card" style="padding:0;overflow-x:auto">
        <table class="table">
          <thead><tr><th>Nom</th><th>Email</th><th>Rol</th><th>Actiu</th></tr></thead>
          <tbody>${state.mediadors.map(u => `
            <tr>
              <td><strong>${u.nom || '—'}</strong></td>
              <td>${u.email}</td>
              <td><span class="role-badge ${u.rol === 'admin' ? 'role-admin' : 'role-agent'}">${u.rol}</span></td>
              <td>${u.actiu ? '✓' : '✗'}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    `;
  }

  c.innerHTML = `
    <div class="topbar">
      <div>
        <div class="page-title">${tit}</div>
        <div class="page-sub">${sub}</div>
      </div>
    </div>
    ${preview}
    ${!preview ? `<div class="card"><div class="empty-state"><div class="empty-icon">🚧</div>Aquesta secció està en construcció<br><br><span style="font-size:11px;color:var(--text-3)">L'estètica nova s'aplicarà al següent pas.<br>De moment podeu veure el tauler i clients funcionant.</span></div></div>` : ''}
  `;
}

// ==================================================================
// STARTUP
// ==================================================================
async function startApp() {
  console.log('🚀 startApp iniciat');
  try {
    document.getElementById('app-loading').classList.add('hidden');
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    const m = state.mediador;
    const nomMostrar = m?.nom || m?.email || 'Usuari';
    const initials = getInitials(nomMostrar);

    document.getElementById('user-info-block').innerHTML = `
      <div class="user-avatar" style="background:#0F766E">${initials}</div>
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

    showTab('dashboard');
    console.log('✅ App iniciada correctament');
  } catch (err) {
    console.error('❌ Error startApp:', err);
    document.getElementById('app-loading').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('tab-content').innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <strong>Error al carregar:</strong><br>
          ${err.message}<br><br>
          <button class="btn btn-primary" onclick="location.reload()">Tornar a provar</button>
        </div>
      </div>
    `;
  }
}

function showLogin() {
  document.getElementById('app-loading').classList.add('hidden');
  document.getElementById('auth-page').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
}

supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('🔐 Auth event:', event);
  if (event === 'SIGNED_IN' && session?.user) {
    state.user = session.user;
    try {
      await loadMediador();
      await loadUserConfig();
      await startApp();
    } catch (err) {
      console.error('Error SIGNED_IN:', err);
    }
  } else if (event === 'SIGNED_OUT') {
    state.user = null;
    state.mediador = null;
    state.profile = null;
    showLogin();
  }
});

// Init
(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      console.log('🔐 Sessió activa:', session.user.email);
      state.user = session.user;
      await loadMediador();
      await loadUserConfig();
      await startApp();
    } else {
      console.log('🔐 Sense sessió, mostrant login');
      showLogin();
    }
  } catch (err) {
    console.error('❌ Error inicial:', err);
    document.getElementById('app-loading').classList.add('hidden');
    showLogin();
  }
})();
