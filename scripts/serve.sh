#!/bin/sh
# Keeps the demo reachable. Restarts the seller and the tunnel if either dies, and writes the
# current public URL to .live-url so it can always be looked up.
#
#   nohup sh scripts/serve.sh > /tmp/held-serve.log 2>&1 &
#
# Quick tunnels are ephemeral: a restart means a NEW url. That is why the url is written to a file
# rather than assumed to be stable, and why a tunnel link in a submission needs a caveat.
set -u
cd "$(dirname "$0")/.." || exit 1
PORT="${PORT:-4021}"

while true; do
  if ! curl -s --max-time 6 -o /dev/null "http://127.0.0.1:$PORT/health"; then
    echo "$(date -u +%FT%TZ) seller not answering — starting it"
    pkill -f "src/seller.js" 2>/dev/null
    sleep 1
    DEMO_BUY="${DEMO_BUY:-on}" REVIEW_MINUTES="${REVIEW_MINUTES:-20}" \
      nohup npm run --silent seller > /tmp/held-seller.log 2>&1 &
    sleep 12
  fi

  URL=$(curl -s --max-time 6 http://127.0.0.1:4040/api/tunnels 2>/dev/null \
        | sed -n 's/.*"public_url":"\(https:[^"]*\)".*/\1/p' | head -1)
  if [ -z "$URL" ]; then
    echo "$(date -u +%FT%TZ) tunnel down — restarting"
    pkill -f "ngrok http" 2>/dev/null
    sleep 2
    nohup ngrok http "$PORT" --log stdout > /tmp/held-ngrok.log 2>&1 &
    sleep 12
    URL=$(curl -s --max-time 6 http://127.0.0.1:4040/api/tunnels 2>/dev/null \
          | sed -n 's/.*"public_url":"\(https:[^"]*\)".*/\1/p' | head -1)
  fi

  if [ -n "$URL" ]; then
    PREV=$(cat .live-url 2>/dev/null || echo "")
    [ "$URL" != "$PREV" ] && echo "$(date -u +%FT%TZ) public url is now $URL"
    printf '%s\n' "$URL" > .live-url
  fi
  sleep 30
done
