// ==================================================================
// GET /api/v1/resum?periode=T2&any=2026
// Resum agregat del període per a l'ERP o eines de BI.
// periode: T1 | T2 | T3 | T4 | YTD | Y   (defecte: trimestre actual)
// any: per defecte l'any actual
// ==================================================================
import { sbAdmin } from '../_lib/supabase.js';
import { requireErpKey } from '../_lib/erp-auth.js';

function rangPeriode(periode, any) {
  const a = any;
  const r = {
    T1: [`${a}-01-01`, `${a}-03-31`],
    T2: [`${a}-04-01`, `${a}-06-30`],
    T3: [`${a}-07-01`, `${a}-09-30`],
    T4: [`${a}-10-01`, `${a}-12-31`],
    Y:  [`${a}-01-01`, `${a}-12-31`],
  };
  if (periode === 'YTD') return [`${a}-01-01`, new Date().toISOString().slice(0, 10)];
  return r[periode] || r.Y;
}

export default async function handler(req, res) {
  if (requireErpKey(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = new URL(req.url, 'https://x');
  const ara = new Date();
  const periode = (url.searchParams.get('periode') || `T${Math.floor(ara.getMonth() / 3) + 1}`).toUpperCase();
  const any = parseInt(url.searchParams.get('any') || String(ara.getFullYear()), 10);
  const [ini, fi] = rangPeriode(periode, any);

  const sb = sbAdmin();
  const [cons, ofertes] = await Promise.all([
    sb.from('consolidats').select('*').gte('data_tancament', ini).lte('data_tancament', fi),
    sb.from('ofertes').select('estat, prima_brokkom'),
  ]);
  if (cons.error) return res.status(500).json({ error: cons.error.message });

  const tanc = cons.data || [];
  const primaTotal = tanc.reduce((s, c) => s + (parseFloat(c.prima_anual) || 0), 0);
  const agrupa = (camp) => {
    const out = {};
    for (const c of tanc) {
      const k = c[camp] || '—';
      if (!out[k]) out[k] = { tancaments: 0, prima: 0 };
      out[k].tancaments++;
      out[k].prima += parseFloat(c.prima_anual) || 0;
    }
    return out;
  };
  const obertes = (ofertes.data || []).filter(o => !['Tancada guanyada', 'Tancada perduda'].includes(o.estat));

  return res.status(200).json({
    periode, any, des_de: ini, fins_a: fi,
    tancaments: tanc.length,
    prima_total: Math.round(primaTotal * 100) / 100,
    prima_mitjana: tanc.length ? Math.round((primaTotal / tanc.length) * 100) / 100 : 0,
    per_asseguradora: agrupa('asseguradora'),
    per_ram: agrupa('ram'),
    per_mediador: agrupa('mediador'),
    pipeline_obert: {
      ofertes: obertes.length,
      valor: Math.round(obertes.reduce((s, o) => s + (parseFloat(o.prima_brokkom) || 0), 0) * 100) / 100,
    },
  });
}
