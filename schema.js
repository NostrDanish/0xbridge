import { table, integer, text, sql } from 'sdk/db';

// One row per Telegram user. Nostr identity is generated once and stored.
export const users = table('users', {
  tgId:      integer('tg_id').primaryKey(),
  nostrPriv: text('nostr_priv').notNull(),   // hex privkey (V8 sandbox only; not exposed via API)
  nostrPub:  text('nostr_pub').notNull(),    // hex pubkey
  npub:      text('npub').notNull(),         // bech32 npub for display
  created:   integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Every note a user posts through the bot, mirrored to Nostr.
export const notes = table('notes', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  tgId:         integer('tg_id').notNull(),
  content:      text('content').notNull(),
  nostrEventId: text('nostr_event_id'),       // hex id once published
  status:       text('status').notNull().default('pending'), // pending|published|failed
  created:      integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Bidirectional link so a TG message and a Nostr event can be cross-referenced.
export const mirrors = table('mirrors', {
  tgMsgId:      integer('tg_msg_id').primaryKey(),
  nostrEventId: text('nostr_event_id').notNull(),
  tgId:         integer('tg_id').notNull(),
});
