// Crida a l'API d'Anthropic des del servidor (NO via /api/ai-proxy per evitar
// salts innecessaris). Pensat per a l'extracció d'entitats des de Telegram.

import { ENV } from './env.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export async function callClaude({ prompt, model, imageBase64, imageType, maxTokens = 2048 }) {
  if (!ENV.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no configurada');
  }
  const content = [];
  if (imageBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: imageType || 'image/jpeg', data: imageBase64 } });
  }
  content.push({ type: 'text', text: prompt });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000); // 90s margem ampli
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ENV.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }],
      }),
      signal: ctrl.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.error) {
      throw new Error(`Claude ${resp.status}: ${data.error?.message || JSON.stringify(data).slice(0, 200)}`);
    }
    return data.content?.[0]?.text || '';
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Claude timeout (90s)');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Extreu un JSON d'una resposta de Claude que pot venir amb fences ```json … ```
export function extractJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  // Pot venir amb text introductori — busquem el primer { i l'últim }.
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    try { return JSON.parse(cleaned); } catch { return null; }
  }
  const slice = cleaned.slice(first, last + 1);
  try { return JSON.parse(slice); } catch { return null; }
}
