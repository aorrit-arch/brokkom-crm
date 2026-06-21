# Brokkom CRM

CRM comercial de Brokkom Correduria de Seguros (sector transport).
Aplicació web (HTML + JS) sobre **Supabase** (base de dades + auth) i desplegada a **Vercel**.

## Estructura del projecte

```
index.html              Pàgina principal (login + app)
styles.css              Estètica corporativa (sistema de disseny)
app.js                  Nucli: connexió Supabase, auth, càrrega de dades, navegació
modules.js              Renders de les seccions + cerca global (Cmd+K)
modals.js               Formularis i desat (clients, ofertes, etc.)
brokkom-patch.js        Pegats i millores
brokkom-patch2.js       Pegats i millores
brokkom-prospeccio.js   Centre de trucades (prospecció): cua + mode trucada
package.json            Dependències (Supabase)
vercel.json             Configuració de Vercel (funcions + cron)

api/                    Funcions serverless (Vercel)
  ai-proxy.js           Proxy a l'API d'Anthropic (la clau viu al servidor)
  telegram-*.js         Bot de Telegram: resum diari, enviaments, còpia setmanal
  _lib/                 Utilitats compartides (supabase, telegram, erp, ai, env)
  v1/                   Endpoints d'integració amb l'ERP

supabase/migrations/    SQL de l'estructura de la base de dades
docs/                   Documentació tècnica (ERP, multi-usuari, telegram, auditoria)
```

## Mòduls del CRM

**Comercial:** Tauler · Clients · Pipeline · Consolidats · Seguiments · Oportunitats · **Centre de trucades**
**Operativa:** Bústia · Agenda · Tasques · Venciments · Notes · Esborranys
**Recursos:** Asseguradores · Posts LinkedIn · Usuaris · IA assistent · Configuració

### Centre de trucades (prospecció)

Cua de treball per a campanyes telefòniques. Cada empresa és un *prospecte*; cada
trucada queda registrada a la taula `trucades`. Filtres (per trucar avui, mai trucats,
interessats, callbacks), mode trucada amb arguments suggerits automàticament segons el
perfil del prospecte, registre del resultat amb un clic, programació de callbacks, i
conversió del prospecte en client o oportunitat. Taules: `prospectes` + `trucades`.

## Desplegament

El repositori està connectat a Vercel: en pujar canvis a GitHub, Vercel desplega sol.
Variables d'entorn necessàries a Vercel: `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_AUTHORIZED_CHAT_IDS`, `SUPABASE_SERVICE_ROLE_KEY`.

Les migracions de `supabase/migrations/` s'apliquen a mà al SQL Editor de Supabase
(Vercel no les executa).

## Còpia de seguretat

Còpia setmanal automàtica de tota la base de dades enviada per Telegram
(`api/telegram-weekly-backup.js`, programada a `vercel.json`). Important per no perdre
dades, ja que el pla gratuït de Supabase no fa còpies.
