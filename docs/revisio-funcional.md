# Revisió funcional del CRM Brokkom

**Data:** 2026-05-17
**Versió revisada:** branca `main`, commit `37a3736`
**Mètode:** lectura completa del codi (`index.html`, `app.js`, `modules.js`, `modals.js`, `api/ai-proxy.js`) + simulació mental dels fluxos.

---

## 0. Descobriment estructural important

`index.html` només carrega `supabase-js`. **No fa `<script src="app.js">`, `modules.js` ni `modals.js`** — tota l'app real està al bloc `<script>` inline de l'`index.html` (línies 727-2789).

Els fitxers externs (`app.js` 305 línies, `modules.js` 1503 línies, `modals.js` 682 línies) són **codi mort** des de la perspectiva del navegador. Semblen una "v2" en mòduls separats que mai s'arriba a executar: tenen funcionalitats que no apareixen al CRM viu (inbox amb captura d'imatges a Supabase Storage, agenda d'events, notes/esborranys, gestió d'usuaris amb rols admin/agent, taules `inbox_items`, `agenda_events`, `esborranys`, `profiles`).

Implicació: tota aquesta revisió funcional es refereix al codi a `index.html`. Cal decidir què fer amb els altres fitxers (els tracto a l'auditoria).

---

## 1. Login / autenticació

**Què funciona:**
- Sign up i login amb email/contrasenya via Supabase Auth.
- Restauració de sessió persistida al recàrrega (`bootAuth`).
- Recuperació de contrasenya (`resetPassword`).
- Detecció de skew de rellotge (capçalera Date + JWT iat).
- Mutex `refreshSessionOnce` per quan moltes peticions cauen alhora.
- Overlay de càrrega ben gestionat que no destrueix el form (correcció recent — bona).

**Risc / mancances:**
- **L'overlay del login mostra un únic botó "Entrar"** que canvia el text segons `authMode` (`switchAuthTab`), però les tabs `tab-login` i `tab-signup` només canvien classes — no hi ha cap formulari separat per signup amb camp "nom". El nom de l'usuari mai no es captura al signup. Si la columna `profiles.nom` és NOT NULL, el signup pot fallar; si és NULL, l'usuari surt sense nom.
- No hi ha cap pantalla `signed_out` neta — `logout()` recarrega la pàgina, que és pragmàtic però brut.
- Si `loadFromSupabase()` llança fora d'un try/catch dins `onLoginSuccess`, el `finally` amaga l'overlay però `renderActiveView()` es crida igual, podent fallar perquè algunes vistes assumeixen dades carregades.

---

## 2. CRUD de clients

**Què funciona:**
- Crear / editar / esborrar clients amb modal.
- Filtre per sector i cerca per empresa/CIF/contacte.
- Mostra comptadors de ofertes, consolidats, oportunitats per client.

**Bugs i mancances:**
- **Esborrar client**: el codi assumeix `ON DELETE CASCADE` a Supabase per netejar ofertes/seguiments/oportunitats — si no està configurat a la BD, queden registres orfes en estat inconsistent amb `state.client_id` apuntant a un client esborrat.
- **JSON injectat a `onclick`**: `openModal('client',${JSON.stringify(c).replace(/"/g,'&quot;')})` — si el camp `notes` o `empresa` conté `'` (cometes simples), comilles especials o caràcters Unicode estranys, l'HTML es trenca. **XSS latent**: l'usuari pot escriure HTML als camps de notes i s'injecta sense escapar. Risc baix perquè és single-user, però empitjora amb multi-usuari.
- Sense camp `mediador_id`: no es pot saber qui és el propietari/comercial assignat al client.
- Cerca no troba per email/telèfon.

---

## 3. Ofertes / Pipeline

**Què funciona:**
- Vista Kanban per estats del pipeline (Lead → ... → Tancada).
- Marcar com a "Tancada guanyada" obre el modal de consolidat amb les dades pre-emplenades.
- Marcar com a "Tancada perduda" simplement actualitza l'estat.
- Mètriques de valor total i valor esperat (probabilitat × valor).

**Bugs i mancances:**
- **Conversió de "Tancada guanyada"**: `saveOferta` esborra l'oferta i obre el modal de consolidat (línies 2213-2221). Si l'usuari cancel·la el modal de consolidat, **perd l'oferta** completament — ja s'ha esborrat però no s'ha creat el tancament. Cal mantenir l'oferta fins que el consolidat estigui guardat.
- **Pipeline amb `clientId` nul**: si una oferta es crea sense client (cas no possible per UI però sí via IA-import), la card mostra `?` però no enllaça enlloc.
- "Tancada perduda" no es veu al pipeline ni al consolidats — desapareix. Caldria almenys un comptador o llistat històric.
- L'estalvi mostrat al pipeline es calcula amb `parseFloat(o.primaActual) - parseFloat(o.primaBrokkom)` sense validar que ambdós existeixen — quan `primaActual` és null, retorna NaN i mostra `· estalvi NaN€`.

---

## 4. Consolidats

**Què funciona:**
- Filtres per període, asseguradora, ram, mediador.
- Mètriques i 3 gràfics (per asseguradora, per ram, evolució mensual).
- Exportació CSV.

**Bugs i mancances:**
- **Filtre de mediador**: usa `state.mediadors` (array de strings de `user_config`), no usuaris reals. No serveix per veure tancaments per mediador real fins que es migri.
- **Gràfic d'evolució mensual**: només mostra mesos amb dades — un mes buit no es veu, fent malinterpretar tendències.
- L'exportació CSV no s'escapa correctament els valors amb cometa doble (es duplica `""` però algunes eines no ho llegeixen bé).
- L'opció "last-year" del period existeix al HTML però només si el periode és `'last-year'` (cas existent). OK.

---

## 5. Seguiments

**Què funciona:**
- Creació i llistat de seguiments, filtrat per canal i cerca textual.
- Marca un seguiment per oferta a `dashboard` per detectar "fred".

**Bugs i mancances:**
- **Sense edició**: només es poden crear i esborrar, no editar.
- **Sense vinculació a oferta**: el modal de seguiment només té camp `clientId`, no `ofertaId`. Tanmateix, `dashboard-accions` busca `s.ofertaId === o.id`, que mai serà cert — l'alerta de "Seguiment fred" sempre marcarà totes les ofertes com a fredes perquè no hi ha seguiments lligats a oferta.
- El camp `responsable` es mostra però no s'omple a cap formulari (referenciat a `renderSeguiments` línia 1473).

---

## 6. Oportunitats

**Què funciona:**
- Detecció amb IA via prompt a Claude (`regenerarOportunitats`).
- Filtres per prioritat i estat.
- Conversió a oferta amb un click.
- Canvi cíclic d'estat.

**Bugs i mancances:**
- **`regenerarOportunitats` envia tots els clients en un sol prompt** — si tens 200 clients això pot superar el context window o ser lent/car.
- L'IA pot retornar empreses inventades (que no estan a la cartera); el codi les ignora si no troba `clientId`, però hauria d'avisar.
- L'estat "Descartada" només s'aconsegueix passant 4 clics — no hi ha botó directe.
- No es pot editar el text de l'oportunitat (argument, producte).

---

## 7. Venciments

**Què funciona:**
- Llistat amb estat visual (vermell/groc/verd segons proximitat).
- Botó "Crear esdeveniment Calendar" obre Google Calendar amb dades pre-emplenades.
- Sistema 90/30/7 al dashboard com alarmes derivades.

**Bugs i mancances:**
- **Cap vinculació amb clients**: el venciment és un `empresa` (string lliure), no un `clientId`. Si una empresa es renomena o té variants ("Transports SL" vs "Transports, SL"), no es lliga al client real.
- L'URL de Google Calendar passa data sense hora final (mateix start=end), que es renderitza com a esdeveniment 0 minuts. Hauria de ser un esdeveniment d'1 hora o tot el dia.
- Sense camp `mediador_id` ni `properPas` (què fer-ne).

---

## 8. Tasques

**Què funciona:**
- CRUD complet, filtres per categoria i estat (pendent/fet/totes).
- Mètriques (total, pendents, fetes).
- Prioritat amb codi de color.

**Bugs i mancances:**
- No es pot editar una tasca (només crear, marcar feta, esborrar).
- Sense vinculació a client / oferta.
- Sense alertes per data límit propera.

---

## 9. Asseguradores

**Què funciona:**
- CRUD bàsic, seed automàtic si està buit (6 asseguradores per defecte).

**Bugs i mancances:**
- **`deleteAsseguradora` usa l'índex de l'array**, no l'`id` — si l'usuari reordena (mai actualment, però amb sort futur sí), s'esborra qui no toca. La crida a `dbDelete('asseguradores', a.id)` sí que usa l'ID però `state.asseguradores.splice(idx,1)` pot esborrar visualment una entrada diferent si l'array es reordena entre el render i el clic.
- Sense edició — només crear/esborrar.

---

## 10. Comunicació LinkedIn

**Què funciona:**
- 8 temes predefinits amb 4 angles cadascun (32 angles totals).
- Generació de post amb IA.
- Copia al portapapers, guardar al CRM.

**Bugs i mancances:**
- **`selectTopic` usa `event.currentTarget`** sense rebre `event` com a paràmetre (line 1639): és dependent del scope d'`onclick` inline. Funciona als navegadors moderns però és anti-patró i potser falla en algunes situacions.
- No hi ha edició de temes (només els 8 hardcoded).
- Sense calendari editorial real — només historial.

---

## 11. Idees

**Què funciona:**
- CRUD via la taula `notes` amb `tipus='idea'`.
- Filtre per categoria i estat.
- Conversió d'idea a post LinkedIn (genera amb IA).

**Bugs i mancances:**
- L'estat "desenvolupant" o "descartada" no es pot canviar des de la UI — només "nova" automàtic.
- Quan l'IA crea una idea, l'origen `'IA'` s'inclou als hashtags i la categoria s'agafa de `hashtags[0]` — fràgil: si l'ordre canvia, la categoria es perd.

---

## 12. IA - Processador

**Què funciona:**
- Suport per text i imatge (`callAnthropicAPI`).
- Extracció estructurada en JSON (clients, ofertes, venciments, oportunitats, seguiments, idees).
- Importació granular: cada entitat detectada es pot importar individualment.
- Accions ràpides: resum pipeline, detectar opps, proposar seguiments, clients freds.

**Bugs i mancances:**
- **Hashtags detectats però no usats**: `detectHashtags()` existeix però no es crida enlloc al flux d'`processarIA()` — els hashtags que l'usuari posa al text s'envien al prompt però no condicionen el comportament.
- L'IA inclou claus desconegudes (p.ex. `idees`) que no estan al prompt original però el codi de render les espera.
- Si l'IA retorna text que no és JSON, es mostra el text cru — bé, però no és accionable.
- **Cost no es calcula realment**: el text "~0,002€" és estàtic, no depèn de tokens.
- L'import d'oferta IA crea un client nou si no existeix amb el mateix nom (case-insensitive). Si l'usuari té "Transports SL" i l'IA detecta "TRANSPORTS S.L.", crea un duplicat.

---

## 13. Configuració

**Què funciona:**
- Selecció de model IA (fast / smart).
- Edició de mediadors i rams.
- Exportació JSON.

**Bugs i mancances:**
- **`importData()` i `resetData()` estan desactivats** amb un toast d'error — el botó hi és però no fa res. Confús.
- **El text "Tot es guarda al navegador. Recomanem fer còpia periòdica."** és fals — ja és Supabase. Caldria reescriure.
- **El text "Versió 1.0 · Properes versions: integració Supabase (multi-dispositiu), Apollo.io, accés multi-usuari"** és fals (Supabase ja està implementat).
- El model `claude-opus-4-6` al dropdown ja no és l'última versió.

---

## 14. PWA

**Què funciona:**
- Banner amb instruccions per a iOS/Android.
- Es marca dismissed a localStorage.

**Bugs i mancances:**
- No hi ha `manifest.json` ni service worker, així que "afegir a pantalla d'inici" funcionarà com a shortcut però no com a PWA real (sense offline).

---

## 15. Errors transversals

- **Doble definició de `saveState`**: línies 1066 i 1091. El segon (`localStorage.setItem(STATE_KEY, JSON.stringify(state))`) sobreescriu el stub. `STATE_KEY` i `DEFAULT_STATE` no estan definides enlloc → `loadState()` (línies 1080-1089) llançaria un `ReferenceError` si algú la cridés. Però `loadState` no es crida des d'enlloc del codi viu. **Codi mort dins del codi viu** — segur d'esborrar.
- **HTML als camps lliures**: tot el contingut de l'usuari (`empresa`, `notes`, `resum`...) s'interpola dins HTML amb template literals sense escapar. Si un client té `<script>alert(1)</script>` al camp notes, executa. Risc baix (single-user, només Albert escriu) però **multi-usuari ho fa real**.
- **`state.idees` no inicialitzat**: la inicialització de `state` (línia 736) no inclou `idees`. Es crea a `loadFromSupabase()`. Si la càrrega falla, `renderIdees()` peta amb "Cannot read properties of undefined".
- **Nav badges**: `document.getElementById('nav-clients').textContent = ...` — si l'element no existeix (per error temporal en el render), llança. Cal protecció amb optional chaining.
- **`callAnthropicAPI` no maneja timeouts**: una petició lenta pot deixar la UI penjada.
- **Indicador de sync**: `showSync` mai s'amaga si la query mai retorna (timeout).
- **No hi ha `ON DELETE CASCADE` documentat** — assumit per `deleteClient`. Si la BD no ho té, hi ha registres orfes a Supabase.

---

## 16. Mancances funcionals (no bugs, però rellevants per multi-usuari i Telegram)

- No hi ha concepte de "propietari" d'un registre per a la UI (sí `user_id` a la BD via RLS, però no es filtra ni es mostra).
- No hi ha vista "Cartera meva" vs "Tot l'equip".
- No hi ha vista de mediadors com a usuaris (només array de noms a `user_config`).
- No hi ha notificacions push (Telegram cobrirà això).
- No hi ha resum diari programat.
- No hi ha xat ni captura ràpida des de mòbil (Telegram cobrirà això).

---

## Resum

**Estat global:** El CRM funciona per a l'ús actual (single-user Albert). Té diverses fragilitats que es manifestaran en multi-usuari o amb dades més grans:

- 3 fitxers .js de codi mort (1500+ línies).
- Codi mort dins del codi viu (`loadState`/`saveState` localStorage).
- Risc d'XSS / trencament HTML amb caràcters especials.
- Pèrdua de dades possible a la conversió oferta → consolidat.
- Falsa lligadura oferta↔seguiment (sempre marca freds).
- Filtre per mediador no opera amb usuaris reals.

**Prioritari per arreglar abans de multi-usuari (Tasca 3):**
1. Eliminar codi mort intern (`loadState`, `saveState`, `STATE_KEY`, `DEFAULT_STATE`).
2. Decidir què fer amb els 3 fitxers .js no carregats (mantenir o esborrar).
3. Protegir l'esborrat d'oferta al convertir a consolidat (no esborrar fins que el consolidat estigui guardat).
4. Optional chaining a `updateNavBadges` i altres llocs sensibles.
5. Inicialitzar `state.idees = []` al state inicial.
6. Esborrar referències mortes a `localStorage` als textos de la UI.
