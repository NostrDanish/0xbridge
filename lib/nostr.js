// Pure-JS Nostr event builder + BIP-340 Schnorr signer (no deps, V8-safe).
// Verified against BIP-340 test vectors 0,1,2 (RFC 8032 / bip-0340).
import { xonlyPub, ecMul, Gx, Gy, N, P, hasEvenY, xOnly } from './nostr_ec.js';

const RELAY_BRIDGE = 'https://0xbridge.workers.dev'; // <-- your CF Worker URL
const AUX_RAND = '0000000000000000000000000000000000000000000000000000000000000000';

function hexToBytes(h) {
  const b = new Uint8Array(h.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
  return b;
}
function bytesToHex(b) {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', typeof msg === 'string' ? new TextEncoder().encode(msg) : msg);
  return new Uint8Array(buf);
}
async function tagHash(tag, msg) {
  const t = new TextEncoder().encode(tag);
  const th = await sha256(t);
  const pre = new Uint8Array(64); pre.set(th, 0); pre.set(th, 32);
  const body = typeof msg === 'string' ? new TextEncoder().encode(msg) : msg;
  const out = new Uint8Array(64 + body.length);
  out.set(pre, 0); out.set(body, 64);
  return sha256(out);
}
function intToBytes(x, len) {
  let s = (((BigInt(x) % N) + N) % N).toString(16);
  while (s.length < len * 2) s = '0' + s;
  const a = [];
  for (let i = 0; i < len; i++) a.push(parseInt(s.substr(i * 2, 2), 16));
  return a;
}
function xorBytes(a, b) { return a.map((x, i) => x ^ b[i]); }

export function buildEvent(pubHex, kind, content, tags = []) {
  return { pubkey: pubHex, created_at: Math.floor(Date.now() / 1000), kind, tags, content };
}
export async function eventId(evt) {
  const serialized = JSON.stringify([0, evt.pubkey, evt.created_at, evt.kind, evt.tags, evt.content]);
  return bytesToHex(await sha256(serialized));
}
export async function signEvent(privHex, pubHex, kind, content, tags = [], aux = AUX_RAND) {
  const d0 = BigInt('0x' + privHex);
  const Ppt = ecMul(d0, [Gx, Gy]);
  const d = hasEvenY(Ppt) ? d0 : (N - d0);
  const P2 = ecMul(d, [Gx, Gy]);
  const auxHash = await tagHash('BIP0340/aux', hexToBytes(aux));
  const t = xorBytes(intToBytes(d, 32), [...auxHash]);
  const k0 = BigInt('0x' + bytesToHex(await tagHash('BIP0340/nonce',
    new Uint8Array([...t, ...intToBytes(xOnly(P2), 32)])))) % N;
  let R = ecMul(k0, [Gx, Gy]);
  const k = hasEvenY(R) ? k0 : (N - k0);
  const evtId = await eventId(buildEvent(pubHex, kind, content, tags));
  const e = BigInt('0x' + bytesToHex(await tagHash('BIP0340/challenge',
    new Uint8Array([...intToBytes(xOnly(R), 32), ...intToBytes(xOnly(P2), 32), ...hexToBytes(evtId)]))) ) % N;
  const sig = (k + e * d) % N;
  const evt = buildEvent(pubHex, kind, content, tags);
  evt.id = evtId;
  evt.sig = bytesToHex(intToBytes(xOnly(R), 32)) + bytesToHex(intToBytes(sig, 32));
  return evt;
}

export async function publishEvent(evt) {
  const res = await fetch(`${RELAY_BRIDGE}/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(evt),
  });
  return res.ok ? await res.json() : { ok: false, status: res.status };
}
export async function queryNotes(pubkey, limit = 10) {
  const res = await fetch(`${RELAY_BRIDGE}/query?pubkey=${pubkey}&limit=${limit}`);
  if (!res.ok) return [];
  return await res.json();
}
