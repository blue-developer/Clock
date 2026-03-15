#!/bin/bash
# Launch Clock — ArchLinux / generic Linux
# Run once manually the first time; after that use systemd (see clock.service).

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3000
URL="http://localhost:$PORT"

# Check Node is available
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found. Install it with: sudo pacman -S nodejs"
  exit 1
fi

# Disable screen blanking and DPMS (prevent display from sleeping).
# Run once immediately, then repeat every 5 minutes because some DEs
# (GNOME, LightDM, etc.) silently re-enable DPMS after ~10-13 minutes.
prevent_sleep() {
  xset s off
  xset s noblank
  xset -dpms
}
prevent_sleep
( while true; do sleep 300; prevent_sleep; done ) &

# Kill any previous instance on the same port
fuser -k ${PORT}/tcp 2>/dev/null

# Start proxy
node "$DIR/proxy.js" &
SERVER_PID=$!

# Wait for server to be ready (up to 5 seconds)
for i in $(seq 1 10); do
  sleep 0.5
  curl -sf "$URL" -o /dev/null 2>/dev/null && break
done

# Open browser in kiosk mode (no UI, full screen, no restore prompts)
if command -v chromium &>/dev/null; then
  chromium \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    "$URL" &
elif command -v chromium-browser &>/dev/null; then
  chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    "$URL" &
elif command -v firefox &>/dev/null; then
  firefox --kiosk "$URL" &
else
  echo "ERROR: No supported browser found. Install chromium: sudo pacman -S chromium"
  exit 1
fi

echo "Clock running at $URL (PID $SERVER_PID)"
echo "Press Ctrl+C to stop."
wait $SERVER_PID
