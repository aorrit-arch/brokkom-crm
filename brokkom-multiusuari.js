// ==================================================================
// BROKKOM CRM · brokkom-multiusuari.js
// Afegit aïllat (no modifica la lògica central). Es carrega l'últim.
//
// Funció: l'admin, per defecte, veu NOMÉS les seves dades a les taules
// per usuari; amb un botó al lateral pot passar a veure TOT L'EQUIP.
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
// (Per a no-admins o en mode "tot l'equip" no fa res: deixa les dades tal com estan.)
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

// Alterna entre "només jo" i "tot l'equip" i recarrega les dades senceres
// (perquè en passar a "tot l'equip" recuperem les files dels altres).
window.toggleViewAll = async function() {
  const on = localStorage.getItem('brokkom_view_all') === '1';
  localStorage.setItem('brokkom_view_all', on ? '0' : '1');
  try { if (window.refreshData) await window.refreshData(); } catch (e) { console.warn(e); }
  try { window.renderCurrentTab && window.renderCurrentTab(); } catch (e) {}
  try { window.updateNavBadges && window.updateNavBadges(); } catch (e) {}
  try { window.refreshUserUI && window.refreshUserUI(); } catch (e) {}
};

// Botó al lateral (només visible per a admins)
function muInjectToggle() {
  const userBlock = document.getElementById('user-info-block');
  const sidebar = document.querySelector('.sidebar');
  let el = document.getElementById('mu-scope-toggle');

  if (!window.isAdmin || !window.isAdmin()) { if (el) el.remove(); return; }

  if (!el) {
    el = document.createElement('div');
    el.id = 'mu-scope-toggle';
    el.style.cssText =
      'margin:8px 12px;padding:8px 10px;border:1px solid var(--border);' +
      'border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px;' +
      'font-size:12.5px;color:var(--text-2);user-select:none';
    if (userBlock && userBlock.parentNode) userBlock.parentNode.insertBefore(el, userBlock);
    else if (sidebar) sidebar.appendChild(el);
  }

  const all = window.isViewAll();
  el.innerHTML = all
    ? '<span>🌐</span><span>Veient: <strong>tot l\'equip</strong></span>'
    : '<span>👤</span><span>Veient: <strong>només jo</strong></span>';
  el.title = 'Canvia entre veure només les teves dades o les de tot l\'equip';
  el.onclick = window.toggleViewAll;
}

// Embolcallem les funcions de render/recompte perquè apliquin l'àmbit JUST ABANS
// de pintar o comptar. Així el filtre val sigui com sigui que s'hagin carregat
// les dades, sense tocar cap funció de càrrega ni cap renderitzador.
['renderCurrentTab', 'updateNavBadges'].forEach(fnName => {
  const orig = window[fnName];
  if (typeof orig === 'function') {
    window[fnName] = function() {
      muApplyScope();
      return orig.apply(this, arguments);
    };
  }
});

// El botó s'ha de tornar a pintar cada cop que es refresca el bloc d'usuari.
const _muOrigRefreshUserUI = window.refreshUserUI;
window.refreshUserUI = function() {
  if (typeof _muOrigRefreshUserUI === 'function') _muOrigRefreshUserUI.apply(this, arguments);
  muInjectToggle();
};

// Primera passada (per si ja hi ha sessió i dades carregades)
setTimeout(() => { try { muInjectToggle(); muApplyScope(); window.updateNavBadges && window.updateNavBadges(); } catch (e) {} }, 1200);
