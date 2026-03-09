#!/bin/bash
# Launch Clock — double-click to start the proxy server and open the clock.
# Works on macOS. Place this file in the same folder as proxy.js.

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3000
URL="http://localhost:$PORT"

# Check Node is available
if ! command -v node &>/dev/null; then
  osascript -e 'display alert "Node.js not found" message "Please install Node.js from https://nodejs.org and try again."'
  exit 1
fi

# Kill any previous instance on the same port
lsof -ti tcp:$PORT | xargs kill -9 2>/dev/null

# Start proxy in background, logging to a temp file
LOG="$DIR/clock.log"
node "$DIR/proxy.js" > "$LOG" 2>&1 &
SERVER_PID=$!

# Wait for the server to accept connections (up to 5 seconds)
for i in $(seq 1 10); do
  sleep 0.5
  if curl -sf "$URL" -o /dev/null 2>/dev/null; then
    break
  fi
done

# Open the clock in Chrome kiosk mode if available, otherwise default browser
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -f "$CHROME" ]; then
  "$CHROME" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    "$URL" &
else
  open "$URL"
fi

# Keep the terminal window open so the server keeps running.
# Closing the terminal window will stop the server.
echo "Clock is running at $URL"
echo "Close this window to stop the server."
wait $SERVER_PID
