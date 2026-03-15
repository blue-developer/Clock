#!/bin/bash
# setup-kiosk.sh — Run ONCE with sudo to permanently configure this Linux box
# as a kiosk that never sleeps.
#
# Usage:  sudo ./setup-kiosk.sh
#
# Safe to re-run; all operations are idempotent.

set -e

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: This script must be run as root.  Use: sudo ./setup-kiosk.sh"
  exit 1
fi

echo "==> Disabling sleep / suspend / hibernate targets..."
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

echo "==> Configuring logind to never idle-suspend..."
mkdir -p /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/kiosk.conf <<'EOF'
[Login]
# Never suspend on idle, lid close, or power key (display device has none)
IdleAction=ignore
IdleActionSec=0
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
HandleSuspendKey=ignore
HandleHibernateKey=ignore
EOF
systemctl restart systemd-logind
echo "    logind restarted."

echo "==> Disabling DPMS / screensaver via X11 defaults..."
# Write xorg config so xset overrides survive display server restarts
mkdir -p /etc/X11/xorg.conf.d
cat > /etc/X11/xorg.conf.d/99-kiosk-nodpms.conf <<'EOF'
Section "ServerFlags"
    Option "BlankTime"  "0"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime"    "0"
EndSection

Section "Monitor"
    Identifier "Monitor0"
    Option "DPMS" "false"
EndSection
EOF
echo "    Xorg DPMS config written."

echo ""
echo "✓ Kiosk sleep-prevention configured successfully."
echo ""
echo "  Next steps:"
echo "   1. Reboot to confirm all settings take effect."
echo "   2. Use launch-clock.sh as usual — no sudo needed."
echo ""
