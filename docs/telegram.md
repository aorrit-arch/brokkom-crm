# Integració Telegram — Brokkom CRM

**Actualitzat:** 2026-05-17

El CRM pot enviar **alertes i resums diaris a Telegram** i acceptar **comandes i text lliure** des d'un bot. Tota la integració és opcional: si no configures el token, el CRM funciona exactament igual que ara.

---

## 1. Crear el bot a Telegram

1. Obre Telegram i busca `@BotFather`.
2. `/newbot` → segueix el wizard. Nom: el que vulguis. Username: ha d'acabar amb `bot` (ex: `BrokkomCRMBot`).
3. BotFather et donarà un **token** (similar a `12345:ABCdefGHI...`). **GUARDA'L** — és el `TELEGRAM_BOT_TOKEN`.
4. Comandes opcionals (`/setcommands` a BotFather, enganxa):
   ```
   avui - Què tens avui (tasques, ofertes, venciments)
   pendents - Totes les tasques pendents
   buscar - Cerca a clients i ofertes
   nouclient - Crea client a partir del text
   oferta - Registra una oferta
   seguiment - Registra un seguiment
   tasca - Crea una tasca
   venciment - Registra un venciment
   id - Mostra el chat_id d'aquesta conversa
   help - Mostra l'ajuda
   ```

## 2. Saber el teu chat_id

1. Inicia una conversa amb el teu bot i envia-li qualsevol cosa.
2. Visita aquesta URL al navegador (substitueix `<TOKEN>`):
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Busca `"chat":{"id":XXXXXX,...}`. Aquell número és el teu chat_id.

També pots configurar tot primer i, després, al primer missatge, el bot et dirà "no autoritzat — chat_id: NNN".

## 3. Variables d'entorn a Vercel

Vés a Vercel → projecte Brokkom CRM → **Settings** → **Environment Variables** i crea:

| Nom | Valor | Quan |
|-----|-------|------|
| `TELEGRAM_BOT_TOKEN` | Token de BotFather | Sempre |
| `TELEGRAM_AUTHORIZED_CHAT_IDS` | Els chat_ids autoritzats, separats per coma. Ex: `123456,789012,345678` | Sempre |
| `TELEGRAM_WEBHOOK_SECRET` | Una cadena aleatòria llarga (ex: `openssl rand -hex 32`). Opcional però recomanat. | Opcional |
| `SUPABASE_SERVICE_ROLE_KEY` | La service-role key del teu projecte Supabase (Settings → API → `service_role` secret). | Sempre |
| `ANTHROPIC_API_KEY` | (ja la tens) | Sempre |
| `SUPABASE_URL` | (opcional, defecte: `https://ovzvdmxbuoysckprjlej.supabase.co`) | Opcional |

**Aplica les variables a `Production`, `Preview` i `Development`** segons calgui (mínim Production).

Després de crear-les, **redeploya** el projecte (Vercel → Deployments → Redeploy).

## 4. Configurar el webhook a Telegram

El webhook diu al bot on enviar els missatges entrants. Després de redeployar, al teu terminal:

```bash
# Substitueix <TOKEN>, <SECRET> i <DOMINI>. <DOMINI> és el teu domini de Vercel.
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<DOMINI>.vercel.app/api/telegram-webhook",
    "secret_token": "<SECRET>",
    "allowed_updates": ["message","edited_message","callback_query"]
  }'
```

Si no fas servir `TELEGRAM_WEBHOOK_SECRET`, ometre el camp `secret_token`. Telegram retorna `{"ok":true,"result":true,"description":"Webhook was set"}` si tot va bé.

Per comprovar l'estat: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.

Per esborrar-lo: `https://api.telegram.org/bot<TOKEN>/deleteWebhook`.

## 5. Crons (resum diari)

`vercel.json` ja inclou un cron:

```json
"crons": [
  { "path": "/api/telegram-daily-summary", "schedule": "0 17 * * *" }
]
```

**Important sobre horari:** Vercel cron sempre va en UTC, sense suport de timezone.
- `0 17 * * *` = 17:00 UTC = **19:00 hora Madrid en estiu (CEST)** = 18:00 en hivern (CET).
- Si vols 19:00 fix tot l'any:
  - Hivern (octubre–març): canvia a `0 18 * * *`.
  - Estiu (març–octubre): deixa `0 17 * * *`.

Una alternativa més robusta seria executar el cron més sovint i deixar que l'endpoint decideixi (a fer al futur).

**Plan Hobby de Vercel:** només permet 2 crons. Si necessites més (un per mediador, alertes intra-día, etc.), passa a Pro.

## 6. Provar la integració manualment

### Resum diari (manual)
```bash
curl https://<DOMINI>.vercel.app/api/telegram-daily-summary
```
Hauries de rebre un missatge a Telegram.

### Enviar un missatge des del CRM (test)
```bash
curl -X POST https://<DOMINI>.vercel.app/api/telegram-send \
  -H "Content-Type: application/json" \
  -d '{"text":"<b>Hola</b> des del CRM 👋"}'
```

### Entrada des de Telegram
1. Envia `/help` al bot — has de rebre la llista de comandes.
2. Envia `/id` — t'ha de respondre amb el chat_id.
3. Envia text natural: `He parlat amb Transports Garcia, volen oferta de RC Patronal. Conveni col·lectiu transport mercaderies. Telèfon 933 123 456.` → la IA detecta el client, l'oferta i possiblement una oportunitat.
4. Envia una foto d'una targeta de visita amb caption "targeta fira" → la IA en treu un client.

## 7. Lligar un mediador amb el seu chat_id

Per a què el bot sàpiga **qui ets** (mediador-cartera) quan parles amb ell, lliga el teu chat_id al teu registre de mediador:

```sql
update public.mediadors
set telegram_chat_id = '123456789'
where email = 'aorrit@gmail.com';
```

Així, els registres que crees per Telegram s'assignen al teu `mediador_id` automàticament i `/avui` `/pendents` filtren la teva cartera.

## 8. Comandes disponibles

| Comanda | Què fa |
|---------|--------|
| `/help` | Llista d'ajuda |
| `/avui` | Tasques avui/demà + ofertes per seguir + venciments 7d (de la teva cartera si estàs lligat) |
| `/pendents` | Totes les tasques pendents (de la teva cartera) |
| `/buscar TEXT` | Cerca a clients i ofertes |
| `/nouclient TEXT` | Crea un client a partir del text (IA) |
| `/oferta TEXT` | Crea una oferta (IA) |
| `/seguiment TEXT` | Crea un seguiment (IA) |
| `/tasca TEXT` | Crea una tasca (IA) |
| `/venciment TEXT` | Crea un venciment (IA) |
| `/id` | Mostra el teu chat_id |

## 9. Exemples de text lliure que el bot entén

- `He parlat amb Transports Garcia, gerent Jordi Soler, tel 933123456. Volen RC Patronal + flota 14 camions. Conveni transport mercaderies.`
  - Crea client (Transports Garcia + Jordi Soler), oferta (RC Patronal), oportunitat (telemàtica per flota).

- `#oferta Logística del Pirineu, ram CMR, prima actual 8400, Brokkom 6200, asseguradora Zurich, estat Cotitzant.`
  - Crea oferta forçada per #oferta.

- `Recordatori demà: trucar Joan Vives Mapfre pels paquets de salut col·lectiva. Prioritat alta.`
  - Crea tasca amb data límit demà.

- `Venç 15 juny 2026: Excavadora Roca SL, multiriscos, Generali, 4200€.`
  - Crea venciment.

- `Idea per LinkedIn: comparar CMR vs ICC A quan transportador exporta fora UE.`
  - Crea idea (categoria linkedin).

## 10. Fotos i OCR

Envia una foto al bot. Funciona millor amb:
- Targetes de visita (extreu nom, càrrec, telèfon, email, empresa).
- Pòlisses impreses (extreu data, prima, ram, asseguradora).
- Notes manuscrites llegibles.

Pots afegir caption per donar pistes: "targeta fira logística" / "venciment 2026".

## 11. Diagnòstic

**"TELEGRAM_BOT_TOKEN no configurat".**
→ Variable no creada o no redeployada.

**"chat_id no autoritzat".**
→ Afegeix el teu chat_id a `TELEGRAM_AUTHORIZED_CHAT_IDS`.

**"SUPABASE_SERVICE_ROLE_KEY no configurada".**
→ Cal aquesta clau per als endpoints del servidor. Settings → API → service_role → revela i copia.

**El bot no contesta res.**
→ Comprova `getWebhookInfo`. Si `last_error_message` apareix, és el motiu. Pot ser:
- URL incorrecta del webhook.
- `secret_token` mismatch.
- 5xx al teu endpoint (mira Vercel Logs).

**Els resums diaris no arriben.**
→ Comprova Vercel → Logs → Cron. Si l'endpoint funciona via curl manual, és el cron. Sigues conscient del UTC vs local.

**Es creen entitats duplicades quan envio per Telegram.**
→ El matching d'empreses es fa per `ilike` exacte. Si el nom varia ("SL" vs "S.L."), es crea un duplicat. Manté una nomenclatura consistent o edita un cop al CRM web.

## 12. Resum d'arxius nous

- `api/_lib/env.js` — config i autorització.
- `api/_lib/telegram.js` — helpers de l'API Telegram (send, download, escape HTML, retries).
- `api/_lib/supabase.js` — client service-role i resolució de mediador per chat_id.
- `api/_lib/ai.js` — crida a Claude i extracció de JSON.
- `api/telegram-send.js` — POST: enviar missatge.
- `api/telegram-webhook.js` — POST: rebre updates.
- `api/telegram-daily-summary.js` — GET (cron): resum diari.
- `vercel.json` — cron afegit a `crons`.
- `package.json` — dependència `@supabase/supabase-js`.

## 13. Pendents que has de fer tu

- [ ] Crear el bot a BotFather i obtenir el token.
- [ ] Posar variables d'entorn a Vercel (vegeu secció 3).
- [ ] Redeployar.
- [ ] Configurar el webhook (secció 4).
- [ ] Lligar el teu chat_id al teu mediador (secció 7).
- [ ] (Opcional) Afegir els chat_ids dels altres mediadors a `TELEGRAM_AUTHORIZED_CHAT_IDS` i lligar-los també (secció 7) quan tinguin compte d'usuari.
- [ ] Ajustar `vercel.json` segons hivern/estiu si vols precisió horària.
