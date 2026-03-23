#!/bin/bash
# Auto-update: force-syncs the Linux box to GitHub origin/main.
# Local changes are always discarded — GitHub is the source of truth.
# Run via cron as cn60:
#   */5 * * * * /home/cn60/clock/update.sh >> /home/cn60/clock/update.log 2>&1

set -e
cd /home/cn60/clock || exit 1

git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "[$(date)] Update detected: $LOCAL -> $REMOTE"
  git reset --hard origin/main
  echo "[$(date)] Done. Now at $(git rev-parse --short HEAD)."
else
  echo "[$(date)] Up to date ($(git rev-parse --short HEAD))."
fi
