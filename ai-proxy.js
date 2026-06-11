// ==================================================================
// /api/ai-proxy — proxy autenticat cap a l'API d'Anthropic
//
// SEGURETAT (canvis 11/06/2026):
//   1. Requereix JWT vàlid de Supabase (header Authorization: Bearer ...)
//      → el frontend ja l'envia via apiCallWithRetry. Sense token vàlid: 401.
//   2. Llista blanca de models → ningú pot demanar Opus a càrrec teu.
//   3. Límits de mida (prompt i max_tokens) → limita el cost per crida.
//   4. Els errors 429/529 d'Anthropic es propaguen amb el mateix codi
//      perquè el retry del frontend funcioni.
// ==================================================================

import { sbAdmin } from './_lib/supabase.js';
import { ENV } from './_lib/env.js';

// Clau anònima pública (la mateixa que el frontend) — només com a fallback
// per validar JWTs si SUPABASE_SERVICE_ROLE_KEY no està configurada a Vercel.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92enZkbXhidW95c2NrcHJqbGVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjMxMjEsImV4cCI6MjA5NDM5OTEyMX0.lKCJRod0cwckd6BPBq546NHEbQtQoxv7OJzprvM3MSE';

async function validateJwt(token) {
  // Via 1: client admin (si hi ha service role key)
  try {
    const { data, error } = await sbAdmin().auth.getUser(token);
    if (!error && data?.user) return true;
    if (!error) return false;
  } catch { /* service key absent → via 2 */ }
  // Via 2: REST directe amb la clau anon
  try {
    const r = await fetch(`${ENV.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    return r.ok;
  } catch {
    return false;
  }
}

const MODELS_PERMESOS = new Set([
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6'
]);
const MAX_TOKENS_LIMIT = 4096;
const MAX_PROMPT_CHARS = 60000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada al servidor' });
  }

  // --- 1. Autenticació: validar el JWT de Supabase ---
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: { message: 'Cal iniciar sessió per usar la IA' } });
  }
  const valid = await validateJwt(token);
  if (!valid) {
    return res.status(401).json({ error: { message: 'Sessió no vàlida o caducada' } });
  }

  // --- 2. Validar i sanejar la petició ---
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: { message: 'Body JSON invàlid' } });
  }

  const model = MODELS_PERMESOS.has(body?.model) ? body.model : 'claude-haiku-4-5-20251001';
  const max_tokens = Math.min(parseInt(body?.max_tokens) || 2048, MAX_TOKENS_LIMIT);
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: { message: 'Falten els missatges' } });
  }
  const totalChars = JSON.stringify(messages).length;
  if (totalChars > MAX_PROMPT_CHARS) {
    return res.status(413).json({ error: { message: `Text massa llarg (${totalChars} caràcters, màxim ${MAX_PROMPT_CHARS})` } });
  }

  // --- 3. Crida a Anthropic ---
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model, max_tokens, messages })
    });

    const data = await response.json();
    // Propaguem el codi original (429/529 inclosos) perquè el retry
    // del frontend (apiCallWithRetry) funcioni correctament.
    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
}
