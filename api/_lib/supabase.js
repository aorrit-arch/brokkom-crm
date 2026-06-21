// Client de Supabase amb la clau service-role per als endpoints del servidor.
// Aquesta clau NO ha de ser visible al client (mai exportada al bundle).
// Els endpoints l'usen per llegir/escriure saltant-se el RLS quan cal.

import { createClient } from '@supabase/supabase-js';
import { ENV } from './env.js';

let _client = null;

export function sbAdmin() {
  if (_client) return _client;
  if (!ENV.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada — necessària per als endpoints servidor.');
  }
  _client = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// Resolt el mediador associat a un chat_id de Telegram (autoritzat).
// Es busca tant per `mediadors.telegram_chat_id` com pel chat_id de l'autoritzat
// (fallback: si no hi ha lligadura encara, simplement no s'assigna `mediador_id`).
export async function mediadorByChatId(chatId) {
  try {
    const { data } = await sbAdmin()
      .from('mediadors')
      .select('*')
      .eq('telegram_chat_id', String(chatId))
      .eq('actiu', true)
      .limit(1)
      .maybeSingle();
    return data || null;
  } catch (e) {
    console.warn('mediadorByChatId:', e.message);
    return null;
  }
}

// user_id "propietari" per als registres creats des de Telegram. Si tenim
// un mediador lligat a aquest chat amb un user_id, l'usem. Si no, agafem
// el primer admin actiu. Si tampoc hi ha admin, retornem null i caldrà
// configurar-ho manualment després.
export async function defaultOwnerUserId(mediador) {
  if (mediador?.user_id) return mediador.user_id;
  try {
    const { data } = await sbAdmin()
      .from('mediadors')
      .select('user_id')
      .eq('rol', 'admin')
      .eq('actiu', true)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();
    return data?.user_id || null;
  } catch {
    return null;
  }
}
