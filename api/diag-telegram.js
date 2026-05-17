// TEMPORAL — endpoint de diagnòstic per verificar si les variables d'entorn
// de Telegram han arribat correctament al deploy. NO exposa cap secret en
// cru — només la longitud i un hash truncat (irreversible).
//
// ESBORRAR aquest fitxer després de fer servir-lo.

import crypto from 'node:crypto';

function shaPrefix(s) {
  if (!s) return null;
  return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 8);
}

export default async function handler(req, res) {
  const t = process.env.TELEGRAM_BOT_TOKEN || '';
  const s = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const ids = process.env.TELEGRAM_AUTHORIZED_CHAT_IDS || '';
  res.status(200).json({
    token: { defined: !!t, length: t.length, sha8: shaPrefix(t), startsWith: t.slice(0, 4) || null },
    secret: { defined: !!s, length: s.length, sha8: shaPrefix(s), hasLeadingSpace: s !== s.trimStart(), hasTrailingSpace: s !== s.trimEnd() },
    authorizedChatIds: { defined: !!ids, raw_length: ids.length, count: ids.split(',').map(x => x.trim()).filter(Boolean).length },
    supabaseServiceRole: { defined: !!process.env.SUPABASE_SERVICE_ROLE_KEY, length: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length },
    anthropic: { defined: !!process.env.ANTHROPIC_API_KEY, length: (process.env.ANTHROPIC_API_KEY || '').length },
  });
}
