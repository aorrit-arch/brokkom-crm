// GET /api/telegram-daily-summary
// Cron a Vercel (19:00 Europe/Madrid). Envia un resum diari a tots els
// chat_ids autoritzats (o al chat_id del mediador, si està lligat).
//
// Tot va envoltat de try/catch — si Supabase o Telegram fallen, no rompem
// res; loguem i tornem 200 amb el motiu.

import { telegramConfigured, authorizedChatIds } from './_lib/env.js';
import { tgSendMessage, escapeTgHtml } from './_lib/telegram.js';
import { sbAdmin } from './_lib/supabase.js';

const TZ = 'Europe/Madrid';

function today() {
  return new Date();
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtEur(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('ca-ES').format(Math.round(v)) + '€';
}
function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' });
  } catch { return String(d); }
}

async function fetchSafe(table, query) {
  try {
    const q = sbAdmin().from(table).select('*');
    const r = await (query ? query(q) : q);
    if (r.error) { console.warn(`[daily] ${table}:`, r.error.message); return []; }
    return r.data || [];
  } catch (e) {
    console.warn(`[daily] ${table} threw:`, e.message);
    return [];
  }
}

function summarizeForMediador(allData, mediadorId) {
  const filt = (arr, key = 'mediador_id') => {
    if (!mediadorId) return arr;
    // Si cap registre té propietari, no filtrem (compat enrere)
    const hasOwner = arr.some(r => r && r[key]);
    if (!hasOwner) return arr;
    return arr.filter(r => r && r[key] === mediadorId);
  };

  const ofertes = filt(allData.ofertes);
  const seguiments = filt(allData.seguiments);
  const tasques = filt(allData.tasques);
  const venciments = filt(allData.venciments);
  const oportunitats = filt(allData.oportunitats);

  const now = today();
  const startToday = startOfDay(now);
  const yesterday = addDays(startToday, -1);

  // Tasques completades ahir/avui
  const tasquesCompletadesRecent = tasques.filter(t =>
    t.estat === 'done' && t.updated_at && new Date(t.updated_at) >= yesterday
  );
  // Tasques pendents (totes)
  const tasquesPend = tasques.filter(t => t.estat === 'pendent');
  // Tasques amb data límit propera (avui o demà)
  const tasquesUrgents = tasquesPend.filter(t => {
    if (!t.data_limit) return false;
    const dl = new Date(t.data_limit);
    return dl >= startToday && dl <= addDays(startToday, 1);
  });

  // Ofertes que necessiten seguiment: "Oferta enviada" sense seguiment >7 dies
  const ofertesEnviades = ofertes.filter(o => o.estat === 'Oferta enviada');
  const ofertesPerSeguir = ofertesEnviades.filter(o => {
    const segDelClient = seguiments
      .filter(s => s.client_id === o.client_id)
      .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))[0];
    if (!segDelClient) return true;
    const dies = (now - new Date(segDelClient.data)) / 86400000;
    return dies > 7;
  });

  // Oportunitats noves (estat Detectada) creades en els últims 7 dies
  const fa7d = addDays(now, -7);
  const oppsNoves = oportunitats.filter(o =>
    o.estat === 'Detectada' && o.created_at && new Date(o.created_at) >= fa7d
  );

  // Venciments propers (<= 14 dies)
  const venc14 = venciments.filter(v => {
    if (!v.data_venciment) return false;
    const dies = (new Date(v.data_venciment) - startToday) / 86400000;
    return dies >= 0 && dies <= 14;
  }).sort((a, b) => new Date(a.data_venciment) - new Date(b.data_venciment));

  return {
    tasquesCompletadesRecent,
    tasquesPend,
    tasquesUrgents,
    ofertesEnviades,
    ofertesPerSeguir,
    oppsNoves,
    venc14,
  };
}

function buildSummaryText(scope, s) {
  const ara = today().toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const lines = [];
  lines.push(`<b>📊 Resum diari — Brokkom CRM</b>`);
  lines.push(`<i>${escapeTgHtml(ara)}${scope ? ' · ' + escapeTgHtml(scope) : ''}</i>`);
  lines.push('');

  // Tasques
  lines.push(`<b>✓ Tasques</b>`);
  lines.push(`• Fetes recentment: ${s.tasquesCompletadesRecent.length}`);
  lines.push(`• Pendents totals: ${s.tasquesPend.length}`);
  if (s.tasquesUrgents.length) {
    lines.push(`• <b>Urgents (avui/demà): ${s.tasquesUrgents.length}</b>`);
    s.tasquesUrgents.slice(0, 5).forEach(t => {
      lines.push(`   – ${escapeTgHtml(t.titol || '?')} <i>(${fmtDate(t.data_limit)})</i>`);
    });
  }
  lines.push('');

  // Ofertes per seguir
  lines.push(`<b>📞 Ofertes per fer seguiment</b>`);
  if (s.ofertesPerSeguir.length === 0) {
    lines.push(`• Cap pendent (totes amb seguiment recent ✓)`);
  } else {
    lines.push(`• ${s.ofertesPerSeguir.length} ofertes "Oferta enviada" sense contacte >7d:`);
    s.ofertesPerSeguir.slice(0, 5).forEach(o => {
      lines.push(`   – ${escapeTgHtml(o.empresa || '?')} ${o.ram ? '· ' + escapeTgHtml(o.ram) : ''}`);
    });
  }
  lines.push('');

  // Oportunitats noves
  if (s.oppsNoves.length) {
    lines.push(`<b>💡 Oportunitats noves (7 dies)</b>`);
    s.oppsNoves.slice(0, 5).forEach(o => {
      const prio = o.prioritat ? ` <i>[${escapeTgHtml(o.prioritat)}]</i>` : '';
      lines.push(`• ${escapeTgHtml(o.empresa || '?')} — ${escapeTgHtml(o.producte || '')}${prio}`);
    });
    lines.push('');
  }

  // Venciments propers
  lines.push(`<b>📅 Venciments propers (14 dies)</b>`);
  if (s.venc14.length === 0) {
    lines.push(`• Cap`);
  } else {
    s.venc14.slice(0, 8).forEach(v => {
      lines.push(`• ${fmtDate(v.data_venciment)} — ${escapeTgHtml(v.empresa || '?')} ${v.ram ? '· ' + escapeTgHtml(v.ram) : ''}${v.prima_actual ? ' · ' + escapeTgHtml(fmtEur(v.prima_actual)) : ''}`);
    });
  }

  return lines.join('\n');
}

export default async function handler(req, res) {
  // Acceptem GET (cron Vercel l'envia així) i POST (per a proves manuals)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!telegramConfigured()) {
    return res.status(200).json({ ok: false, reason: 'not-configured' });
  }

  try {
    // Carrega dades base un sol cop
    const [ofertes, seguiments, tasques, venciments, oportunitats, mediadors] = await Promise.all([
      fetchSafe('ofertes'),
      fetchSafe('seguiments'),
      fetchSafe('tasques'),
      fetchSafe('venciments'),
      fetchSafe('oportunitats'),
      fetchSafe('mediadors', q => q.eq('actiu', true)),
    ]);
    const allData = { ofertes, seguiments, tasques, venciments, oportunitats };

    const results = [];

    // Cas 1: hi ha mediadors amb telegram_chat_id → enviem un resum per mediador.
    const mediadorsAmbChat = mediadors.filter(m => m.telegram_chat_id);
    if (mediadorsAmbChat.length > 0) {
      for (const m of mediadorsAmbChat) {
        const s = summarizeForMediador(allData, m.id);
        const text = buildSummaryText(m.nom || 'Cartera meva', s);
        const r = await tgSendMessage(m.telegram_chat_id, text);
        results.push({ chatId: m.telegram_chat_id, mediador: m.nom, ok: r.ok, error: r.error });
      }
    }

    // Cas 2: també enviem el resum global als chat_ids autoritzats que no
    // coincideixen amb un mediador (ex: el chat del propietari).
    const chatIdsJaEnviats = new Set(mediadorsAmbChat.map(m => String(m.telegram_chat_id)));
    const altres = authorizedChatIds().filter(id => !chatIdsJaEnviats.has(String(id)));
    if (altres.length > 0) {
      const sGlobal = summarizeForMediador(allData, null);
      const text = buildSummaryText("Equip sencer", sGlobal);
      for (const chatId of altres) {
        const r = await tgSendMessage(chatId, text);
        results.push({ chatId, ok: r.ok, error: r.error });
      }
    }

    return res.status(200).json({ ok: true, sent: results.length, results });
  } catch (e) {
    console.error('daily-summary fatal:', e);
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}
