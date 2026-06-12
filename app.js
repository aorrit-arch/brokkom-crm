// ============ STATE ============
const titles = {
  'home':           { path: ['covera.es'], views: ['home'], name: 'COVERA', count: 10 },
  'persones':       { path: ['covera.es','persones'], views: ['home','persones'], name: 'Persones', count: 11 },
  'autonoms':       { path: ['covera.es','autonoms'], views: ['home','autonoms'], name: 'Autònoms', count: 11 },
  'empreses':       { path: ['covera.es','empreses'], views: ['home','empreses'], name: 'Empreses', count: 11 },
  'collectius':     { path: ['covera.es','collectius'], views: ['home','collectius'], name: 'Col·lectius', count: 11 },
  'previsio':       { path: ['covera.es','previsio'], views: ['home','previsio'], name: 'Previsió', count: 10 },
  'recursos':       { path: ['covera.es','recursos'], views: ['home','recursos'], name: 'Recursos', count: 6 },
  'doc-manifest':   { path: ['covera.es','manifest.md'], views: ['home','doc-manifest'], name: 'Manifest.md', count: 1 },
  'doc-sobre':      { path: ['covera.es','sobre.md'], views: ['home','doc-sobre'], name: 'Sobre.md', count: 1 },
  'doc-persones':   { path: ['covera.es','persones','llegeix-me.md'], views: ['home','persones','doc-persones'], name: 'Llegeix-me.md', count: 1 },
  'doc-autonoms':   { path: ['covera.es','autonoms','llegeix-me.md'], views: ['home','autonoms','doc-autonoms'], name: 'Llegeix-me.md', count: 1 },
  'doc-empreses':   { path: ['covera.es','empreses','llegeix-me.md'], views: ['home','empreses','doc-empreses'], name: 'Llegeix-me.md', count: 1 },
  'doc-collectius': { path: ['covera.es','collectius','llegeix-me.md'], views: ['home','collectius','doc-collectius'], name: 'Llegeix-me.md', count: 1 },
  'doc-previsio':   { path: ['covera.es','previsio','llegeix-me.md'], views: ['home','previsio','doc-previsio'], name: 'Llegeix-me.md', count: 1 },
  'app-diagnostic': { path: ['covera.es','diagnostic.app'], views: ['home','app-diagnostic'], name: 'Diagnòstic.app', count: 1 },
  'app-cotitzador': { path: ['covera.es','collectius','cotitzador.app'], views: ['home','collectius','app-cotitzador'], name: 'Cotitzador.app', count: 1 }
};

let history = ['home'];
let historyIdx = 0;

function navigate(view, fromHistory) {
  if (!titles[view]) return;
  document.querySelectorAll('.view, .doc-view, .app-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');

  // Update sidebar active state
  document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
  const sidebarMatch = document.querySelector('.sidebar-item[data-view="' + view + '"]');
  if (sidebarMatch) sidebarMatch.classList.add('active');
  // If it's a doc, highlight its parent folder
  else if (view.startsWith('doc-')) {
    const parent = view.replace('doc-','');
    const sb = document.querySelector('.sidebar-item[data-view="' + parent + '"]');
    if (sb) sb.classList.add('active');
  }

  // Address bar: every segment is a clickable link that returns exactly to that level
  const path = titles[view].path;
  const views = titles[view].views;
  const pathHtml = path.map((seg, i) => {
    const isLast = i === path.length - 1;
    const targetView = views[i];
    const segHtml = '<button class="ab-segment' + (isLast ? ' current' : '') + '"' +
      (!isLast ? ' onclick="navigate(\'' + targetView + '\')"' : '') + '>' +
      (i === 0 ? '<svg class="ab-favicon"><use href="#ic-c3"/></svg>' : '') +
      '<span>' + seg + '</span>' +
      '</button>';
    return (i > 0 ? '<span class="ab-sep">/</span>' : '') + segHtml;
  }).join('');
  document.getElementById('addressBar').innerHTML = pathHtml;

  // Window title
  document.getElementById('windowTitle').textContent = view === 'home' ? 'COVERA' : 'COVERA — ' + titles[view].name;

  // Status count
  const count = titles[view].count;
  document.getElementById('statusCount').textContent = count + (count === 1 ? ' element' : ' elements');

  // History
  if (!fromHistory) {
    history = history.slice(0, historyIdx + 1);
    history.push(view);
    historyIdx = history.length - 1;
  }
  updateNavButtons();

  // Scroll to top inside content
  document.getElementById('content').scrollTop = 0;

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.querySelector('.mobile-overlay').classList.remove('show');
}

function goBack() {
  if (historyIdx > 0) {
    historyIdx--;
    navigate(history[historyIdx], true);
  }
}
function goForward() {
  if (historyIdx < history.length - 1) {
    historyIdx++;
    navigate(history[historyIdx], true);
  }
}
function updateNavButtons() {
  document.getElementById('btnBack').disabled = historyIdx === 0;
  document.getElementById('btnFwd').disabled = historyIdx >= history.length - 1;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.querySelector('.mobile-overlay').classList.toggle('show');
}

// ============ DIAGNÒSTIC ============
let diagStep = 1;
const diagAnswers = {};
function diagAnswer(key, value) {
  diagAnswers[key] = value;
  if (diagStep < 5) diagGo(diagStep + 1);
}
function diagBack() { if (diagStep > 1) diagGo(diagStep - 1); }
function diagGo(step) {
  diagStep = step;
  document.querySelectorAll('.diag-step').forEach(s => s.classList.remove('active'));
  document.querySelector('.diag-step[data-step="' + step + '"]').classList.add('active');
  const dots = document.querySelectorAll('#diagProgress .diag-dot');
  dots.forEach((d, i) => {
    d.classList.remove('done','current');
    if (i < step - 1) d.classList.add('done');
    if (i === step - 1) d.classList.add('current');
  });
}
function diagSubmit() {
  const nom = document.getElementById('diag-nom').value.trim();
  const email = document.getElementById('diag-email').value.trim();
  if (!nom || !email) { alert('Necessitem el teu nom i email per enviar-te el diagnòstic.'); return; }
  diagAnswers.nom = nom; diagAnswers.email = email;
  diagAnswers.telefon = document.getElementById('diag-tel').value.trim();
  // Aquí connectaríem amb el CRM real (HubSpot, Brevo…)
  document.querySelectorAll('.diag-step, #diagProgress').forEach(el => el.style.display = 'none');
  document.getElementById('diagThanks').classList.add('show');
}

// ============ COTITZADOR ============
function togglePill(input) {
  const pill = input.closest('.cot-pill');
  if (input.checked) pill.classList.add('checked');
  else pill.classList.remove('checked');
}
document.querySelectorAll('.cot-pill input').forEach(i => {
  if (i.checked) i.closest('.cot-pill').classList.add('checked');
});

function cotitzar() {
  const activitat = document.getElementById('cot-activitat').value;
  const participants = Math.max(1, parseInt(document.getElementById('cot-participants').value) || 1);
  const dies = Math.max(1, parseInt(document.getElementById('cot-dies').value) || 1);
  const monitors = Math.max(0, parseInt(document.getElementById('cot-monitors').value) || 0);
  const menors = document.getElementById('cot-menors').checked;
  const rc = document.getElementById('cot-rc').checked;
  const defensa = document.getElementById('cot-defensa').checked;
  const assistencia = document.getElementById('cot-assistencia').checked;

  const mult = { casal:1.0, colonia:1.25, campus:1.35, formacio:0.85, excursio:0.95, esdeveniment:1.1 }[activitat] || 1.0;
  let base = participants * dies * 0.55 * mult;
  if (menors) base += participants * dies * 0.25;
  base += monitors * dies * 0.45;
  if (rc) base += 120 + participants * 1.2;
  if (defensa) base += 60 + participants * 0.4;
  if (assistencia) base += 90 + participants * 0.6;
  base = Math.max(base, 75);
  const min = Math.round(base * 0.85);
  const max = Math.round(base * 1.15);
  document.getElementById('cot-preu').textContent = min + ' – ' + max + ' €';
  document.getElementById('cot-rang').textContent = 'Estimació per ' + dies + ' dies · ' + participants + ' persones';
}
cotitzar();

// ============ CLOCK ============
function tick() {
  const d = new Date();
  const days = ['dg','dl','dt','dc','dj','dv','ds'];
  const months = ['gen','feb','mar','abr','mai','jun','jul','ago','set','oct','nov','des'];
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  document.getElementById('clock').textContent = days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()] + '  ' + h + ':' + m;
}
tick(); setInterval(tick, 30000);

// ============ KEYBOARD ============
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.altKey) && e.key === 'ArrowLeft') { goBack(); e.preventDefault(); }
  if ((e.metaKey || e.altKey) && e.key === 'ArrowRight') { goForward(); e.preventDefault(); }
  if (e.key === 'Escape') { navigate('home'); }
});

// ============ SEARCH (basic filter on current view) ============
document.getElementById('searchInput').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  const view = document.querySelector('.view.active, .doc-view.active, .app-view.active');
  if (!view) return;
  view.querySelectorAll('.item').forEach(item => {
    const name = item.textContent.toLowerCase();
    item.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
});

// ============ MENU BAR DROPDOWNS ============
function toggleMenu(name, ev) {
  if (ev) ev.stopPropagation();
  const menu = document.getElementById('menu-' + name);
  if (!menu) return;
  const trigger = menu.previousElementSibling;
  const wasOpen = menu.classList.contains('open');
  closeAllMenus();
  if (!wasOpen) {
    menu.classList.add('open');
    trigger.classList.add('active');
  }
}
function closeAllMenus() {
  document.querySelectorAll('.menu-dropdown.open').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.menubar-item.active').forEach(b => b.classList.remove('active'));
}
// Close on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menubar-item-wrap')) closeAllMenus();
});
// Auto-close after clicking an action inside a menu
document.querySelectorAll('.menu-action').forEach(a => {
  a.addEventListener('click', () => setTimeout(closeAllMenus, 60));
});
// Hover-to-switch when one menu is already open (macOS behaviour)
document.querySelectorAll('.menubar-item-wrap').forEach(wrap => {
  wrap.addEventListener('mouseenter', () => {
    const anyOpen = document.querySelector('.menu-dropdown.open');
    if (anyOpen) {
      const trigger = wrap.querySelector('.menubar-item');
      const id = trigger.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
      if (id) toggleMenu(id);
    }
  });
});

// ============ MENU ACTIONS ============
function focusSearch() {
  document.getElementById('searchInput').focus();
}
function copyCurrentUrl() {
  const active = document.querySelector('.view.active, .doc-view.active, .app-view.active');
  const view = active ? active.id.replace('view-','') : 'home';
  const path = titles[view] ? titles[view].path.join('/') : 'covera.es';
  const url = 'https://' + path;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => toast('Copiat: ' + url));
  } else {
    toast('URL: ' + url);
  }
}

// ============ TOAST ============
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%) translateY(8px);background:#0A2D56;color:#fff;padding:12px 20px;border-radius:8px;font-family:var(--font-mono);font-size:12px;z-index:1000;box-shadow:0 12px 32px rgba(10,45,86,0.28);opacity:0;transition:opacity 0.2s,transform 0.2s;pointer-events:none;max-width:80vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(t._h);
  t._h = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(8px)';
  }, 2400);
}

updateNavButtons();
