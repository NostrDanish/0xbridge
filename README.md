# 0xBridge — Telegram ⇄ Nostr super-layer

A decentralized cross-network bridge: Telegram users get a Nostr identity,
post notes that mirror to Nostr relays, and read their Nostr feed — all from
Telegram. If Telegram bans the bot, the Nostr mirror survives. If a relay
dies, Telegram still has it. Neither network can fully silence you.

## Architecture

```
Telegram user ──update──▶ TG Serverless bot (handlers/ + SQLite)
                                │ fetch (HTTP only)
                                ▼
                         CF Worker bridge (worker.js)
                         HTTP ──▶ Nostr WebSocket relays
```

Telegram Serverless runs in Telegram's V8 sandbox. It has **no WebSocket**
and **no npm**, so:
- Nostr event signing is done in **pure JS** (`lib/nostr_ec.js` + `lib/nostr.js`,
  BIP-340 Schnorr, verified against vectors — 0/40 random-key failures).
- Relay pub/sub is delegated to a **Cloudflare Worker** (`worker.js`) that
  speaks WebSocket and exposes `POST /publish` + `GET /query` over plain HTTP.

## Files

| Path | Purpose |
|------|---------|
| `schema.js` | SQLite tables: users (Nostr keypair), notes, mirrors |
| `handlers/message.js` | `/start /whoami /post /feed /mirror` |
| `handlers/callback_query.js` | inline-button routes |
| `lib/keys.js` | per-user keypair gen + bech32 npub |
| `lib/nostr_ec.js` | secp256k1 EC math (BigInt, no deps) |
| `lib/nostr.js` | event build + BIP-340 sign + bridge calls |
| `worker.js` | CF Worker: HTTP→WS Nostr bridge |
| `wrangler.toml` | Worker deploy config |
| `miniapp/index.html` | Telegram Mini App (read feed, identity) |

## Deploy — Cloudflare Worker (the bridge)

```bash
npm i -g wrangler
wrangler login
wrangler deploy          # -> https://0xbridge-worker.<sub>.workers.dev
```

Set `RELAYS` in `wrangler.toml` or via `wrangler secret put RELAYS`.
Then update `RELAY_BRIDGE` in `lib/nostr.js` to your Worker URL.

## Deploy — Telegram Serverless

1. In @BotFather: create bot → Serverless → turn ON.
2. `npx tgcloud login` (uses your Serverless CLI token, NOT the Bot API token).
3. Push this folder:
   ```bash
   npx tgcloud push .
   npx tgcloud migrate   # creates the SQLite schema
   ```
4. The bot now answers commands. Keys are generated per-user on first `/start`.

## Commands

- `/start` — welcome + command list
- `/whoami` — shows your npub
- `/post <text>` — signs with your key, publishes to Nostr, saves locally
- `/feed [n]` — your latest Nostr notes (via Worker bridge)
- `/mirror` — link current chat context to a Nostr event

## Security notes

- Private keys live only in the bot's SQLite DB. They are never sent to the
  Worker or exposed via the Bot API.
- The Worker only relays *signed* events — it cannot forge anything (no key
  custody there).
- Telegram Serverless is centralized infra. Treat it as a convenient front-end,
  not a trust anchor. The Nostr copy is your real backup.

## TODO / extensions

- NIP-17 gift-wrapped DMs bridged to Telegram private messages
- NIP-50 search across relays via the Worker
- Mini App write path (sign in-browser with user-held key, not bot key)

## Configure bot profile (commands + description)

Run locally with your token as an env var (never pasted in chat, never on disk):

```bash
cd setup
BOT_TOKEN="<your BotFather token>" ./setup_bot.sh
```

This sets:
- `/setmycommands` — start, whoami, post, feed, mirror, app
- `/setmydescription` — full privacy-first blurb
- `/setmyshortdescription` — "Telegram ⇄ Nostr bridge bot"
- `/setmyname` — 0xBridge

> The token is read from `$BOT_TOKEN` and sent only to `api.telegram.org` over
> HTTPS. The script does not echo or store it. Rotate the token in BotFather
> if it was ever shared in plaintext.
