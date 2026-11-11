// Envia per correu (amb Resend) l'enllaç secret d'un participant.
//
// Variables d'entorn que cal configurar a Netlify
// (Project configuration → Environment variables):
//   RESEND_API_KEY  la clau de l'API de Resend (marca-la com a secreta)
//   MAIL_FROM       el remitent, d'un domini verificat a Resend.
//                   Exemple: Amic invisible <nocontestar@laperallimonera.cat>
//   MAIL_REPLY_TO   (opcional) adreça on arriben les respostes, si se'n vol.
//
// Per evitar que algú faci servir aquesta funció per enviar correu brossa:
// - el text del correu és fix; només hi canvien el nom, l'event, el
//   pressupost, la data, el missatge (sense enllaços) i l'enllaç secret;
// - l'enllaç ha de ser d'aquesta mateixa web (/r/<codi> o /veure/#...);
// - un sol destinatari per petició i límits de llargada a tots els camps;
// - Netlify limita les peticions per IP (vegeu `config` al final).
// A més, el pla gratuït de Resend ja talla a 100 correus al dia.

import { isEmail, isNadal } from '../../src/lib/amic.js';
import { CODE_RE } from '../lib/enllacos-curts.mjs';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Treu salts de línia i caràcters de control (no han d'arribar a l'assumpte).
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Mètode no permès.' });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) {
    console.error('Falten les variables RESEND_API_KEY o MAIL_FROM');
    return json(500, { error: "L'enviament per correu encara no està configurat." });
  }

  const origin = new URL(req.url).origin;
  // Només acceptem peticions fetes des d'aquesta mateixa web.
  const reqOrigin = req.headers.get('origin');
  if (reqOrigin && reqOrigin !== origin) return json(403, { error: 'Origen no permès.' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Petició no vàlida.' });
  }

  const to = clean(body.to, 120);
  const name = clean(body.name, 40);
  const event = clean(body.event, 60);
  const link = String(body.link ?? '');
  const budget = clean(body.budget, 20);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? '')) ? String(body.date) : '';
  let msg = clean(body.msg, 200);
  // El missatge el pot escriure qualsevol: si porta enllaços no l'incloem,
  // perquè ningú no pugui fer servir la funció per enviar enllaços de brossa.
  if (/https?:|www\.|[a-z0-9-]+\.(com|net|org|es|cat|io|ly|me|info|xyz)\b/i.test(msg)) msg = '';

  if (!isEmail(to)) return json(400, { error: 'El correu no sembla vàlid.' });
  if (!name) return json(400, { error: 'Falta el nom.' });
  const shortPrefix = `${origin}/r/`;
  const shortLink = link.startsWith(shortPrefix) && CODE_RE.test(link.slice(shortPrefix.length));
  const longLink = link.startsWith(`${origin}/veure/#`) && link.length <= 1500 && !/\s/.test(link);
  if (!shortLink && !longLink) {
    return json(400, { error: 'Enllaç no vàlid.' });
  }

  const nadal = isNadal(event);
  const color = nadal ? '#C62828' : '#7C3AED';
  const subject = event ? `El teu amic invisible: ${event}` : 'El teu amic invisible';

  let dateText = '';
  if (date) {
    const d = new Date(`${date}T12:00:00Z`);
    if (!isNaN(d)) {
      dateText = d.toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    }
  }
  const details = [
    budget && ['Pressupost', budget],
    dateText && ["Data de l'intercanvi", dateText],
  ].filter(Boolean);
  const siteName = new URL(origin).hostname;

  const text =
    `Hola, ${name}!\n\n` +
    `Ja tenim el sorteig de l'amic invisible${event ? ` «${event}»` : ''}.\n\n` +
    `Obre el teu enllaç secret per descobrir a qui li has de fer el regal. No l'ensenyis a ningú: és només per a tu.\n${link}\n\n` +
    details.map(([k, v]) => `${k}: ${v}\n`).join('') +
    (msg ? `\nMissatge de qui organitza: «${msg}»\n` : '') +
    `\n—\nHas rebut aquest correu perquè algú t'ha apuntat a un sorteig d'amic invisible a ${siteName}. ` +
    `És un enviament únic: no et tornarem a escriure i no cal que responguis.\n`;

  const html = `<!doctype html>
<html lang="ca"><body style="margin:0;padding:24px;background:#FFF9F2;font-family:Arial,Helvetica,sans-serif;color:#2B2140">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;text-align:center;border:1px solid #EEE4F3">
    <div style="font-size:48px;line-height:1">${nadal ? '🎄🎁' : '🎁'}</div>
    <h1 style="color:${color};font-size:26px;margin:12px 0 8px">Hola, ${escapeHtml(name)}!</h1>
    <p style="font-size:16px;line-height:1.5;margin:0 0 20px">
      Ja tenim el sorteig de l'amic invisible${event ? ` <strong>«${escapeHtml(event)}»</strong>` : ''}.<br>
      Obre el teu enllaç secret per descobrir a qui li has de fer el regal.
    </p>
    <a href="${escapeHtml(link)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:999px;font-size:16px">
      Descobreix a qui li fas el regal
    </a>
    <p style="font-size:13px;color:#6E6584;margin:16px 0 0">No l'ensenyis a ningú: és només per a tu 🤫</p>
    ${details.length ? `<table role="presentation" style="margin:20px auto 0;border-collapse:collapse;font-size:15px">${details
      .map(([k, v]) => `<tr><td style="padding:4px 10px;color:#6E6584;text-align:right">${k}</td><td style="padding:4px 10px;font-weight:bold;text-align:left">${escapeHtml(v)}</td></tr>`)
      .join('')}</table>` : ''}
    ${msg ? `<p style="font-size:15px;font-style:italic;margin:18px 0 0;padding:12px 16px;border:1px dashed #EEE4F3;border-radius:12px">«${escapeHtml(msg)}»</p>` : ''}
  </div>
  <p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#8A8299;text-align:center">
    Has rebut aquest correu perquè algú t'ha apuntat a un sorteig d'amic invisible a ${escapeHtml(siteName)}.
    És un enviament únic: no et tornarem a escriure i no cal que responguis.
  </p>
</body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
        ...(process.env.MAIL_REPLY_TO ? { reply_to: process.env.MAIL_REPLY_TO } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('Resend ha retornat un error', res.status, detail);
      if (res.status === 429) {
        return json(429, { error: "S'ha arribat al límit d'enviaments. Prova-ho més tard o envia-ho per WhatsApp." });
      }
      return json(502, { error: "No s'ha pogut enviar el correu. Torna-ho a provar." });
    }
    return json(200, { ok: true });
  } catch (err) {
    console.error('Error en connectar amb Resend', err);
    return json(502, { error: "No s'ha pogut enviar el correu. Torna-ho a provar." });
  }
};

export const config = {
  path: '/api/enviar-correu',
  // Com a màxim 60 correus per minut des de la mateixa IP (n'hi ha prou per
  // enviar tots els correus d'un sorteig gran amb el botó "Envia'ls tots").
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
