// GET/POST /api/telegram-weekly-backup
// Versió robusta: els imports van DINS del try i tot està protegit, de manera
// que qualsevol problema es retorna com a JSON llegible en lloc de fer petar
// la funció (error 500). Bolca totes les taules a un únic JSON i l'envia com a
// document als chat_ids autoritzats de Telegram. Còpia de seguretat sense Pro.

export const config = { maxDuration: 60 };

const TABLES = [
  'clients', 'ofertes', 'consolidats', 'seguiments', 'oportunitats',
  'venciments', 'tasques', 'asseguradores', 'posts', 'mediadors',
  'inbox_items', 'notes', 'agenda_events', 'esborranys',
  'vinculacions', 'comparticions', 'user_config',
];

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // 1) Imports protegits: si un fitxer auxiliar falla o és antic, ho veurem en JSON.
  let env, tg, sb;
  try {
    env = await import('./_lib/env.js');
    tg = await import('./_lib/telegram.js');
    sb = await import('./_lib/supabase.js');
  } catch (e) {
    return res.status(200).json({ ok: false, where: 'import', error: e.message || String(e) });
  }

  try {
    const { telegramConfigured, authorizedChatIds } = env;
    const { tgSendDocument, tgSendMessage } = tg;
    const { sbAdmin } = sb;

    // 2) Comprovem que cada peça existeix de debò (detecta fitxers auxiliars antics).
    if (typeof telegramConfigured !== 'function')
      return res.status(200).json({ ok: false, where: 'env', error: 'Falta telegramConfigured/authorizedChatIds — env.js antic?' });
    if (typeof sbAdmin !== 'function')
      return res.status(200).json({ ok: false, where: 'supabase', error: 'Falta sbAdmin — supabase.js antic?' });
    if (typeof tgSendDocument !== 'function')
      return res.status(200).json({ ok: false, where: 'telegram', error: 'Falta tgSendDocument — telegram.js antic?' });

    if (!telegramConfigured())
      return res.status(200).json({ ok: false, reason: 'not-configured', help: 'Falta TELEGRAM_BOT_TOKEN a Vercel' });

    // 3) Bolcat de totes les taules EN PARAL·LEL (més ràpid, evita timeouts).
    const dumpTable = async (t) => {
      try {
        const r = await sbAdmin().from(t).select('*');
        if (r.error) return { error: r.error.message, rows: [] };
        return { rows: r.data || [] };
      } catch (e) {
        return { error: e.message, rows: [] };
      }
    };

    const backup = { _meta: { generat: new Date().toISOString(), versio: '2', app: 'brokkom-crm' } };
    const counts = {};
    const dumps = await Promise.all(TABLES.map(t => dumpTable(t).then(d => [t, d])));
    for (const [t, d] of dumps) {
      backup[t] = d.rows;
      counts[t] = d.error ? `error: ${d.error}` : d.rows.length;
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename = `brokkom-backup-${date}.json`;
    const json = JSON.stringify(backup, null, 2);
    const totalReg = Object.values(counts).filter(c => typeof c === 'number').reduce((a, b) => a + b, 0);
    const caption =
      `🗄️ <b>Còpia de seguretat — Brokkom CRM</b>\n` +
      `${date} · ${totalReg} registres en total\n` +
      `Clients: ${counts.clients} · Ofertes: ${counts.ofertes} · Consolidats: ${counts.consolidats} · Venciments: ${counts.venciments}`;

    const chatIds = authorizedChatIds();
    if (!chatIds || chatIds.length === 0)
      return res.status(200).json({ ok: false, reason: 'no-chat-ids', help: 'Falta TELEGRAM_AUTHORIZED_CHAT_IDS a Vercel', counts });

    const results = [];
    for (const chatId of chatIds) {
      try {
        const r = await tgSendDocument(chatId, filename, json, caption);
        if (!r.ok && typeof tgSendMessage === 'function')
          await tgSendMessage(chatId, `⚠️ No s'ha pogut enviar la còpia (${r.error}).`);
        results.push({ chatId, ok: r.ok, error: r.error });
      } catch (e) {
        results.push({ chatId, ok: false, error: e.message });
      }
    }
    return res.status(200).json({ ok: true, sent: results.length, counts, results });

  } catch (e) {
    return res.status(200).json({ ok: false, where: 'run', error: e.message || String(e), stack: (e.stack || '').split('\n').slice(0, 3) });
  }
}
