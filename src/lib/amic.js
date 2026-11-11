// Amic invisible — lògica compartida entre la pàgina de qui organitza (/)
// i la pàgina que obre cada participant (/veure/).
//
// No hi ha servidor ni base de dades: cada enllaç porta a dins, codificat al
// fragment (#...) de l'URL, el nom de qui l'obre i a qui li ha de fer el
// regal. El navegador no envia mai el fragment al servidor, així que el
// resultat no queda registrat enlloc. La codificació només serveix perquè el
// resultat no es pugui llegir "a simple vista" al missatge de WhatsApp o a la
// barra d'adreces; no és un xifratge fort.

const KEY = 'amic-invisible';

function xor(bytes) {
  const k = new TextEncoder().encode(KEY);
  return bytes.map((b, i) => b ^ k[i % k.length]);
}

function toBase64Url(bytes) {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** payload: { e: esdeveniment, n: nom, g: a qui fa el regal, b: pressupost, d: data, m: missatge } */
export function encodePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return toBase64Url(xor(bytes));
}

export function decodePayload(token) {
  try {
    const bytes = xor(fromBase64Url(token));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return data && typeof data.n === 'string' && typeof data.g === 'string' ? data : null;
  } catch {
    return null;
  }
}

function randomInt(max) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sorteja qui fa el regal a qui. Ningú no es fa el regal a si mateix i es
 * respecten les exclusions (parelles que no es poden tocar, en tots dos
 * sentits). Retorna un Map nom -> nom, o null si és impossible.
 *
 * names: string[]
 * exclusions: Array<[string, string]>
 */
export function draw(names, exclusions = []) {
  const forbidden = new Set();
  for (const [a, b] of exclusions) {
    forbidden.add(`${a}\u0000${b}`);
    forbidden.add(`${b}\u0000${a}`);
  }
  const ok = (giver, receiver) => giver !== receiver && !forbidden.has(`${giver}\u0000${receiver}`);

  // Amb pocs participants, barrejar i comprovar és ràpid i dona una
  // distribució uniforme entre tots els sortejos vàlids.
  for (let attempt = 0; attempt < 5000; attempt++) {
    const receivers = shuffle(names);
    if (names.every((giver, i) => ok(giver, receivers[i]))) {
      return new Map(names.map((giver, i) => [giver, receivers[i]]));
    }
  }

  // Si les exclusions són molt restrictives, cerca exhaustiva
  // (backtracking) en ordre aleatori.
  const order = shuffle(names);
  const used = new Set();
  const result = new Map();
  const solve = (i) => {
    if (i === order.length) return true;
    const giver = order[i];
    for (const receiver of shuffle(names)) {
      if (used.has(receiver) || !ok(giver, receiver)) continue;
      used.add(receiver);
      result.set(giver, receiver);
      if (solve(i + 1)) return true;
      used.delete(receiver);
      result.delete(giver);
    }
    return false;
  };
  return solve(0) ? result : null;
}

/** Deixa només dígits i afegeix el prefix d'Espanya als mòbils de 9 xifres. */
export function normalizePhone(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  digits = digits.replace(/\D/g, '');
  if (/^[67]\d{8}$/.test(digits)) digits = '34' + digits;
  return digits;
}

export function whatsappUrl(phone, text) {
  const p = normalizePhone(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}
