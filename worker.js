// 0xBridge CF Worker — HTTP -> Nostr WebSocket bridge.
// Telegram Serverless can only do outbound HTTP, so this Worker:
//   POST /publish  { event }  -> sends EVENT to relays over WS, returns ack
//   GET  /query?pubkey=HEX&limit=N -> subscribes, collects notes, returns JSON
// Deploy: `wrangler deploy` (free tier). Set RELAYS env or use defaults.

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
];

function wsPublish(event, relays) {
  return Promise.allSettled(relays.map(r => new Promise((resolve) => {
    const ws = new WebSocket(r);
    let done = false;
    const finish = (ok, info) => { if (!done) { done = true; try { ws.close(); } catch {} resolve({ relay: r, ok, info }); } };
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify(['EVENT', event]));
      // wait for OK message
      setTimeout(() => finish(true, 'sent'), 1500);
    });
    ws.addEventListener('message', (e) => {
      try { const m = JSON.parse(e.data); if (m[0] === 'OK') finish(m[2] !== false, m[1]); } catch {}
    });
    ws.addEventListener('error', () => finish(false, 'ws-error'));
    setTimeout(() => finish(false, 'timeout'), 4000);
  })));
}

function wsQuery(pubkey, limit, relays) {
  return new Promise((resolve) => {
    const collected = [];
    let open = 0;
    const conns = [];
    const finishAll = () => {
      conns.forEach(c => { try { c.close(); } catch {} });
      resolve(collected.slice(0, limit));
    };
    relays.forEach(r => {
      const ws = new WebSocket(r);
      conns.push(ws); open++;
      const subId = '0xbridge_' + Math.random().toString(36).slice(2);
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify(['REQ', subId, { authors: [pubkey], limit, kinds: [1] }]));
      });
      ws.addEventListener('message', (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m[0] === 'EVENT') collected.push(m[2]);
          if (m[0] === 'EOSE') { try { ws.send(JSON.stringify(['CLOSE', subId])); } catch {} }
        } catch {}
      });
      ws.addEventListener('error', () => {});
    });
    setTimeout(finishAll, 3500);
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/publish') {
      const event = await request.json();
      if (!event || !event.id || !event.sig) return new Response('bad event', { status: 400 });
      const results = await wsPublish(event, env.RELAYS ? env.RELAYS.split(',') : RELAYS);
      return new Response(JSON.stringify({ ok: results.some(r => r.status === 'fulfilled' && r.value.ok), results }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (request.method === 'GET' && url.pathname === '/query') {
      const pubkey = url.searchParams.get('pubkey') || url.searchParams.get('pub');
      const limit = parseInt(url.searchParams.get('limit') || '10', 10);
      if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) return new Response('bad pubkey', { status: 400 });
      const notes = await wsQuery(pubkey, limit, env.RELAYS ? env.RELAYS.split(',') : RELAYS);
      return new Response(JSON.stringify(notes), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('0xBridge Worker. POST /publish, GET /query?pubkey=HEX', { status: 200 });
  },
};
