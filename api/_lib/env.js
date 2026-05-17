// Variables d'entorn requerides per als endpoints del servidor.
// Centralitzem aquí els noms per evitar typos i poder canviar-los en un sol lloc.

export const ENV = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_AUTHORIZED_CHAT_IDS: process.env.TELEGRAM_AUTHORIZED_CHAT_IDS || '',
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ovzvdmxbuoysckprjlej.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
};

export function telegramConfigured() {
  return !!ENV.TELEGRAM_BOT_TOKEN;
}

export function authorizedChatIds() {
  return ENV.TELEGRAM_AUTHORIZED_CHAT_IDS
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function isChatIdAuthorized(chatId) {
  const allowed = authorizedChatIds();
  // Si no hi ha cap chat_id configurat, refusem-ho tot per seguretat.
  if (allowed.length === 0) return false;
  return allowed.includes(String(chatId));
}
