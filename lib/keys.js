// Per-user Nostr identity: generate keypair + derive npub (bech32).
import { xonlyPub } from './nostr_ec.js';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const CHARSET_REV = {};
for (let i = 0; i < CHARSET.length; i++) CHARSET_REV[CHARSET[i]] = i;

function bech32Encode(hrp, data5bit) {
  let res = hrp + '1';
  for (const v of data5bit) res += CHARSET[v];
  const hrpBytes = [];
  for (const c of hrp) hrpBytes.push(c.charCodeAt(0) >> 5, c.charCodeAt(0) & 31);
  const data = [...hrpBytes, 0, ...data5bit];
  let poly = 1;
  for (const v of data) {
    poly ^= v;
    for (let i = 0; i < 5; i++) poly = ((poly << 1) ^ ((poly >> 4) * 0x25)) & 0x3f;
  }
  poly ^= 1;
  for (let i = 0; i < 6; i++) res += CHARSET[(poly >> (5 * (5 - i))) & 31];
  return res;
}
function bech32ChecksumVal(hrp, data) {
  const hrpBytes = [];
  for (const c of hrp) hrpBytes.push(c.charCodeAt(0) >> 5, c.charCodeAt(0) & 31);
  const all = [...hrpBytes, 0, ...data];
  let poly = 1;
  for (const v of all) {
    poly ^= v;
    for (let i = 0; i < 5; i++) poly = ((poly << 1) ^ ((poly >> 4) * 0x25)) & 0x3f;
  }
  return poly;
}
function bytesToGroups(bytes) {
  const groups = []; let acc = 0, bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b; bits += 8;
    while (bits >= 5) { bits -= 5; groups.push((acc >> bits) & 31); }
  }
  if (bits > 0) groups.push((acc << (5 - bits)) & 31);
  return groups;
}

export function genKeypair() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const priv = Array.from(arr).map(x => x.toString(16).padStart(2, '0')).join('');
  const pub = xonlyPub(priv);
  return { priv, pub };
}
export function pubToNpub(pubHex) {
  const pb = new Uint8Array(32);
  for (let i = 0; i < 32; i++) pb[i] = parseInt(pubHex.substr(i * 2, 2), 16);
  return bech32Encode('npub', bytesToGroups(pb));
}
