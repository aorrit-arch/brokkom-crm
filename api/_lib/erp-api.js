// ==================================================================
// Fàbrica genèrica d'endpoints REST per a l'API ERP (api/v1/*).
//
//   GET  /api/v1/<recurs>                → llista (filtres + paginació)
//   GET  /api/v1/<recurs>?id=<uuid>      → un sol registre
//   POST /api/v1/<recurs>                → crear (si el recurs ho permet)
//
// Filtres comuns a GET:
//   q=<text>        cerca als camps de cerca del recurs
//   since=<ISO>     només registres posteriors a aquesta data
//   limit=<n>       màxim 200 (defecte 100)
//   offset=<n>      paginació
//   + filtres d'igualtat propis de cada recurs (vegeu docs/api-erp.md)
// ==================================================================

import { sbAdmin, defaultOwnerUserId } from './supabase.js';
import { requireErpKey } from './erp-auth.js';

export function makeResourceHandler(cfg) {
  // cfg = { table, searchFields, filterFields, createFields, requiredOnCreate, orderBy, sinceField }
  return async function handler(req, res) {
    if (requireErpKey(req, res)) return;

    const sb = sbAdmin();

    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://x');
      const id = url.searchParams.get('id');

      if (id) {
        const { data, error } = await sb.from(cfg.table).select('*').eq('id', id).maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        if (!data) return res.status(404).json({ error: 'No trobat' });
        return res.status(200).json({ data });
      }

      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 200);
      const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
      let query = sb.from(cfg.table).select('*', { count: 'exact' });

      const q = url.searchParams.get('q');
      if (q && cfg.searchFields?.length) {
        query = query.or(cfg.searchFields.map(f => `${f}.ilike.%${q.replace(/[%,()]/g, '')}%`).join(','));
      }
      const since = url.searchParams.get('since');
      if (since) query = query.gte(cfg.sinceField || 'created_at', since);

      for (const f of (cfg.filterFields || [])) {
        const v = url.searchParams.get(f);
        if (v) query = query.eq(f, v);
      }

      query = query.order(cfg.orderBy || 'created_at', { ascending: false }).range(offset, offset + limit - 1);
      const { data, error, count } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data, total: count, limit, offset });
    }

    if (req.method === 'POST') {
      if (!cfg.createFields?.length) {
        return res.status(405).json({ error: `El recurs ${cfg.table} és només de lectura per a l'ERP` });
      }
      let body;
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      } catch {
        return res.status(400).json({ error: 'JSON mal format' });
      }
      for (const f of (cfg.requiredOnCreate || [])) {
        if (!body[f]) return res.status(400).json({ error: `Camp obligatori: ${f}` });
      }
      const record = {};
      for (const f of cfg.createFields) {
        if (body[f] !== undefined && body[f] !== '') record[f] = body[f];
      }
      record.user_id = await defaultOwnerUserId(null);
      if (!record.user_id) {
        return res.status(500).json({ error: 'No hi ha cap admin actiu per assignar com a propietari del registre' });
      }
      record.notes = [record.notes, '[Origen: ERP]'].filter(Boolean).join(' ');

      const { data, error } = await sb.from(cfg.table).insert(record).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  };
}
