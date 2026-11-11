// Obre un enllaç curt (/r/<codi>): busca el token guardat i redirigeix a la
// pàgina del regal. Si no existeix o ha caducat, la pàgina ho explica.

import { CODE_RE, store } from '../lib/enllacos-curts.mjs';

const redirect = (url) =>
  new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });

export default async (req, context) => {
  const origin = new URL(req.url).origin;
  const code = context.params?.code ?? '';
  if (!CODE_RE.test(code)) return redirect(`${origin}/veure/#caducat`);

  try {
    const blobs = store();
    const entry = await blobs.getWithMetadata(code, { type: 'json' });
    if (!entry?.data?.t) return redirect(`${origin}/veure/#caducat`);
    if (typeof entry.metadata?.exp === 'number' && entry.metadata.exp < Date.now()) {
      await blobs.delete(code);
      return redirect(`${origin}/veure/#caducat`);
    }
    return redirect(`${origin}/veure/#${entry.data.t}`);
  } catch (err) {
    console.error("Error en obrir l'enllaç curt", err);
    return new Response("No s'ha pogut obrir l'enllaç. Torna-ho a provar d'aquí a una estona.", {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
};

export const config = {
  path: '/r/:code',
};
