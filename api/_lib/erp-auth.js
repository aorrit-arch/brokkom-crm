// ==================================================================
// Autenticació de l'API ERP (api/v1/*).
// L'ERP s'identifica amb una clau pròpia, separada de tot el demés:
//   Authorization: Bearer <ERP_API_KEY>
// La clau es configura com a variable d'entorn ERP_API_KEY a Vercel.
// ==================================================================

import crypto from 'node:crypto';

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Retorna null si tot ok; si no, respon l'error i retorna res (truthy).
export function requireErpKey(req, res) {
  const expected = process.env.ERP_API_KEY || '';
  if (!expected) {
    res.status(500).json({ error: 'ERP_API_KEY no configurada al servidor. Afegeix-la a Vercel → Environment Variables.' });
    return res;
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !timingSafeEqualStr(token, expected)) {
    res.status(401).json({ error: 'Clau API no vàlida' });
    return res;
  }
  return null;
}
