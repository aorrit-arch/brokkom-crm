// ==================================================================
// BROKKOM CRM · brokkom-multiusuari.js
// Afegit aïllat (no modifica la lògica central). Es carrega l'últim.
//
// Funció: l'admin, per defecte, veu NOMÉS les seves dades a les taules
// per usuari; amb el botó del lateral pot passar a veure TOT L'EQUIP
// (incloses les tasques dels altres usuaris).
// Els usuaris no-admin ja només veuen el seu (ho garanteix la RLS),
// així que aquest filtre només afecta l'admin.
// ==================================================================
console.log('🧩 brokkom-multiusuari.js carregat');

// Taules que a la base de dades són "per usuari" (la resta són compartides)
const MU_OWNER_TABLES = ['clients','ofertes','consolidats','seguiments','oportunitats','venciments','tasques'];

// Està l'admin en mode "veure-ho tot"?
window.isViewAll = () =>
  !!(window.isAdmin && window.isAdmin()) &&
  localStorage.getItem('brokkom_view_all') === '1';

// Aplica l'àmbit de visió. Només actua si ets ADMIN i estàs en mode "només jo".
function muApplyScope() {
  try {
    if (!window.isAdmin || !window.isAdmin() || window.isViewAll()) return;
    const me = window.state && window.state.user && window.state.user.id;
    if (!me) return;
    MU_OWNER_TABLES.forEach(t => {
      const arr = window.state[t];
      if (!Array.isArray(arr)) return;
      window.state[t] = (t === 'tasques')
        ? arr.filter(r => r.user_id === me || r.assigned_to === me)
        : arr.filter(r => r.user_id === me);
    });
  } catch (e) {
    console.warn('muApplyScope:', e);
  }
}

// Actualitza l'etiqueta i la visibilitat del botó del lateral
function muUpdateToggle() {
  const el = document.getElementById('mu-scope-toggle');
  if (!el) return;
  const isAdm = !!(window.isAdmin && window.isAdmin());
  el.classList.toggle('hidden', !isAdm);
  if (!isAdm) return;
  const all = window.isViewAll();
  el.innerHTML = all
    ? '<span>🌐</span><span>Veient: <strong>tot l\'equip</strong></span>'
    : '<span>👤</span><span>Veient: <strong>només jo</strong></span>';
  el.onclick = window.toggleViewAll;
  el.title = 'Canvia entre veure només les teves dades o les de tot l\'equip';
}

// Alterna entre "només jo" i "tot l'equip" i recarrega les dades senceres
window.toggleViewAll = async function() {
  const on = localStorage.getItem('brokkom_view_all') === '1';
  localStorage.setItem('brokkom_view_all', on ? '0' : '1');
  try { if (window.refreshData) await window.refreshData(); } catch (e) { console.warn(e); }
  try { window.renderCurrentTab && window.renderCurrentTab(); } catch (e) {}
  try { window.updateNavBadges && window.updateNavBadges(); } catch (e) {}
  muUpdateToggle();
  if (window.toast) window.toast(window.isViewAll() ? 'Veient les dades de tot l\'equip' : 'Veient només les teves dades');
};

// Embolcallem render/recompte perquè apliquin l'àmbit JUST ABANS de pintar o comptar.
['renderCurrentTab', 'updateNavBadges'].forEach(fnName => {
  const orig = window[fnName];
  if (typeof orig === 'function') {
    window[fnName] = function() {
      muApplyScope();
      return orig.apply(this, arguments);
    };
  }
});

// Quan es refresca el bloc d'usuari, actualitzem també l'etiqueta del botó.
const _muOrigRefreshUserUI = window.refreshUserUI;
window.refreshUserUI = function() {
  if (typeof _muOrigRefreshUserUI === 'function') _muOrigRefreshUserUI.apply(this, arguments);
  muUpdateToggle();
};

// Passades de seguretat (per si ja hi ha sessió i dades carregades)
setTimeout(() => { try { muUpdateToggle(); muApplyScope(); window.updateNavBadges && window.updateNavBadges(); } catch (e) {} }, 1500);
setTimeout(() => { try { muUpdateToggle(); } catch (e) {} }, 3500);
