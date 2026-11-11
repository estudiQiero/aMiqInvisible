// Enllaços curts propis: /r/<codi> en lloc de /veure/#<token llarg>.
//
// Cada codi es guarda a Netlify Blobs (magatzem "enllacos") amb el token
// llarg de la persona. A les metadades hi ha `exp`: el moment a partir del
// qual l'enllaç caduca i s'esborra (2 mesos després de la data de
// l'intercanvi, o de la data del sorteig si no se n'ha posat).

import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'enllacos';
export const CODE_RE = /^[a-km-zA-HJ-NP-Z2-9]{7}$/;
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_EXTRA_MONTHS = 14; // per si algú posa una data de l'intercanvi molt llunyana

export const store = () => getStore({ name: STORE_NAME, consistency: 'strong' });

export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

/** Caducitat: 2 mesos després de l'intercanvi (o d'avui), amb un màxim raonable. */
export function expiryFor(exchangeDate, now = new Date()) {
  let base = now;
  if (/^\d{4}-\d{2}-\d{2}$/.test(exchangeDate || '')) {
    const d = new Date(`${exchangeDate}T23:59:59Z`);
    if (!isNaN(d) && d > now) base = d;
  }
  const exp = addMonths(base, 2);
  const max = addMonths(now, MAX_EXTRA_MONTHS);
  return (exp > max ? max : exp).getTime();
}
