import { api, db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { users, notes } from 'schema';
import { signEvent, publishEvent } from 'lib/nostr.js';

// Inline buttons from the Mini App / bot menu route here.
export default async function (callbackQuery) {
  const tgId = callbackQuery.from.id;
  const data = callbackQuery.data || '';
  await api.answerCallbackQuery({ callback_query_id: callbackQuery.id });

  if (data === 'post_last') {
    const [u] = await db.select().from(users).where(eq(users.tgId, tgId)).run();
    const [last] = await db.select().from(notes).where(eq(notes.tgId, tgId)).orderBy(desc(notes.id)).limit(1).run();
    if (!u || !last) return api.sendMessage({ chat_id: tgId, text: 'No notes yet. Use /post first.' });
    const evt = await signEvent(u.nostrPriv, u.nostrPub, 1, last.content, [['client', '0xBridge']]);
    const res = await publishEvent(evt);
    return api.sendMessage({ chat_id: tgId, text: res.ok ? `🌉 Re-published: ${evt.id}` : '🌉⚠️ Failed.' });
  }
  if (data === 'show_npub') {
    const [u] = await db.select().from(users).where(eq(users.tgId, tgId)).run();
    return api.sendMessage({ chat_id: tgId, text: u ? `🔑 ${u.npub}` : 'No identity yet. Send /start.' });
  }
}
