// TEMPORAL — endpoint d'un sol ús per lligar el chat_id de Telegram al
// mediador d'Albert. Executar una vegada i esborrar.
//
// Equivalent al DO block de SQL: cerca el mediador per email, l'actualitza
// (telegram_chat_id + user_id si està buit + actiu=true) si existeix; el
// crea altrament.

import { sbAdmin } from './_lib/supabase.js';

const EMAIL = 'aorrit@gmail.com';
const NOM = 'Albert Orrit';
const CHAT_ID = '8683292744';

export default async function handler(req, res) {
  try {
    const sb = sbAdmin();

    // 1) auth.users → user_id
    let authUid = null;
    try {
      // listUsers paginat — busquem fins trobar-lo (compte petit, n'hi haurà amb 1 pàgina)
      let page = 1;
      while (page <= 5) {
        const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const u = (data?.users || []).find(x => x.email && x.email.toLowerCase() === EMAIL.toLowerCase());
        if (u) { authUid = u.id; break; }
        if (!data?.users || data.users.length < 200) break;
        page++;
      }
    } catch (e) {
      console.warn('listUsers:', e.message);
    }

    // 2) cerca mediador existent
    const { data: existing, error: selErr } = await sb
      .from('mediadors')
      .select('*')
      .ilike('email', EMAIL)
      .maybeSingle();
    if (selErr) {
      return res.status(500).json({ ok: false, step: 'select mediador', error: selErr.message });
    }

    if (existing) {
      const updates = {
        telegram_chat_id: CHAT_ID,
        actiu: true,
      };
      if (!existing.user_id && authUid) updates.user_id = authUid;

      const { data, error } = await sb
        .from('mediadors')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) return res.status(500).json({ ok: false, step: 'update', error: error.message });
      return res.status(200).json({
        ok: true,
        action: 'updated',
        before: { id: existing.id, user_id: existing.user_id, telegram_chat_id: existing.telegram_chat_id, rol: existing.rol },
        after: { id: data.id, user_id: data.user_id, telegram_chat_id: data.telegram_chat_id, rol: data.rol },
      });
    }

    const payload = {
      user_id: authUid,
      nom: NOM,
      email: EMAIL,
      rol: 'admin',
      telegram_chat_id: CHAT_ID,
      actiu: true,
    };
    const { data, error } = await sb.from('mediadors').insert(payload).select().single();
    if (error) return res.status(500).json({ ok: false, step: 'insert', error: error.message, attempted: { ...payload, user_id_resolved: !!authUid } });
    return res.status(200).json({ ok: true, action: 'inserted', row: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}
