// POST /api/telegram-send
// Envia un missatge des del CRM al teu xat (o als chat_ids autoritzats).
//
// Body: { chatId?: string, text: string, parseMode?: 'HTML'|'MarkdownV2' }
// Si no es passa chatId, envia a tots els autoritzats.
//
// Falla suaument si Telegram no està configurat: retorna 200 amb {ok:false,
// reason:'not-configured'}. El frontend gestiona aquest cas (no rompre res).

import { tgSendMessage } from './_lib/telegram.js';
import { telegramConfigured, authorizedChatIds, isChatIdAuthorized } from './_lib/env.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!telegramConfigured()) {
    return res.status(200).json({ ok: false, reason: 'not-configured', message: 'TELEGRAM_BOT_TOKEN no configurat al servidor — funció Telegram inactiva.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ ok: false, error: 'JSON invàlid' });
  }
  const text = (body.text || '').toString();
  if (!text.trim()) return res.status(400).json({ ok: false, error: 'falta text' });

  // Lista de destinataris. Per defecte, els autoritzats.
  let targets = [];
  if (body.chatId) {
    if (!isChatIdAuthorized(body.chatId)) {
      return res.status(403).json({ ok: false, error: 'chatId no autoritzat' });
    }
    targets = [String(body.chatId)];
  } else {
    targets = authorizedChatIds();
    if (targets.length === 0) {
      return res.status(500).json({ ok: false, error: 'TELEGRAM_AUTHORIZED_CHAT_IDS buit' });
    }
  }

  const parseMode = body.parseMode || 'HTML';
  const results = [];
  for (const chatId of targets) {
    try {
      const r = await tgSendMessage(chatId, text, { parseMode, replyMarkup: body.replyMarkup });
      results.push({ chatId, ok: r.ok, error: r.error });
    } catch (e) {
      results.push({ chatId, ok: false, error: e.message || String(e) });
    }
  }
  const anyOk = results.some(r => r.ok);
  return res.status(anyOk ? 200 : 500).json({ ok: anyOk, results });
}
