// POST /api/telegram-webhook
// Rep updates del bot de Telegram. Suporta:
//   • Comandes:  /start /help /avui /pendents /buscar TEXT /nouclient /oferta /seguiment
//   • Text lliure: la IA detecta entitats i les crea (clients, ofertes, ...)
//   • Fotos: OCR + IA per a targetes de visita / pòlisses → crea contacte/oferta
//
// Seguretat:
//   • Filtra per TELEGRAM_AUTHORIZED_CHAT_IDS — qualsevol altre chat_id queda
//     silenciat amb un missatge breu.
//   • Verifica el header `x-telegram-bot-api-secret-token` si està configurat.
//
// Tot envoltat de try/catch — un error en un update no pot tombar el webhook.

import { ENV, telegramConfigured, isChatIdAuthorized } from './_lib/env.js';
import { tgSendMessage, tgDownloadFile, escapeTgHtml } from './_lib/telegram.js';
import { sbAdmin, mediadorByChatId, defaultOwnerUserId } from './_lib/supabase.js';
import { callClaude, extractJson } from './_lib/ai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, msg: 'GET ok' });
  }

  // Verifica el secret token de Telegram (recomanat — mira /docs/telegram.md)
  if (ENV.TELEGRAM_WEBHOOK_SECRET) {
    const got = req.headers['x-telegram-bot-api-secret-token'];
    if (got !== ENV.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('[webhook] secret mismatch');
      return res.status(401).json({ ok: false, error: 'invalid secret' });
    }
  }

  if (!telegramConfigured()) {
    return res.status(200).json({ ok: false, reason: 'not-configured' });
  }

  let update;
  try {
    update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'JSON invàlid' });
  }

  // Telegram espera 200 ràpidament — si triguem massa, retransmet.
  // Processem inline (el límit de Vercel és 10s en hobby) i només responem
  // un cop hem fet la feina o ha fallat.
  try {
    await processUpdate(update);
  } catch (e) {
    console.error('[webhook] processUpdate:', e);
  }
  return res.status(200).json({ ok: true });
}

async function processUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg) return;
  const chatId = msg.chat?.id;
  const from = msg.from?.username || msg.from?.first_name || 'usuari';

  if (!isChatIdAuthorized(chatId)) {
    await tgSendMessage(chatId, `🚫 No autoritzat. Aquest chat_id (<code>${escapeTgHtml(String(chatId))}</code>) no està a la llista. Si ets administrador del CRM, afegeix-lo a TELEGRAM_AUTHORIZED_CHAT_IDS a Vercel.`);
    return;
  }

  // Photo first: pot venir amb caption
  if (Array.isArray(msg.photo) && msg.photo.length) {
    return handlePhoto(chatId, msg);
  }

  const text = (msg.text || msg.caption || '').trim();
  if (!text) {
    await tgSendMessage(chatId, '🤔 Missatge buit. Envia text, una foto, o /help per a la llista de comandes.');
    return;
  }

  if (text.startsWith('/')) {
    return handleCommand(chatId, text, msg);
  }

  return handleFreeText(chatId, text, msg);
}

// ============================================================
// Comandes
// ============================================================
async function handleCommand(chatId, text, msg) {
  const [raw, ...args] = text.split(/\s+/);
  const cmd = raw.toLowerCase().split('@')[0]; // /cmd@botname

  if (cmd === '/start' || cmd === '/help') {
    await tgSendMessage(chatId, helpText(chatId));
    return;
  }
  if (cmd === '/id' || cmd === '/whoami') {
    await tgSendMessage(chatId, `Aquest chat_id: <code>${chatId}</code>`);
    return;
  }
  if (cmd === '/avui') return reportAvui(chatId);
  if (cmd === '/pendents') return reportPendents(chatId);
  if (cmd === '/buscar') {
    const q = args.join(' ').trim();
    if (!q) { await tgSendMessage(chatId, 'Ús: <code>/buscar text</code>'); return; }
    return reportBuscar(chatId, q);
  }
  if (cmd === '/nouclient' || cmd === '/oferta' || cmd === '/seguiment' || cmd === '/tasca' || cmd === '/venciment') {
    // Tractem com a text lliure però amb hint del tipus
    const hint = cmd.slice(1);
    const rest = args.join(' ').trim();
    if (!rest) { await tgSendMessage(chatId, `Ús: <code>${cmd} text amb les dades</code>`); return; }
    return handleFreeText(chatId, `#${hint} ${rest}`, msg);
  }

  await tgSendMessage(chatId, `Comanda desconeguda: <code>${escapeTgHtml(cmd)}</code>. Prem /help.`);
}

function helpText(chatId) {
  return [
    '<b>🤖 Brokkom CRM bot</b>',
    '',
    '<b>Comandes</b>',
    '• /avui — què tens avui (tasques, seguiments, venciments)',
    '• /pendents — totes les tasques pendents',
    '• /buscar TEXT — cerca a clients i ofertes',
    '• /nouclient TEXT — crea client a partir del text',
    '• /oferta TEXT — registra una oferta',
    '• /seguiment TEXT — registra un seguiment',
    '• /tasca TEXT — crea una tasca',
    '• /venciment TEXT — registra un venciment',
    '• /id — mostra aquest chat_id',
    '',
    '<b>Text lliure</b>',
    'Envia qualsevol text (notes, emails, transcripcions). La IA detecta entitats i les crea al CRM. Pots usar hashtags com #client, #oferta, #idea, #seguiment, #tasca, #venciment.',
    '',
    '<b>Fotos</b>',
    'Envia una foto (targeta de visita, pòlissa, captura). La IA llegirà el text i suggerirà què crear.',
    '',
    `Chat: <code>${chatId}</code>`,
  ].join('\n');
}

// ============================================================
// /avui, /pendents, /buscar
// ============================================================
async function reportAvui(chatId) {
  try {
    const mediador = await mediadorByChatId(chatId);
    const filter = mediador ? { mediador_id: mediador.id } : null;
    const [tasques, seguiments, venciments, ofertes] = await Promise.all([
      sbFetch('tasques', filter, q => q.eq('estat', 'pendent')),
      sbFetch('seguiments', filter),
      sbFetch('venciments', filter),
      sbFetch('ofertes', filter),
    ]);
    const today = startOfToday();
    const demà = addDays(today, 1);
    const tasquesAvui = tasques.filter(t => t.data_limit && new Date(t.data_limit) >= today && new Date(t.data_limit) < addDays(today, 2));
    const propers = (venciments || []).filter(v => v.data_venciment && new Date(v.data_venciment) >= today && new Date(v.data_venciment) <= addDays(today, 7));
    const ofertesEnviadesSenseSeg = (ofertes || []).filter(o => o.estat === 'Oferta enviada').filter(o => {
      const seg = (seguiments || []).filter(s => s.client_id === o.client_id).sort((a,b) => new Date(b.data||0) - new Date(a.data||0))[0];
      if (!seg) return true;
      const d = (Date.now() - new Date(seg.data)) / 86400000;
      return d > 5;
    });

    const lines = [`<b>📅 Avui — ${new Date().toLocaleDateString('ca-ES', {day:'numeric',month:'long'})}</b>`, ''];
    lines.push(`<b>✓ Tasques pendents avui/demà:</b> ${tasquesAvui.length}`);
    tasquesAvui.slice(0, 6).forEach(t => lines.push(`• ${escapeTgHtml(t.titol)}`));
    lines.push('');
    lines.push(`<b>📞 Ofertes a seguir:</b> ${ofertesEnviadesSenseSeg.length}`);
    ofertesEnviadesSenseSeg.slice(0, 6).forEach(o => lines.push(`• ${escapeTgHtml(o.empresa||'?')} (${escapeTgHtml(o.ram||'')})`));
    lines.push('');
    lines.push(`<b>📅 Venciments 7d:</b> ${propers.length}`);
    propers.slice(0, 6).forEach(v => lines.push(`• ${new Date(v.data_venciment).toLocaleDateString('ca-ES')} — ${escapeTgHtml(v.empresa||'?')}`));
    await tgSendMessage(chatId, lines.join('\n'));
  } catch (e) {
    await tgSendMessage(chatId, '⚠️ Error generant resum: ' + escapeTgHtml(e.message || String(e)));
  }
}

async function reportPendents(chatId) {
  try {
    const mediador = await mediadorByChatId(chatId);
    const filter = mediador ? { mediador_id: mediador.id } : null;
    const tasques = await sbFetch('tasques', filter, q => q.eq('estat', 'pendent'));
    if (!tasques.length) { await tgSendMessage(chatId, '✅ Cap tasca pendent!'); return; }
    const ord = { 'Alta': 3, 'Mitjana': 2, 'Baixa': 1 };
    tasques.sort((a,b) => (ord[b.prioritat]||0) - (ord[a.prioritat]||0));
    const lines = [`<b>✓ ${tasques.length} tasques pendents</b>`, ''];
    tasques.slice(0, 20).forEach(t => {
      const pri = t.prioritat ? `[${t.prioritat[0]}] ` : '';
      const dl = t.data_limit ? ` <i>(${new Date(t.data_limit).toLocaleDateString('ca-ES')})</i>` : '';
      lines.push(`• ${escapeTgHtml(pri)}${escapeTgHtml(t.titol||'?')}${dl}`);
    });
    if (tasques.length > 20) lines.push(`\n<i>… i ${tasques.length-20} més</i>`);
    await tgSendMessage(chatId, lines.join('\n'));
  } catch (e) {
    await tgSendMessage(chatId, '⚠️ ' + escapeTgHtml(e.message||String(e)));
  }
}

async function reportBuscar(chatId, q) {
  try {
    const lower = q.toLowerCase();
    const [clients, ofertes] = await Promise.all([
      sbFetch('clients'),
      sbFetch('ofertes'),
    ]);
    const cliMatch = clients.filter(c => [c.empresa,c.cif,c.contacte,c.email].some(v => v && String(v).toLowerCase().includes(lower))).slice(0, 8);
    const offMatch = ofertes.filter(o => [o.empresa,o.ram,o.notes].some(v => v && String(v).toLowerCase().includes(lower))).slice(0, 8);

    const lines = [`<b>🔎 Cerca: "${escapeTgHtml(q)}"</b>`, ''];
    lines.push(`<b>Clients (${cliMatch.length}):</b>`);
    if (!cliMatch.length) lines.push('— sense resultats');
    cliMatch.forEach(c => lines.push(`• ${escapeTgHtml(c.empresa||'?')} ${c.contacte?'· '+escapeTgHtml(c.contacte):''}`));
    lines.push('');
    lines.push(`<b>Ofertes (${offMatch.length}):</b>`);
    if (!offMatch.length) lines.push('— sense resultats');
    offMatch.forEach(o => lines.push(`• ${escapeTgHtml(o.empresa||'?')} · ${escapeTgHtml(o.ram||'')} (${escapeTgHtml(o.estat||'')})`));
    await tgSendMessage(chatId, lines.join('\n'));
  } catch (e) {
    await tgSendMessage(chatId, '⚠️ ' + escapeTgHtml(e.message||String(e)));
  }
}

// ============================================================
// Text lliure → IA extreu entitats i les crea
// ============================================================
async function handleFreeText(chatId, text, msg) {
  await tgSendMessage(chatId, '🤖 Processant amb IA…');
  let parsed;
  try {
    const raw = await callClaude({
      prompt: extractEntitiesPrompt(text),
      maxTokens: 2048,
    });
    parsed = extractJson(raw);
    if (!parsed) {
      await tgSendMessage(chatId, '🤔 No he pogut extreure entitats. Resposta IA en cru:\n\n' + escapeTgHtml(String(raw).slice(0, 500)));
      return;
    }
  } catch (e) {
    await tgSendMessage(chatId, '⚠️ IA error: ' + escapeTgHtml(e.message||String(e)));
    return;
  }

  await createEntitiesAndReport(chatId, parsed);
}

async function handlePhoto(chatId, msg) {
  await tgSendMessage(chatId, '📷 He rebut la foto. Llegint amb IA…');
  try {
    const photos = msg.photo || [];
    const largest = photos[photos.length - 1]; // Telegram ordena de més petita a més gran
    if (!largest?.file_id) throw new Error('foto sense file_id');
    const { buffer, mimeType, size } = await tgDownloadFile(largest.file_id);
    if (size > 4_500_000) {
      await tgSendMessage(chatId, '⚠️ Foto massa gran (>4.5MB), Telegram normalment la baixa més petita; intenta-ho de nou.');
      return;
    }
    const base64 = buffer.toString('base64');
    const caption = (msg.caption || '').trim();
    const raw = await callClaude({
      prompt: photoExtractPrompt(caption),
      imageBase64: base64,
      imageType: mimeType,
      maxTokens: 2048,
    });
    const parsed = extractJson(raw);
    if (!parsed) {
      await tgSendMessage(chatId, '🤔 No he pogut llegir la foto. Crua IA:\n\n' + escapeTgHtml(String(raw).slice(0, 500)));
      return;
    }
    await createEntitiesAndReport(chatId, parsed, { fromPhoto: true });
  } catch (e) {
    await tgSendMessage(chatId, '⚠️ Error processant foto: ' + escapeTgHtml(e.message||String(e)));
  }
}

// ============================================================
// Crea entitats al Supabase i informa per Telegram
// ============================================================
async function createEntitiesAndReport(chatId, parsed, opts = {}) {
  const mediador = await mediadorByChatId(chatId);
  const userId = await defaultOwnerUserId(mediador);
  const mediadorId = mediador?.id || null;

  const created = { clients: [], ofertes: [], venciments: [], oportunitats: [], seguiments: [], tasques: [], idees: [] };

  // Funció helper per inserir un registre amb metadades comunes.
  const insert = async (table, payload) => {
    try {
      const finalPayload = { ...payload };
      if (userId && !finalPayload.user_id) finalPayload.user_id = userId;
      if (mediadorId && !finalPayload.mediador_id) finalPayload.mediador_id = mediadorId;
      const { data, error } = await sbAdmin().from(table).insert(finalPayload).select().single();
      if (error) { console.warn(`[insert ${table}]`, error); return null; }
      return data;
    } catch (e) {
      console.warn(`[insert ${table}] threw`, e); return null;
    }
  };

  // Resolt clients existents per nom (case-insensitive) per evitar duplicats
  async function findOrCreateClient(empresaNom, extra = {}) {
    if (!empresaNom) return null;
    const { data: existing } = await sbAdmin()
      .from('clients').select('*').ilike('empresa', empresaNom).limit(1).maybeSingle();
    if (existing) return existing;
    const payload = { empresa: empresaNom, ...mapClient(extra) };
    return insert('clients', payload);
  }

  // CLIENTS
  for (const c of (parsed.clients || [])) {
    if (!c?.empresa) continue;
    const cli = await findOrCreateClient(c.empresa, c);
    if (cli) created.clients.push(cli);
  }

  // OFERTES (lligades a client per empresa)
  for (const o of (parsed.ofertes || [])) {
    if (!o?.empresa) continue;
    const cli = await findOrCreateClient(o.empresa);
    if (!cli) continue;
    const row = await insert('ofertes', {
      client_id: cli.id, empresa: cli.empresa,
      ram: o.ram || null,
      prima_actual: numOrNull(o.primaActual ?? o.prima_actual),
      prima_brokkom: numOrNull(o.primaBrokkom ?? o.prima_brokkom),
      asseguradora: o.asseguradora || null,
      asseguradora_actual: o.asseguradoraActual || o.asseguradora_actual || null,
      estat: o.estat || 'Lead',
      data_oferta: o.dataOferta || o.data_oferta || todayIso(),
      venciment: o.venciment || null,
      notes: o.notes || null,
    });
    if (row) created.ofertes.push(row);
  }

  // VENCIMENTS
  for (const v of (parsed.venciments || [])) {
    if (!v?.empresa || !(v.dataVenciment || v.data_venciment)) continue;
    const row = await insert('venciments', {
      empresa: v.empresa,
      ram: v.ram || null,
      asseguradora: v.asseguradora || null,
      data_venciment: v.dataVenciment || v.data_venciment,
      prima_actual: numOrNull(v.primaActual ?? v.prima_actual),
      notes: v.notes || null,
    });
    if (row) created.venciments.push(row);
  }

  // OPORTUNITATS
  for (const o of (parsed.oportunitats || [])) {
    if (!o?.empresa) continue;
    const cli = await findOrCreateClient(o.empresa);
    if (!cli) continue;
    const row = await insert('oportunitats', {
      client_id: cli.id, empresa: cli.empresa,
      producte: o.producte || null,
      argument: o.argument || null,
      prioritat: o.prioritat || 'Mitjana',
      estat: 'Detectada',
      data_deteccio: todayIso(),
    });
    if (row) created.oportunitats.push(row);
  }

  // SEGUIMENTS
  for (const s of (parsed.seguiments || [])) {
    if (!s?.empresa) continue;
    const cli = await findOrCreateClient(s.empresa);
    if (!cli) continue;
    const row = await insert('seguiments', {
      client_id: cli.id,
      data: s.data || todayIso(),
      canal: s.canal || 'Altres',
      resum: s.resum || s.text || null,
      proper_pas: s.properPas || s.proper_pas || null,
    });
    if (row) created.seguiments.push(row);
  }

  // TASQUES
  for (const t of (parsed.tasques || [])) {
    if (!t?.titol) continue;
    const row = await insert('tasques', {
      titol: t.titol,
      descripcio: t.descripcio || null,
      prioritat: t.prioritat || 'Mitjana',
      categoria: t.categoria || 'comercial',
      data_limit: t.dataLimit || t.data_limit || null,
      estat: 'pendent',
    });
    if (row) created.tasques.push(row);
  }

  // IDEES (taula notes amb tipus='idea')
  for (const i of (parsed.idees || [])) {
    if (!i?.titol && !i?.contingut) continue;
    const row = await insert('notes', {
      titol: i.titol || (i.contingut||'').slice(0, 60),
      contingut: i.contingut || '',
      tipus: 'idea',
      hashtags: [i.categoria || 'altres', 'Telegram'],
    });
    if (row) created.idees.push(row);
  }

  // Resum al xat
  const counts = Object.entries(created)
    .filter(([_, arr]) => arr.length > 0)
    .map(([k, arr]) => `${arr.length} ${k}`);
  const sum = parsed.resum ? '\n\n💬 ' + escapeTgHtml(parsed.resum) : '';
  if (counts.length === 0) {
    await tgSendMessage(chatId, '🤷 Cap entitat creada. Reenvia amb més detall si vols.' + sum);
    return;
  }
  const lines = [`✅ Creat al CRM: <b>${counts.join(' · ')}</b>`];
  if (created.clients.length) lines.push('🏢 ' + created.clients.map(c => escapeTgHtml(c.empresa)).join(', '));
  if (created.ofertes.length) lines.push('📄 ' + created.ofertes.map(o => `${escapeTgHtml(o.empresa)} · ${escapeTgHtml(o.ram||'')}`).join(', '));
  if (created.venciments.length) lines.push('📅 ' + created.venciments.map(v => `${escapeTgHtml(v.empresa)} (${new Date(v.data_venciment).toLocaleDateString('ca-ES')})`).join(', '));
  if (created.oportunitats.length) lines.push('💡 ' + created.oportunitats.map(o => `${escapeTgHtml(o.empresa)} — ${escapeTgHtml(o.producte||'')}`).join(', '));
  if (created.seguiments.length) lines.push('📞 ' + created.seguiments.map(s => `${created.clients.find(c=>c.id===s.client_id)?.empresa||'?'}`).join(', '));
  if (created.tasques.length) lines.push('✓ ' + created.tasques.map(t => escapeTgHtml(t.titol)).join(', '));
  if (created.idees.length) lines.push('💭 ' + created.idees.map(i => escapeTgHtml(i.titol)).join(', '));
  if (parsed.alertes && parsed.alertes.length) {
    lines.push('');
    lines.push('⚠️ ' + parsed.alertes.map(a => escapeTgHtml(a)).join(' · '));
  }
  lines.push(sum);
  await tgSendMessage(chatId, lines.join('\n'));
}

// ============================================================
// Prompts IA
// ============================================================
function extractEntitiesPrompt(text) {
  return `Ets l'assistent del CRM de Brokkom Correduria de Seguros (sector transport). L'usuari t'envia text per Telegram. Analitza'l i extreu entitats estructurades.

Retorna NOMÉS un JSON amb aquesta forma exacta (omet camps si no apareixen):
{
  "clients": [{"empresa":"","cif":"","contacte":"","carrec":"","email":"","telefon":"","sector":"","facturacio":"","treballadors":"","adreca":"","notes":""}],
  "ofertes": [{"empresa":"","ram":"","primaActual":0,"primaBrokkom":0,"asseguradora":"","estat":"Lead|Qualificat|Cotitzant|Oferta enviada|En negociació","venciment":"YYYY-MM-DD","notes":""}],
  "venciments": [{"empresa":"","ram":"","dataVenciment":"YYYY-MM-DD","primaActual":0,"asseguradora":""}],
  "oportunitats": [{"empresa":"","producte":"","argument":"","prioritat":"Alta|Mitjana|Baixa"}],
  "seguiments": [{"empresa":"","data":"YYYY-MM-DD","canal":"Email|Telèfon|Reunió|WhatsApp","resum":"","properPas":""}],
  "tasques": [{"titol":"","descripcio":"","prioritat":"Alta|Mitjana|Baixa","categoria":"comercial|comunicacio|admin|seguiment","dataLimit":"YYYY-MM-DD"}],
  "idees": [{"titol":"","contingut":"","categoria":"linkedin|comercial|producte|proces|altres"}],
  "resum": "frase breu",
  "alertes": []
}

Regles:
- Si veus #client / #oferta / #seguiment / #idea / #tasca / #venciment, prioritza aquell tipus.
- Si veus convenis col·lectius, marca oportunitat RC Patronal/accidents (Alta).
- Si veus flota, marca oportunitat ciber+telemàtica.
- Si l'estalvi supera el 30%, posa-ho a alertes.
- No inventis dades. Si una camp no apareix, deixa'l buit o omet.
- Números sense € ni separadors de milers, punt decimal.

TEXT:
${text}

JSON:`;
}

function photoExtractPrompt(caption) {
  return `Aquesta imatge ha arribat per Telegram al CRM de Brokkom Correduria de Seguros (sector transport). ${caption ? 'Caption: ' + caption : ''}

Llegeix-la i retorna NOMÉS un JSON amb aquesta forma exacta (omet camps buits):
{
  "tipus_document": "targeta_visita|polissa|nota_manuscrita|factura|email_imprès|altre",
  "clients": [{"empresa":"","contacte":"","carrec":"","email":"","telefon":"","adreca":""}],
  "ofertes": [{"empresa":"","ram":"","primaActual":0,"asseguradora":""}],
  "venciments": [{"empresa":"","ram":"","dataVenciment":"YYYY-MM-DD","primaActual":0,"asseguradora":""}],
  "resum": "què és la imatge en una frase",
  "alertes": []
}

Si la foto sembla una targeta de visita, omple 'clients' amb les dades llegibles. Si és una pòlissa, omple 'venciments' amb data i prima. No inventis dades.`;
}

// ============================================================
// Utilitats
// ============================================================
async function sbFetch(table, eqFilter, queryFn) {
  let q = sbAdmin().from(table).select('*');
  if (eqFilter) {
    for (const [k, v] of Object.entries(eqFilter)) q = q.eq(k, v);
  }
  if (queryFn) q = queryFn(q);
  const r = await q;
  if (r.error) { console.warn(`[fetch ${table}]`, r.error); return []; }
  return r.data || [];
}

function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function todayIso() { return new Date().toISOString().slice(0,10); }
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).replace(/[€\s]/g,'').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function mapClient(c) {
  return {
    cif: c.cif || null,
    sector: c.sector || null,
    contacte: c.contacte || null,
    carrec: c.carrec || null,
    email: c.email || null,
    telefon: c.telefon || null,
    adreca: c.adreca || null,
    facturacio: c.facturacio || null,
    treballadors: c.treballadors || null,
    notes: c.notes || null,
  };
}
