// Helpers per a l'API HTTP de Telegram Bot.
// Documentació: https://core.telegram.org/bots/api

import { ENV, telegramConfigured } from './env.js';

const TG_API = 'https://api.telegram.org';

function endpoint(method) {
  return `${TG_API}/bot${ENV.TELEGRAM_BOT_TOKEN}/${method}`;
}

// Trenca un text llarg en blocs <= 4000 chars (límit Telegram: 4096).
function chunkText(text, maxLen = 4000) {
  if (!text || text.length <= maxLen) return [text || ''];
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + maxLen, text.length);
    // Intentem tallar a final de línia o frase per no partir paraules
    if (end < text.length) {
      const lastNl = text.lastIndexOf('\n', end);
      if (lastNl > i + maxLen * 0.5) end = lastNl;
    }
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}

// Sanitiza HTML que enviarem a Telegram amb parse_mode='HTML'.
// Telegram només accepta etiquetes molt limitades; per simplicitat fem
// escape complet i afegim només els <b>/<i>/<a> que generem nosaltres.
export function escapeTgHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Envia un missatge al chat_id donat. Reintents simples davant errors 5xx
// o de xarxa. Retorna {ok, error?}.
export async function tgSendMessage(chatId, text, opts = {}) {
  if (!telegramConfigured()) return { ok: false, error: 'TELEGRAM_BOT_TOKEN no configurat' };
  if (!chatId) return { ok: false, error: 'chatId buit' };
  const parts = chunkText(text || '');
  let lastError = null;
  for (const part of parts) {
    if (!part) continue;
    const body = {
      chat_id: chatId,
      text: part,
      parse_mode: opts.parseMode || 'HTML',
      disable_web_page_preview: opts.disablePreview !== false,
    };
    if (opts.replyMarkup) body.reply_markup = opts.replyMarkup;
    if (opts.replyToMessageId) body.reply_to_message_id = opts.replyToMessageId;
    const r = await tgRequest('sendMessage', body);
    if (!r.ok) lastError = r.error;
  }
  return lastError ? { ok: false, error: lastError } : { ok: true };
}

// Crida genèrica a Telegram amb retries.
async function tgRequest(method, body, retries = 2) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(endpoint(method), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.ok) return { ok: true, result: data.result };
      // 429 → respect retry_after
      if (resp.status === 429 && data?.parameters?.retry_after) {
        await new Promise(r => setTimeout(r, (data.parameters.retry_after + 1) * 1000));
        lastErr = `429: ${data.description}`;
        continue;
      }
      // 5xx → reintents
      if (resp.status >= 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        lastErr = `${resp.status}: ${data.description || ''}`;
        continue;
      }
      return { ok: false, error: data.description || `HTTP ${resp.status}` };
    } catch (e) {
      lastErr = e.message || String(e);
      if (attempt === retries) return { ok: false, error: lastErr };
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return { ok: false, error: lastErr || 'unknown' };
}

// Descarrega un fitxer del bot (típicament una foto) i retorna {buffer, mimeType}.
// L'API de Telegram dóna un file_id; cal cridar getFile per saber l'URL.
export async function tgDownloadFile(fileId) {
  if (!telegramConfigured()) throw new Error('TELEGRAM_BOT_TOKEN no configurat');
  const info = await tgRequest('getFile', { file_id: fileId }, 1);
  if (!info.ok || !info.result?.file_path) throw new Error('getFile: ' + (info.error || 'no path'));
  const url = `${TG_API}/file/bot${ENV.TELEGRAM_BOT_TOKEN}/${info.result.file_path}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('download ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const mimeType = r.headers.get('content-type') || guessMimeFromPath(info.result.file_path);
  return { buffer: buf, mimeType, size: info.result.file_size || buf.length };
}

function guessMimeFromPath(p) {
  const ext = (p.split('.').pop() || '').toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext] || 'application/octet-stream';
}

// Configura el webhook (utilitat per a setup; no s'invoca automàticament).
export async function tgSetWebhook(url, secretToken) {
  return tgRequest('setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message', 'edited_message', 'callback_query'],
  }, 1);
}
