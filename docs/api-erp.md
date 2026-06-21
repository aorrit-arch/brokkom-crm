# API Brokkom CRM per a l'ERP

Versió 1 · actualitzat 12/06/2026

API REST de només connexió servidor-a-servidor perquè l'ERP de Brokkom
llegeixi dades comercials del CRM i hi pugui empènyer venciments i clients.
Estil Notion: recursos clars, JSON net, exemples copiables.

---

## 1. Autenticació

Totes les peticions porten la clau a la capçalera:

```
Authorization: Bearer <ERP_API_KEY>
```

**On viu la clau:** variable d'entorn `ERP_API_KEY` a Vercel
(Settings → Environment Variables). És una clau independent: si mai es
filtra, es canvia allà i llestos, sense afectar usuaris ni la IA.

**Com generar-ne una de segura** (terminal de Mac/Linux):

```bash
openssl rand -hex 32
```

Resposta si la clau és incorrecta o falta: `401 {"error":"Clau API no vàlida"}`

---

## 2. Base URL

```
https://<el-teu-domini>.vercel.app/api/v1
```

---

## 3. Recursos

| Recurs | GET (llegir) | POST (crear) | Notes |
|---|---|---|---|
| `/clients` | ✅ | ✅ | Cartera de clients |
| `/consolidats` | ✅ | — | Tancaments guanyats (amb núm. pòlissa per casar amb l'ERP) |
| `/venciments` | ✅ | ✅ | L'ERP pot empènyer venciments de pòlissa → el CRM activa alarmes 90/30/7 |
| `/ofertes` | ✅ | — | Pipeline comercial |
| `/resum` | ✅ | — | Agregat per període (per a BI/quadres de comandament) |

Tots els registres creats per l'ERP queden marcats amb `[Origen: ERP]` a les notes.

---

## 4. Paràmetres comuns de llistat (GET)

| Paràmetre | Exemple | Què fa |
|---|---|---|
| `q` | `q=benangels` | Cerca de text (empresa, CIF, contacte...) |
| `since` | `since=2026-06-01` | Només registres posteriors a la data |
| `limit` | `limit=50` | Mida de pàgina (màxim 200, defecte 100) |
| `offset` | `offset=100` | Paginació |
| `id` | `id=<uuid>` | Retorna un únic registre |

Filtres d'igualtat per recurs:
- `clients`: `sector`, `cif`
- `consolidats`: `asseguradora`, `ram`, `mediador`, `num_polissa`
- `venciments`: `asseguradora`, `ram`
- `ofertes`: `estat`, `ram`, `asseguradora`, `mediador`

Resposta de llistat:

```json
{ "data": [ ... ], "total": 137, "limit": 100, "offset": 0 }
```

---

## 5. Exemples copiables

### Llegir els tancaments d'una asseguradora

```bash
curl -s "https://EL-TEU-DOMINI.vercel.app/api/v1/consolidats?asseguradora=Zurich&limit=20" \
  -H "Authorization: Bearer LA_TEVA_ERP_API_KEY"
```

### Buscar un client per CIF

```bash
curl -s "https://EL-TEU-DOMINI.vercel.app/api/v1/clients?cif=B17989591" \
  -H "Authorization: Bearer LA_TEVA_ERP_API_KEY"
```

### Sincronització incremental (només canvis des d'ahir)

```bash
curl -s "https://EL-TEU-DOMINI.vercel.app/api/v1/clients?since=2026-06-11" \
  -H "Authorization: Bearer LA_TEVA_ERP_API_KEY"
```

### L'ERP empeny un venciment de pòlissa al CRM

```bash
curl -s -X POST "https://EL-TEU-DOMINI.vercel.app/api/v1/venciments" \
  -H "Authorization: Bearer LA_TEVA_ERP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "empresa": "Transportes Benangels SL",
    "ram": "Multiriscos industrial",
    "asseguradora": "Zurich",
    "data_venciment": "2027-04-30",
    "prima_actual": 4850.00,
    "notes": "Pòlissa 0099-1234567"
  }'
```

Resposta: `201` amb el registre creat. A partir d'aquí el CRM mostra el
venciment i les alarmes 90/30/7.

### Crear un client des de l'ERP

```bash
curl -s -X POST "https://EL-TEU-DOMINI.vercel.app/api/v1/clients" \
  -H "Authorization: Bearer LA_TEVA_ERP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "empresa": "Logística Exemple SL", "cif": "B00000000", "sector": "Logística" }'
```

### Resum trimestral agregat (per a BI)

```bash
curl -s "https://EL-TEU-DOMINI.vercel.app/api/v1/resum?periode=T2&any=2026" \
  -H "Authorization: Bearer LA_TEVA_ERP_API_KEY"
```

```json
{
  "periode": "T2", "any": 2026,
  "tancaments": 14,
  "prima_total": 61240.50,
  "prima_mitjana": 4374.32,
  "per_asseguradora": { "Zurich": { "tancaments": 6, "prima": 29400 } },
  "per_ram": { "...": {} },
  "pipeline_obert": { "ofertes": 12, "valor": 48200 }
}
```

---

## 6. Codis d'error

| Codi | Significat |
|---|---|
| `400` | Petició mal formada o falta un camp obligatori |
| `401` | Clau API absent o incorrecta |
| `404` | Registre no trobat (GET amb `id`) |
| `405` | Mètode no permès (p. ex. POST a un recurs de només lectura) |
| `500` | Error de servidor (el missatge ho detalla) |

---

## 7. Seguretat

- La clau viatja sempre per HTTPS (Vercel ho força).
- Comparació de clau en temps constant (no filtra informació per timing).
- L'API no exposa mai usuaris, sessions ni la clau d'Anthropic.
- Recomanat: rotar `ERP_API_KEY` un cop l'any o si canvia el proveïdor de l'ERP.
