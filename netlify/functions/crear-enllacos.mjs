// Crea els enllaços curts d'un sorteig. Rep els tokens llargs de tots els
// participants i retorna un codi curt per a cadascun, en el mateix ordre.
//
// Per evitar abusos: només s'accepten tokens vàlids d'aquesta app, com a
// màxim 60 per petició, i Netlify limita les peticions per IP.

import { decodePayload } from '../../src/lib/amic.js';
import { expiryFor, newCode, store } from '../lib/enllacos-curts.mjs';

const MAX_LINKS = 60;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Mètode no permès.' });

  const origin = new URL(req.url).origin;
  const reqOrigin = req.headers.get('origin');
  if (reqOrigin && reqOrigin !== origin) return json(403, { error: 'Origen no permès.' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Petició no vàlida.' });
  }

  const tokens = body?.tokens;
  if (!Array.isArray(tokens) || tokens.length === 0 || tokens.length > MAX_LINKS) {
    return json(400, { error: 'Petició no vàlida.' });
  }
  const payloads = tokens.map((t) => (typeof t === 'string' && t.length <= 1500 ? decodePayload(t) : null));
  if (payloads.some((p) => !p)) return json(400, { error: 'Algun enllaç no és vàlid.' });

  try {
    const blobs = store();
    const codes = [];
    for (let i = 0; i < tokens.length; i++) {
      const metadata = { exp: expiryFor(payloads[i].d) };
      // Si per casualitat el codi ja existeix, en provem un altre.
      for (let attempt = 0; ; attempt++) {
        const code = newCode();
        const { modified } = await blobs.setJSON(code, { t: tokens[i] }, { metadata, onlyIfNew: true });
        if (modified) { codes.push(code); break; }
        if (attempt > 5) throw new Error('No s\'ha pogut generar un codi únic');
      }
    }
    return json(200, { codes });
  } catch (err) {
    console.error('Error en crear els enllaços curts', err);
    return json(500, { error: "No s'han pogut crear els enllaços curts." });
  }
};

export const config = {
  path: '/api/enllacos',
  // Cada sorteig fa una sola petició; 10 per minut és més que suficient.
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
