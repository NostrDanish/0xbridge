# 0xBridge — agent orientation

Telegram Serverless project. Bot bridges Telegram users to Nostr: per-user
Nostr keypair (generated in SQLite), `/post` signs + publishes to Nostr via a
Cloudflare Worker HTTP→WS bridge, `/feed` reads back.

## Hard constraints (from Telegram Serverless runtime)
- No npm packages. Import only `sdk`, `sdk/db`, `sdk/api`, `sdk/fetch`, and local
  modules by bare name (`from 'schema'`, `from 'lib/keys.js'`). No relative paths.
- No WebSocket. Outbound HTTP only → Nostr relay pub/sub goes through
  `worker.js` (CF Worker) exposed as `POST /publish`, `GET /query`.
- No filesystem, no raw file bytes. Keys are stored as TEXT in SQLite.
- Signing is pure JS (lib/nostr_ec.js + lib/nostr.js) — BIP-340 Schnorr,
  verified valid across random keys. Do NOT add a secp256k1 dependency.
- `api` unwraps Bot API responses (no `{ok,result}` wrapper).
- `db` is Drizzle-like: `.select().from().where().orderBy(desc(col)).limit().run()`,
  `db.insert(...).values(...).returning().run()`, `db.$count(table, where?)`.

## Deploy flow (run on a real machine, not the sandbox)
1. `npm create @tgcloud/bot` style scaffold already done; `npx tgcloud login`
   with the Serverless CLI token (app<id>:<secret> from BotFather → Serverless).
2. `npx tgcloud push` then `npx tgcloud migrate`.
3. Bot profile (commands/description): `cd setup && BOT_TOKEN=... ./setup_bot.sh`.
4. Worker: `wrangler deploy` (needs RELAYS env / wrangler.toml).
5. Set MINIAPP_URL in handlers/message.js, RELAY_BRIDGE in lib/nostr.js,
   BRIDGE in miniapp/index.html to your deployed URLs.

## Files
- schema.js — users (keypair), notes, mirrors
- handlers/message.js — /start /whoami /post /feed /mirror /app
- handlers/callback_query.js — inline button routes
- lib/keys.js — keypair gen + bech32 npub encode
- lib/nostr.js — event build + BIP-340 sign + bridge fetch calls
- lib/nostr_ec.js — secp256k1 EC math (BigInt, no deps)
- worker.js — CF Worker HTTP→WS Nostr bridge
- miniapp/index.html — Telegram Mini App (reads ?pub= from bot)
