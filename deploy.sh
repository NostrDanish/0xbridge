#!/usr/bin/env bash
# 0xBridge full deploy — run LOCALLY, not in the sandbox.
# Steps (each reads its token from env, nothing hardcoded):
#   1. tgcloud login   (Serverless CLI token: app<id>:<secret>)
#   2. tgcloud push + migrate
#   3. setup bot profile (Bot API token)
#   4. wrangler deploy (CF Worker bridge)
#
# Usage:
#   TGCLOUD_TOKEN="app123:secret" BOT_TOKEN="123456:ABC..." ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "==> [1/4] Link bot (Serverless CLI token)"
if [[ -n "${TGCLOUD_TOKEN:-}" ]]; then
  printf '%s' "$TGCLOUD_TOKEN" | npx tgcloud login --token-stdin 2>/dev/null \
    || TGCLOUD_TOKEN="$TGCLOUD_TOKEN" npx tgcloud login
else
  echo "  TGCLOUD_TOKEN not set — run 'npx tgcloud login' manually (interactive)."
fi

echo "==> [2/4] Deploy serverless modules + migrate DB"
npx tgcloud push
npx tgcloud migrate --yes

echo "==> [3/4] Set bot profile (commands/description)"
if [[ -n "${BOT_TOKEN:-}" ]]; then
  ( cd setup && BOT_TOKEN="$BOT_TOKEN" ./setup_bot.sh )
else
  echo "  BOT_TOKEN not set — skipping. Run setup/setup_bot.sh later with BOT_TOKEN."
fi

echo "==> [4/4] Deploy CF Worker bridge"
if command -v wrangler >/dev/null 2>&1; then
  npx wrangler deploy
else
  echo "  wrangler not found — run 'npx wrangler deploy' manually after setting RELAYS."
fi

echo "==> Done. Set MINIAPP_URL (handlers/message.js), RELAY_BRIDGE (lib/nostr.js),"
echo "    and BRIDGE (miniapp/index.html) to your deployed URLs, then re-push."
