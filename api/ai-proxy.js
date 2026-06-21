// ==================================================================
// BROKKOM CRM · ai-proxy.js — VERSIÓ BLINDADA (12/06/2026)
// Substitueix l'anterior, que era OBERT a tot internet.
//
// Canvis de seguretat:
//   1. Exigeix sessió de Supabase vàlida (el frontend ja envia el
//      JWT via apiCallWithRetry — no cal tocar res al client).
//   2. Sense CORS obert (l'app viu al mateix domini).
//   3. Whitelist de models i límit de max_tokens (control de cost).
// ==================================================================

import { ENV } from './_lib/env.js';

// La clau anònima és pública per definició (ja viu a app.js).
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92enZkbXhidW95c2NrcHJqbGVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjMxMjEsImV4cCI6MjA5NDM5OTEyMX0.lKCJRod0cwckd6BPBq546NHEbQtQoxv7OJzprvM3MSE';

const ALLOWED_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-7',
];
const MAX_TOKENS_CAP = 4096;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- 1. Autenticació: només usuaris amb sessió Supabase vàlida ---
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticat — cal sessió del CRM' });
  }
  try {
    const userResp = await fetch(`${ENV.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY },
    });
    if (!userResp.ok) {
      return res.status(401).json({ error: 'Sessió no vàlida o caducada' });
    }
  } catch (e) {
    return res.status(401).json({ error: "No s'ha pogut verificar la sessió" });
  }

  // --- 2. Configuració del servidor ---
  if (!ENV.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada al servidor' });
  }

  // --- 3. Sanejar la petició ---
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: 'Petició mal formada' });
  }
  if (!ALLOWED_MODELS.includes(body.model)) body.model = ALLOWED_MODELS[0];
  body.max_tokens = Math.min(Number(body.max_tokens) || 2048, MAX_TOKENS_CAP);

  // --- 4. Reenviar a Anthropic ---
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ENV.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(502).json({ error: "Error connectant amb el servei d'IA" });
  }
}
