// GET/POST /api/telegram-weekly-backup
// Cron setmanal a Vercel. Bolca TOTES les taules a un únic JSON i l'envia
// com a document als chat_ids autoritzats de Telegram. Còpia de seguretat
// sense dependre del pla Pro de Supabase.
//
// Tot va envoltat de try/catch: si una taula falla, es marca i continua;
// la resta del backup s'envia igualment.

import { telegramConfigured, authorizedChatIds } from './_lib/env.js';
import { tgSendDocument, tgSendMessage } from './_lib/telegram.js';
import { sbAdmin } from './_lib/supabase.js';

// Totes les taules de dades del CRM. Si alguna encara no existeix,
// dumpTable ho captura i no trenca la resta.
const TABLES = [
  'clients', 'ofertes', 'consolidats', 'seguiments', 'oportunitats',
  'venciments', 'tasques', 'asseguradores', 'posts', 'mediadors',
  'inbox_items', 'notes', 'agenda_events', 'esborranys',
  'vinculacions', 'comparticions', 'user_config',
];

async function dumpTable(t) {
  try {
    const r = await sbAdmin().from(t).select('*');
    if (r.error) { console.warn(`[backup] ${t}:`, r.error.message); return { error: r.error.message, rows: [] }; }
    return { rows: r.data || [] };
  } catch (e) {
    console.warn(`[backup] ${t} threw:`, e.message);
    return { error: e.message, rows: [] };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!telegramConfigured()) {
    return res.status(200).json({ ok: false, reason: 'not-configured' });
  }

  try {
    const backup = { _meta: { generat: new Date().toISOString(), versio: '1', app: 'brokkom-crm' } };
    const counts = {};
    for (const t of TABLES) {
      const d = await dumpTable(t);
      backup[t] = d.rows;
      counts[t] = d.error ? `error: ${d.error}` : d.rows.length;
    }

    const json = JSON.stringify(backup, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `brokkom-backup-${date}.json`;
    const totalReg = Object.values(counts).filter(c => typeof c === 'number').reduce((a, b) => a + b, 0);
    const caption =
      `🗄️ <b>Còpia de seguretat setmanal — Brokkom CRM</b>\n` +
      `${date} · ${totalReg} registres en total\n` +
      `Clients: ${counts.clients} · Ofertes: ${counts.ofertes} · Consolidats: ${counts.consolidats} · Venciments: ${counts.venciments}`;

    const chatIds = authorizedChatIds();
    if (chatIds.length === 0) {
      return res.status(200).json({ ok: false, reason: 'no-chat-ids', counts });
    }

    const results = [];
    for (const chatId of chatIds) {
      const r = await tgSendDocument(chatId, filename, json, caption);
      if (!r.ok) {
        await tgSendMessage(chatId, `⚠️ No s'ha pogut enviar la còpia de seguretat (${r.error}). Revisa l'app i fes una exportació manual.`);
      }
      results.push({ chatId, ok: r.ok, error: r.error });
    }

    return res.status(200).json({ ok: true, sent: results.length, counts, results });
  } catch (e) {
    console.error('weekly-backup fatal:', e);
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}
