// Minimal secp256k1 EC math for Schnorr (BIP-340) signing + x-only pubkeys.
// Pure BigInt, no deps. Runs in the Telegram V8 isolate.
export const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
export const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
export const Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
export const Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

function modInv(a, m) {
  let [old_r, r] = [a % m, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}
export function ecAdd(p, q) {
  if (p === null) return q;
  if (q === null) return p;
  const [x1, y1] = p, [x2, y2] = q;
  if (x1 === x2 && (y1 + y2) % P === 0n) return null;
  let m;
  if (x1 === x2) m = ((3n * x1 * x1) % P) * modInv((2n * y1) % P, P) % P;
  else m = (((y2 - y1) % P + P) % P) * modInv(((x2 - x1) % P + P) % P, P) % P;
  m = (m + P) % P;
  const x3 = ((m * m - x1 - x2) % P + P) % P;
  const y3 = ((m * ((x1 - x3) % P + P) % P - y1) % P + P) % P;
  return [x3, y3];
}
export function ecMul(k, p) {
  let r = null, addend = p;
  while (k > 0n) {
    if (k & 1n) r = ecAdd(r, addend);
    addend = ecAdd(addend, addend);
    k >>= 1n;
  }
  return r;
}
// x-only pubkey hex (32 bytes) from privkey hex
export function xonlyPub(privHex) {
  const d = BigInt('0x' + privHex);
  const [x, y] = ecMul(d, [Gx, Gy]);
  return x.toString(16).padStart(64, '0');
}

// x-only helpers (needed by nostr.js signing)
export function hasEvenY(p) { return (p[1] & 1n) === 0n; }
export function xOnly(p) { return p[0]; }
