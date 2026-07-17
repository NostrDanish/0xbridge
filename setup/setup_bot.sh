#!/usr/bin/env bash
# 0xBridge bot profile setup — run LOCALLY, not in the sandbox.
# Usage:  BOT_TOKEN="123456:ABC..." ./setup_bot.sh
# Sets commands, description, short description, name via the Bot API.
# Token is read from $BOT_TOKEN only, sent over HTTPS to api.telegram.org,
# never echoed or written to disk.
set -euo pipefail
cd "$(dirname "$0")"

if [[ -z "${BOT_TOKEN:-}" ]]; then
  echo "ERROR: set BOT_TOKEN first:" >&2
  echo '  BOT_TOKEN="<your BotFather token>" ./setup_bot.sh' >&2
  exit 1
fi

API="https://api.telegram.org/bot${BOT_TOKEN}"

echo "==> Verifying token (getMe)..."
ME=$(curl -sS -X POST "$API/getMe")
if ! echo "$ME" | jq -e '.ok' >/dev/null; then
  echo "FAILED: $ME" >&2
  exit 1
fi
echo "    Bot: @$(echo "$ME" | jq -r '.result.username') ($(echo "$ME" | jq -r '.result.first_name'))"

echo "==> setMyCommands..."
curl -sS -X POST "$API/setMyCommands" -H 'content-type: application/json' \
  --data-binary @<(jq -c '{commands: .}' commands.json) | jq -r '.description // "ok"'

echo "==> setMyDescription..."
curl -sS -X POST "$API/setMyDescription" -H 'content-type: application/json' \
  --data-binary @<(jq -c '{description: .description}' description.json) | jq -r '.description // "ok"'

echo "==> setMyShortDescription..."
curl -sS -X POST "$API/setMyShortDescription" -H 'content-type: application/json' \
  --data-binary @<(jq -c '{short_description: .short_description}' description.json) | jq -r '.description // "ok"'

echo "==> setMyName..."
curl -sS -X POST "$API/setMyName" -H 'content-type: application/json' \
  --data-binary @<(jq -c '{name: .name}' description.json) | jq -r '.description // "ok"'

echo "==> Verifying commands were set (getMyCommands)..."
curl -sS -X POST "$API/getMyCommands" | jq -r '.result[].command' | sed 's/^/    \//'

echo ""
echo "DONE. Open https://t.me/ZEROxDevBot and type / to see the commands."
