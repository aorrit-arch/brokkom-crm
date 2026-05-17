// TEMPORAL — llista els emails registrats a auth.users perquè identifiquem
// el de l'usuari que ha de quedar lligat al seu mediador.
//
// ESBORRAR després d'usar-lo.

import { sbAdmin } from './_lib/supabase.js';

export default async function handler(req, res) {
  try {
    const sb = sbAdmin();
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
    if (error) return res.status(500).json({ ok: false, error: error.message });
    const users = (data?.users || []).map(u => ({
      id: u.id,
      email: u.email || null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));
    return res.status(200).json({ ok: true, total: users.length, users });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}
