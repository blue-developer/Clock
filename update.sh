#!/bin/bash
# Polls GitHub for updates, pulls if behind, and restarts the clock service.
# Run via cron as cn60:
#   */5 * * * * /home/cn60/clock/update.sh >> /home/cn60/clock/update.log 2>&1

# Required for systemctl --user to work from cron (no D-Bus session)
export XDG_RUNTIME_DIR=/run/user/$(id -u)
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus

cd /home/cn60/clock || exit 1

git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "[$(date)] New version detected — pulling..."
  git pull
  git rev-parse --short HEAD > version.txt
  systemctl --user restart clock
  echo "[$(date)] Updated to $(cat version.txt) and restarted clock."
else
  echo "[$(date)] Already up to date ($(git rev-parse --short HEAD))."
fi
