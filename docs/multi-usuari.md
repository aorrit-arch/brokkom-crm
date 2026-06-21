# Multi-usuari — guia per a Brokkom CRM

**Última actualització:** 2026-05-17

Aquest document explica com funciona l'estructura multi-usuari del CRM i com afegir nous mediadors.

---

## Visió general

- Cada persona té un compte d'usuari de Supabase Auth (email + contrasenya).
- Existeix una taula `mediadors` que **representa la cartera comercial** de cada persona — és independent del compte d'usuari per permetre escenaris més flexibles (per ex. registres assignats a un mediador que encara no té compte, o un usuari amb varis "perfils" comercials).
- Cada registre (`clients`, `ofertes`, `seguiments`, `tasques`, `venciments`, `oportunitats`) té una columna `mediador_id` (nullable) que indica a quina cartera pertany.
- **El filtre per mediador es fa al frontend**: tothom autenticat pot llegir totes les files de la BD. El dropdown del header tria què veus:
  - **"Tot l'equip"** (defecte) → veus tots els registres.
  - **"Cartera meva"** → només els teus.
  - **"Per mediador X"** → els d'una persona concreta.

**Compatibilitat enrere garantida.** Mentre la taula `mediadors` estigui buida, el selector queda amagat i el CRM funciona exactament igual que abans.

---

## 1. Aplicar la migració SQL

Cal executar `/supabase/migrations/2026_05_17_mediadors.sql` un únic cop al teu projecte Supabase.

### Opció A — Panell web de Supabase
1. Entra a https://app.supabase.com → projecte Brokkom CRM.
2. Menú lateral → **SQL Editor** → **New query**.
3. Enganxa tot el contingut del fitxer.
4. Prem **RUN**. Si tot va bé, hauràs creat: la taula `mediadors`, columnes `mediador_id` a 6 taules, índexs, polítiques RLS noves.
5. Comprova: **Table Editor** → ha d'aparèixer `mediadors` a la llista.

### Opció B — Supabase CLI
```bash
supabase db push
```

### Rollback (si cal desfer)
A la part final del SQL hi ha el bloc de rollback. Còpia'l i executa'l manualment.

---

## 2. Crear els primers mediadors

Després de la migració has de **crear un registre `mediadors` per a tu**, perquè el filtre "Cartera meva" funcioni. També pots crear-ne per als 2 mediadors futurs (encara sense compte) i lligar-los més tard.

### Opció A — Directe a Supabase (recomanat al començament)
**SQL Editor → New query:**

```sql
-- Crea't a tu mateix com a admin. Substitueix l'email pel teu.
insert into public.mediadors (user_id, nom, email, rol)
values (
  (select id from auth.users where email = 'aorrit@gmail.com'),
  'Albert Orrit',
  'aorrit@gmail.com',
  'admin'
);

-- Per als 2 mediadors futurs (encara sense compte). user_id és NULL ara,
-- més endavant els l'assignem quan creïn el compte.
insert into public.mediadors (nom, email, rol)
values
  ('Nom Mediador 2', 'mediador2@empresa.com', 'mediador'),
  ('Nom Mediador 3', 'mediador3@empresa.com', 'mediador');
```

### Opció B — Des del CRM (futur)
La interfície d'administració de mediadors al CRM es deixa per a una futura iteració. De moment es gestionen a SQL.

---

## 3. Quan un mediador nou crea el seu compte

Quan un dels mediadors futurs creï el seu compte des de la pantalla de login del CRM, **cal lligar-li el seu `user_id` al registre de `mediadors`** que ja existia per a ell. Això s'ha de fer **a Supabase** (no via app encara):

```sql
update public.mediadors
set user_id = (select id from auth.users where email = 'mediador2@empresa.com')
where email = 'mediador2@empresa.com';
```

A partir d'aquell moment, quan aquesta persona entri al CRM:
- Es carrega `state.mediadorIdMeu` automàticament.
- Veu el dropdown del header amb les opcions de cartera.
- Els registres que crea s'assignen al seu `mediador_id` automàticament.

---

## 4. Assignar registres existents a un mediador

**Per defecte tots els registres antics tenen `mediador_id = NULL`.** El filtre "Cartera meva" no els amaga per defecte (vegeu `applyMediadorFilter` a `index.html`) — només filtra si almenys un registre té propietari. Així no es generen falsos buits.

Quan vulguis assignar registres antics a un mediador concret:

```sql
-- Tots els clients d'Albert
update public.clients
set mediador_id = (select id from public.mediadors where email = 'aorrit@gmail.com')
where mediador_id is null;

-- Mateix per a la resta de taules
update public.ofertes      set mediador_id = (select id from public.mediadors where email = 'aorrit@gmail.com') where mediador_id is null;
update public.seguiments   set mediador_id = (select id from public.mediadors where email = 'aorrit@gmail.com') where mediador_id is null;
update public.tasques      set mediador_id = (select id from public.mediadors where email = 'aorrit@gmail.com') where mediador_id is null;
update public.venciments   set mediador_id = (select id from public.mediadors where email = 'aorrit@gmail.com') where mediador_id is null;
update public.oportunitats set mediador_id = (select id from public.mediadors where email = 'aorrit@gmail.com') where mediador_id is null;
```

---

## 5. Rols

`mediadors.rol` pot ser un de:
- **`admin`** — pot crear/editar/esborrar mediadors (futur), veure tot.
- **`mediador`** — usuari estàndard amb cartera pròpia.
- **`lector`** — només lectura (de moment es comporta com `mediador`; la restricció s'aplicarà a iteracions futures).

---

## 6. Què passa al frontend

Codi rellevant a `index.html`:

- **`state.mediadors_team`** — llista de mediadors actius carregats al login.
- **`state.mediadorIdMeu`** — ID del mediador associat al teu usuari (o `null`).
- **`state.userMode`** — `'equip'` (defecte) | `'meva'` | `'mediador'`.
- **`state.userModeMediadorId`** — ID actiu quan el mode és `'mediador'`.
- **`visibleClients()`, `visibleOfertes()`, etc.** — wrappers que apliquen el filtre.
- **`withMediadorId(obj)`** — afegeix automàticament el meu `mediadorId` als nous registres.
- **`renderCarteraSelector()`** — pinta el dropdown del sidebar.
- **`setCarteraMode(v)`** — canvia el mode i refresca la vista.

La preferència de mode es persisteix a `localStorage['brokkom_cartera_mode']`.

---

## 7. Diagnòstic

**El dropdown no apareix.**
→ La taula `mediadors` està buida o no s'ha creat. Comprova amb `select count(*) from public.mediadors;`.

**Veig el dropdown però "Cartera meva" no apareix com a opció.**
→ El teu `user_id` no està lligat a cap fila de `mediadors`. Fes:
```sql
update public.mediadors set user_id = (select id from auth.users where email = 'EL_TEU_EMAIL') where email = 'EL_TEU_EMAIL';
```
Recarrega el CRM.

**Veig "Cartera meva" però surt buit.**
→ Encara no has creat cap registre sent tu el propietari, o els registres antics tenen `mediador_id = NULL`. Vegeu secció 4.

**Error al login: "relation 'mediadors' does not exist".**
→ La migració no s'ha aplicat encara. Vegeu secció 1.

---

## 8. Resum de canvis al codi

- **Migració SQL:** `supabase/migrations/2026_05_17_mediadors.sql`.
- **Frontend (`index.html`):**
  - Estat ampliat amb `userMode`, `mediadorIdMeu`, `mediadors_team`.
  - `COLUMN_MAP` afegit `mediadorId` → `mediador_id`.
  - `loadFromSupabase` carrega `mediadors` (silenciosament si la taula no existeix).
  - Dropdown al sidebar (visible només si hi ha mediadors).
  - `visibleX()` filtrant per `state.userMode`.
  - Renders (`renderDashboard`, `renderClients`, `renderPipeline`, etc.) utilitzen els wrappers.
  - `withMediadorId()` als saves per assignar propietat automàtica.

Cap canvi destructiu — tot retrocompatible.
