// S'executa sola cada dia i esborra els enllaços curts que ja han caducat
// (2 mesos després de l'intercanvi), perquè no s'acumulin dades personals.

import { store } from '../lib/enllacos-curts.mjs';

export default async () => {
  const blobs = store();
  const now = Date.now();
  let deleted = 0;
  let kept = 0;
  for await (const page of blobs.list({ paginate: true })) {
    for (const { key } of page.blobs) {
      const meta = await blobs.getMetadata(key);
      const exp = meta?.metadata?.exp;
      if (typeof exp !== 'number' || exp < now) {
        await blobs.delete(key);
        deleted++;
      } else {
        kept++;
      }
    }
  }
  console.log(`Neteja d'enllaços: ${deleted} esborrats, ${kept} encara vigents`);
};

export const config = {
  schedule: '@daily',
};
