# Auditoria de codi — Brokkom CRM

**Data:** 2026-05-17
**Branca:** main · commit `37a3736`
**Abast:** `index.html` (2791 línies), `app.js`, `modules.js`, `modals.js`, `api/ai-proxy.js`.

Severitats:
- **🔴 Crític** — risc de pèrdua de dades, de seguretat, o trenca funcionalitat real.
- **🟡 Important** — fragilitat, deute tècnic, dificultat de manteniment.
- **🟢 Menor** — neteja, consistència, qualitat de codi.

---

## A. Bugs latents

### 🔴 A1. Pèrdua d'oferta al tancar com a guanyada
**`index.html`** `saveOferta` (línies 2213-2221).

```js
if(estat === 'Tancada guanyada'){
  if(id){
    await dbDelete('ofertes', id);             // <-- esborra primer
    state.ofertes = state.ofertes.filter(o=>o.id!==id);
  }
  closeModal();
  openModal('consolidat', data);               // <-- si l'usuari cancel·la aquí, perd l'oferta
  return;
}
```

Si l'usuari prem "Cancel·lar" al modal de consolidat, l'oferta ja s'ha esborrat però el tancament no s'ha creat → dada perduda. **Cal mantenir l'oferta fins que `saveConsolidat` hagi guardat**, i només llavors esborrar (o marcar com a `Tancada guanyada` sense esborrar).

### 🔴 A2. Codi mort dins del codi viu — `loadState` i `saveState`
**`index.html`** línies 1066, 1080-1093.

```js
function saveState(){}                                        // stub
...
function loadState(){
  try{
    const saved = localStorage.getItem(STATE_KEY);            // STATE_KEY no existeix
    if(saved){
      const parsed = JSON.parse(saved);
      return {...DEFAULT_STATE, ...parsed, ...};              // DEFAULT_STATE no existeix
    }
  }catch(e){console.error('Error loading state:',e)}
  return JSON.parse(JSON.stringify(DEFAULT_STATE));           // ReferenceError
}
function saveState(){
  localStorage.setItem(STATE_KEY, JSON.stringify(state));     // ReferenceError
}
```

Cap d'aquestes funcions es crida des d'enlloc al codi viu. Però hi són i confonen. **Esborrables sense risc.**

### 🔴 A3. Fitxers `.js` no carregats — codi mort real
`app.js`, `modules.js`, `modals.js` (2490 línies en total).

`index.html` només té `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/...">`. Cap dels altres tres fitxers es carrega. Són una "v2" en mòduls que mai s'executa.

Decisions possibles:
- **Esborrar** si Albert no els necessita.
- **Marcar com a draft** dins `/docs/v2-draft/` si volia migrar més tard.

Recomanat: esborrar (multi-usuari es farà directament dins l'`index.html`).

### 🔴 A4. Alarmes de seguiment fred sempre disparades
**`index.html`** `renderDashboard` línies 1230-1240.

```js
state.ofertes.filter(o=>o.estat==='Oferta enviada').forEach(o=>{
  const ultimSeg = state.seguiments.filter(s=>s.ofertaId===o.id)...
  if(!ultimSeg || daysFromNow(ultimSeg.data) < -15){
    accions.push({tipus:'danger', titol:`Seguiment fred: ${o.empresa}`, ...});
  }
});
```

El camp `s.ofertaId` no es desa enlloc (`saveSeguiment` no l'envia). Resultat: `ultimSeg` sempre és `undefined` → totes les ofertes "Oferta enviada" apareixen sempre com a fredes.

**Fix:** afegir `ofertaId` al modal de seguiment i a `saveSeguiment`, o canviar la lògica perquè usi el seguiment més recent per `clientId`.

### 🔴 A5. XSS i trencament HTML
Tot el contingut d'usuari s'interpola amb template literals sense escapar HTML. Exemples:

- `<div class="card-title">${c.empresa}</div>` (línia 1276)
- `<div ...>${s.resum}</div>` (línia 1477)
- `<div ...>${idea.contingut}</div>` (línia 2459)

A més, l'`onclick` injecta JSON al markup:
```js
onclick="openModal('client',${JSON.stringify(c).replace(/"/g,'&quot;')})"
```

Si `c.notes` conté `'` o caràcters HTML especials, el markup es trenca o pot injectar codi. **Risc actual: baix** (només Albert), **risc multi-usuari: real**.

**Fix:** crear `escapeHtml()` helper i passar tot el contingut d'usuari. Per als JSON.stringify dins onclick, usar event handlers via JS (afegir `data-id` i fer `addEventListener`).

### 🟡 A6. `state.idees` no inicialitzat
**`index.html`** línia 736. L'objecte `state` inicial no té `idees`. Es defineix només dins `loadFromSupabase`. Si `loadFromSupabase` falla parcialment, `renderIdees()` peta a `state.idees.filter(...)`.

**Fix:** afegir `idees: []` a l'estat inicial.

### 🟡 A7. `selectTopic` depèn de `event` global implícit
**`index.html`** línia 1639.

```js
function selectTopic(id){
  ...
  event.currentTarget.classList.add('selected');  // event implícit
  ...
}
```

Funciona perquè els `onclick` inline el creen, però és antipatró i pot petar segons context. **Fix:** rebre `event` explícitament o passar l'element via paràmetre.

### 🟡 A8. `deleteAsseguradora` per índex
**`index.html`** línies 1604, 2368-2376.

L'HTML genera `onclick="deleteAsseguradora(${i})"`. Si entre el render i el clic hi ha un `splice` o reorder, l'índex apunta a una entrada diferent. Funciona avui però fràgil.

**Fix:** passar `id` en lloc d'índex.

### 🟡 A9. Validació feble de números
`primaActual`, `primaBrokkom`, `primaAnual` usen `parseFloat(...) || null`. Si l'usuari escriu `12,50` (coma decimal catalana), `parseFloat` retorna `12`. Pèrdua silenciosa.

**Fix:** normalitzar comes a punts abans de `parseFloat`.

### 🟡 A10. Botons `importData`/`resetData` no funcionen
**`index.html`** línies 2411-2417. Els botons existeixen però només mostren un toast d'error. **Fix:** esborrar els botons o implementar-los.

### 🟢 A11. Mètrica conversió incorrecta
**`index.html`** línia 1158:
```js
const totalOfertes = state.ofertes.filter(o=>['Tancada guanyada','Tancada perduda'].includes(o.estat)).length + state.consolidats.length;
```

Els consolidats s'esborren del `state.ofertes` quan es tanquen, així que `state.ofertes` només té perdudes. La fórmula compta `perdudes + consolidats`, que és correcte per accident. Però si algun dia es deixa `Tancada guanyada` també al `state.ofertes`, es duplica.

**Fix:** comentar explícitament la invariant o simplificar.

### 🟢 A12. `daysFromNow` arrodoneix cap amunt
```js
function daysFromNow(d){return Math.ceil((new Date(d)-new Date())/86400000)}
```

Per a un venciment d'avui a les 23:00, retorna `1` (no `0`). Resultat: a la UI veurà "en 1 dies" en lloc de "avui". **Fix:** normalitzar a mitjanit.

### 🟢 A13. Cost IA estàtic
"~0,002€" és text fix. No reflecteix l'ús real.

---

## B. Codi duplicat

### 🟡 B1. Funcions util duplicades a `app.js` i `index.html`
`uid`, `fmt`, `fmtEur`, `fmtDate`, `daysFromNow`, `toast`. Totes redefinides a tots dos llocs. Si `app.js` es carregués, `window.uid` (de `app.js`) sobreescriuria la d'`index.html`.

**Fix:** esborrar `app.js`.

### 🟡 B2. `saveState` duplicat
Vegeu A2.

### 🟢 B3. Llista TOPICS duplicada
A `app.js` (línies 37-45) i a `index.html` (línies 1068-1076). Identiques però mantenir 2 és arriscat.

### 🟢 B4. Generació de URL Google Calendar duplicada
`generarAlarmaCalendar` (index.html 1956) i `genCalendar` (modules.js 456). Quasi idèntiques.

---

## C. Funcions llargues per refactoritzar

### 🟡 C1. `renderDashboard` — 110 línies
Fa: mètriques, summary de pipeline, llistat tancaments, alarmes, accions prioritàries. **Hauria de** trencar-se en 4-5 funcions petites.

### 🟡 C2. `renderConsolidats` — 117 línies
Recull filtres, dades, calcula mètriques, 3 gràfics i una taula. **Cal** dividir.

### 🟡 C3. `processarIA` — 110 línies
Construeix prompt, crida API, parseja, mostra resultat, prepara import. Especialment `window._iaImport` està definida a dins (línies 1839-1876) — closure que pot tenir referències stale.

### 🟡 C4. `openModal` — 180 línies
Switch sobre `type` amb HTML inline per cada modal. **Hauria de** tenir un objecte de plantilles o cada modal una funció pròpia.

### 🟢 C5. `loadFromSupabase` — 100 línies
És correcte, només lleugerament llarga.

---

## D. Gestió d'errors deficient

### 🔴 D1. `dbInsert`/`dbUpdate`/`dbDelete` no comuniquen prou
Quan retornen `null`/`false`, el codi crida sovint `state.X.unshift(inserted)` sense protegir per null:

```js
const inserted = await dbInsert('clients', data);
if(inserted) state.clients.unshift(inserted);   // bé
...
closeModal();        // <-- s'executa sempre, encara que dbInsert hagi fallat
renderClients();
toast('Client guardat');  // <-- toast positiu encara que hagi fallat
```

**Fix:** guard clause després de `dbInsert` que avorti la resta del flux si retorna null.

### 🔴 D2. `callAnthropicAPI` sense timeout
Si la xarxa cau, la petició pot quedar penjada indefinidament. **Fix:** `AbortController` amb 60s.

### 🟡 D3. `showSync` no s'amaga si la query mai retorna
Si `withRetry` exhaureix els intents sense respondre, `showSync('Guardant')` segueix mostrant l'indicador. **Fix:** `try/finally` envoltant.

### 🟡 D4. Errors a `iaAccio` desapareixen
Quan `JSON.parse` falla al return de l'IA, es mostra el text cru però l'usuari no sap que ha fallat el parse.

### 🟡 D5. `regenerarOportunitats` envia tots els clients
Sense paginació. Amb >100 clients pot superar el límit de tokens i fallar amb un error críptic.

### 🟢 D6. `closeModal` quan no hi ha modal
Si es crida fora de context, sobreescriu `modal-container` (no és cap problema, però l'esment és per netedat).

---

## E. Problemes de rendiment

### 🟡 E1. Re-renders complets a cada acció
Cada `renderClients()`, `renderPipeline()`, etc., regenera tot l'HTML del tab. Amb 500+ clients això comença a notar-se. Acceptable ara, **caldria virtualitzar a llarg termini**.

### 🟡 E2. `Promise.all` a `loadFromSupabase` carrega 11 taules sense filtre
Sense `limit`, carrega tot el contingut. Per a 5000+ ofertes serà lent al login. **Fix:** `.limit(500)` o paginació.

### 🟡 E3. Filtres a Consolidats reescriuen el dropdown sencer
`renderConsolidats` regenera `<option>` cada cop, fent que el valor seleccionat es perdi en alguns casos (línies 1342-1356 fan un check de longitud per evitar-ho, però és fràgil).

### 🟢 E4. `state.ofertes.filter(o => o.estat === ...)` repetit
Diversos render fan el mateix filtre. Es podria memoritzar però amb 100-200 ofertes no és problema.

### 🟢 E5. Carrega 11 SELECTs concurrents al login
Pot saturar Supabase amb 11 connexions. Acceptable però es pot agrupar amb una funció RPC si cal escalar.

---

## F. Seguretat

### 🔴 F1. XSS amb camps de text lliure
Vegeu A5.

### 🟡 F2. Anon key embedded al client
Línia 732: `const SUPABASE_KEY = 'sb_publishable_...'`. És **publicable** per disseny, però depèn de RLS estricte. Cal verificar que totes les taules tenen RLS actiu i que cap permet `SELECT *` sense `auth.uid()`.

### 🟡 F3. `/api/ai-proxy` sense rate limiting ni autenticació
Qualsevol que sàpiga la URL pot enviar peticions i consumir crèdit Anthropic. **Fix mínim:** validar el header de Supabase JWT al proxy.

### 🟢 F4. Imatges en base64 al prompt
Mida pot ser gran (3-4 MB en base64). Cap límit imposat al client — pot fer fallar la Vercel function (4.5 MB max payload).

---

## G. Multi-usuari (preparació)

Aquests no són bugs, però són els canvis estructurals que cal fer (es tractaran a la Tasca 4):

- Crear taula `mediadors` amb FK a `auth.users` (vegeu /docs/multi-usuari.md).
- Afegir `mediador_id` (nullable) a `clients`, `ofertes`, `seguiments`, `tasques`, `venciments`, `oportunitats`.
- RLS: tothom autenticat veu tot, filtre per mediador a frontend.
- Dropdown al header: "Cartera meva" / "Tot l'equip" / "Per mediador X".

---

## Quadre resum

| Sev. | Categoria | # |
|------|-----------|---|
| 🔴 Crític | Bugs + seguretat + codi mort | 6 |
| 🟡 Important | Bugs + duplicació + errors + rendiment | 15 |
| 🟢 Menor | Neteja, qualitat | 8 |

**Total identificats: 29 punts.**

---

## Prioritats per a la Tasca 3 (millores ràpides i segures)

Aplicables **sense risc** i d'alt valor:
1. Eliminar codi mort intern (`loadState`/`saveState`/`STATE_KEY`/`DEFAULT_STATE`).
2. Inicialitzar `state.idees = []` al state base.
3. Afegir `escapeHtml()` helper i aplicar-lo als llocs de més risc (`empresa`, `notes`, `resum`, `contingut`).
4. Optional chaining a `updateNavBadges` per protegir elements absents.
5. Arreglar pèrdua d'oferta a tancament guanyat (A1).
6. Afegir timeout a `callAnthropicAPI` (60s).
7. Guard clauses a `dbInsert`/`dbUpdate`/`dbDelete` (avortar acció si retorna null).
8. Esborrar referències al localStorage als textos UI ("Tot al navegador") i botons no operatius (`importData`/`resetData`).
9. Normalitzar comes decimals a `parseFloat` per a primes.
10. `saveSeguiment` ha d'incloure `ofertaId` opcional (i el modal també) per arreglar A4.

**Pendents per a la Tasca 4 (multi-usuari)** o **decisions de l'usuari:**
- Esborrar `app.js`, `modules.js`, `modals.js` o moure-ho a un draft (preguntar/decidir).
- Refactor de funcions llargues (millor en una passada dedicada).
- Rate limiting al `/api/ai-proxy` (decisió a part).
- Service worker per a PWA real.
