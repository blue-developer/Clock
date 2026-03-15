# Senior Smart Clock

A large-display clock application designed for elderly residents in assisted living facilities. Shows the current time, a 7-day calendar view, and provides full-screen visual reminders for medications, bathroom breaks, and exercise — fetched automatically from iCloud (or any iCalendar-compatible) calendars.

## Features

- **Large, high-contrast clock display** — time, date, and day of week
- **7-day calendar strip** — upcoming events from a shared calendar; past events on today's tile drop off automatically
- **Automated reminders** — full-screen alerts 60 seconds before scheduled events, color-coded by type:
  - Red — Medication
  - Blue — Bathroom
  - Green — Exercise
- **Two-feed calendar model** — separate URLs for display events and reminder alerts
- **Night mode** — automatically dims to dark red tones at night; smoothly transitions back at dawn
- **Configurable** — calendar URLs, timezone, and refresh interval via a settings page
- **Remote dismissal** — reminders can be dismissed via an iPhone Shortcut (POST `/clear`) or the Space key
- **Kiosk controls** — exit and return to kiosk mode from the settings page (Linux/Firefox)
- **Zero npm dependencies** — uses only Node.js built-in modules

## Requirements

- [Node.js](https://nodejs.org/) v14 or later
- A modern web browser (Chromium or Firefox recommended for kiosk mode)
- A publicly shared iCalendar (`.ics`) URL (e.g., from Apple Calendar, Google Calendar)

## Quick Start

### macOS

Double-click **Launch Clock.command** in Finder.

> If you get a security warning, right-click the file and choose "Open".

This will:
1. Start the proxy server on port 3000
2. Open Chrome in fullscreen kiosk mode at `http://localhost:3000`

### Linux

```bash
chmod +x launch-clock.sh
./launch-clock.sh
```

The script disables display sleep (`xset`), starts the proxy, then launches Chromium (or Firefox as a fallback) in kiosk mode.

### Manual

```bash
node proxy.js
```

Then open `http://localhost:3000` in your browser.

## Configuration

### Settings page

Navigate to Settings by **clicking the date 5 times rapidly** (within 3 seconds). Enter:

| Setting | Description | Default |
|---|---|---|
| Calendar URL | Public `.ics` link — events shown on the weekly strip | *(required)* |
| Reminders URL | Public `.ics` link — triggers full-screen alerts only, not shown on strip | *(optional)* |
| Timezone | IANA timezone name | `America/Chicago` |
| Refresh Interval | How often to fetch calendar updates (minutes) | `5` |

Settings are saved in the browser's `localStorage` and take effect immediately without a page reload.

If a **Reminders URL** is not configured, reminders are detected from the main Calendar URL instead.

### config.json

`config.json` at the project root sets the **server-side defaults** loaded before `localStorage`. Edit it to pre-configure a device without going through the UI:

```json
{
  "icsCalendarUrl":  "webcal://p01-caldav.icloud.com/…",
  "icsRemindersUrl": "webcal://p01-caldav.icloud.com/…",
  "timezone":        "America/Chicago",
  "pollIntervalMinutes": 5
}
```

`localStorage` values always override `config.json`.

### Getting an iCloud Calendar URL

1. Open **Calendar.app** on Mac or iPhone
2. Click the info icon next to a calendar → **Share Calendar** → enable **Public Calendar**
3. Copy the `webcal://` link and paste it into Clock settings

## Reminder Alerts

Reminders fire when a calendar event starts within the next 60 seconds. Event titles are classified automatically:

| Keywords in title | Alert type |
|---|---|
| `medication`, `medicine` | Red / Medication |
| `bathroom`, `bath` | Blue / Bathroom |
| `exercise`, `workout` | Green / Exercise |
| anything else | White / Custom |

### Dismissal

- **Space bar** on a keyboard
- **POST** `http://localhost:3000/clear` from a local device or iPhone Shortcut
- The browser polls `/clear-pending` every 3 seconds; the flag is consumed on read

## Night Mode

Night mode dims the entire display to dark red tones to avoid disturbing sleep. It transitions gradually (4-second fade) so the screen never flashes.

Toggle manually with the **Night Mode / Day Mode** button in dev controls (`Shift+D` or `?dev=1`).

## Developer / Admin Access

| Action | How |
|---|---|
| Open settings | Click the date 5× in 3 seconds |
| Toggle dev controls (reminder test buttons) | `Shift+D` or add `?dev=1` to the URL |
| Exit kiosk mode (Linux) | Settings → **Exit Kiosk Mode** |
| Return to kiosk mode (Linux) | Settings → **Return to Kiosk** |

## Linux Auto-Start (systemd)

To run the clock automatically on boot:

```bash
# Edit the paths in clock.service and clock-browser.service first
mkdir -p ~/.config/systemd/user
cp clock.service clock-browser.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now clock.service
systemctl --user enable --now clock-browser.service
```

View logs:

```bash
journalctl --user -u clock.service -f
```

## Project Structure

```
Clock/
├── index.html              Main clock display
├── settings.html           Configuration page
├── proxy.js                Node.js HTTP server and calendar proxy
├── config.json             Server-side default settings
├── Launch Clock.command    macOS launcher (double-click)
├── launch-clock.sh         Linux launcher script
├── clock.service           systemd service for the proxy
├── clock-browser.service   systemd service for the browser (kiosk)
└── MVP/                    Early design mockups
```

## Architecture

```
Browser (Kiosk)
      │  HTTP
Node.js proxy (localhost:3000)
      │  HTTPS
Remote iCalendar (.ics)
```

The proxy handles CORS by fetching the remote calendar server-side and returning it to the browser. The frontend parses `.ics` data, renders events, and checks for upcoming reminders every second. The `/clear` and `/clear-pending` endpoints relay dismissal signals between the iPhone Shortcut and the browser without a persistent WebSocket.

## Roadmap

### Remote Dismissal — Alternatives to Always-On Tailscale

The current implementation uses Tailscale (a VPN mesh) so the iPhone Shortcut can reach the Linux box directly. Two alternatives are being considered:

#### Option 1: Tailscale — toggle on/off per shortcut
- iOS Shortcut turns Tailscale on, sends the POST `/clear`, then turns Tailscale off
- No permanent VPN running on the phone
- Adds a few seconds of delay while Tailscale connects

#### Option 2: ntfy.sh — no VPN at all
- iPhone Shortcut POSTs to `https://ntfy.sh/your-secret-topic` over normal internet
- Linux box polls ntfy.sh every few seconds for a clear signal
- No VPN on the phone at all; free tier (250 messages/day) is sufficient
- Only data passing through ntfy.sh is a single "clear" signal — no personal information

### Other Planned Work
- [ ] Auto-update via `git pull` cron job on Linux
- [ ] iCloud Calendar feed configuration and testing

## License

MIT
