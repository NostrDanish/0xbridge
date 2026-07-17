import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { users, notes } from 'schema';
import { genKeypair, pubToNpub } from 'lib/keys.js';
import { signEvent, publishEvent, queryNotes } from 'lib/nostr.js';

const BRIDGE_EMOJI = '🌉';
const MINIAPP_URL = 'https://your-miniapp-host.example/'; // <-- host the miniapp/index.html somewhere (CF Pages, IPFS, etc.)

async function ensureUser(tgId) {
  const [u] = await db.select().from(users).where(eq(users.tgId, tgId)).run();
  if (u) return u;
  const { priv, pub } = genKeypair();
  const npub = pubToNpub(pub);
  const [nu] = await db.insert(users).values({ tgId, nostrPriv: priv, nostrPub: pub, npub }).returning().run();
  return nu;
}

export default async function (message) {
  const tgId = message.chat.id;
  const text = (message.text || '').trim();
  if (!text.startsWith('/')) return; // ignore non-commands

  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(' ');

  if (cmd === '/start' || cmd === '/help') {
    return api.sendMessage({
      chat_id: tgId,
      text:
`${BRIDGE_EMOJI} 0xBridge — your Telegram ⇄ Nostr super-power.
Commands:
/whoami  — show your Nostr identity (npub)
/post <text> — publish to Nostr, mirrored here
/feed [n] — latest notes from your Nostr identity
/app — open the 0xBridge Mini App
/mirror — link this chat message to a Nostr event
Your keys live only in this bot's DB. Nothing leaves except signed events.`,
    });
  }

  if (cmd === '/whoami') {
    const u = await ensureUser(tgId);
    return api.sendMessage({ chat_id: tgId, text: `🔑 Your Nostr identity:\n\`${u.npub}\``, parse_mode: 'Markdown' });
  }

  if (cmd === '/app') {
    const u = await ensureUser(tgId);
    const url = MINIAPP_URL + '?pub=' + u.nostrPub;
    return api.sendMessage({
      chat_id: tgId,
      text: BRIDGE_EMOJI + ' Open your Nostr Mini App:',
      reply_markup: { inline_keyboard: [[{ text: '🌉 Open 0xBridge', web_app: { url } }]] },
    });
  }

  if (cmd === '/post') {
    if (!arg) return api.sendMessage({ chat_id: tgId, text: 'Usage: /post <your message>' });
    const u = await ensureUser(tgId);
    const evt = await signEvent(u.nostrPriv, u.nostrPub, 1, arg, [['client', '0xBridge']]);
    const result = await publishEvent(evt);
    const [note] = await db.insert(notes).values({
      tgId, content: arg, nostrEventId: evt.id,
      status: result.ok ? 'published' : 'failed',
    }).returning().run();
    return api.sendMessage({
      chat_id: tgId,
      text: result.ok
        ? `${BRIDGE_EMOJI} Published to Nostr!\nEvent: \`${evt.id}\`\nnpub: ${u.npub}`
        : `${BRIDGE_EMOJI}⚠️ Publish failed (bridge error). Saved locally.`,
      parse_mode: 'Markdown',
    });
  }

  if (cmd === '/feed') {
    const u = await ensureUser(tgId);
    const limit = Math.min(parseInt(arg, 10) || 5, 20);
    const feed = await queryNotes(u.nostrPub, limit);
    if (!feed.length) return api.sendMessage({ chat_id: tgId, text: 'No notes found on relays yet.' });
    const lines = feed.slice(0, limit).map((n, i) => `${i + 1}. ${n.content}`).join('\n\n');
    return api.sendMessage({ chat_id: tgId, text: `${BRIDGE_EMOJI} Your Nostr feed:\n\n${lines}` });
  }

  if (cmd === '/mirror') {
    const u = await ensureUser(tgId);
    const evt = await signEvent(u.nostrPriv, u.nostrPub, 1,
      `Mirror of TG chat ${tgId}: ${arg || '(see thread)'}`, [['t', 'telegram'], ['client', '0xBridge']]);
    const result = await publishEvent(evt);
    return api.sendMessage({
      chat_id: tgId,
      text: result.ok
        ? `${BRIDGE_EMOJI} Mirrored to Nostr: \`${evt.id}\``
        : `${BRIDGE_EMOJI}⚠️ Mirror failed (bridge error).`,
      parse_mode: 'Markdown',
    });
  }
}
