# Senior Smart Clock

A large-display clock application designed for elderly residents in assisted living facilities. Shows the current time, a 7-day calendar view, and provides full-screen visual and audio reminders for medications, bathroom breaks, and exercise — fetched automatically from an iCloud (or any iCalendar-compatible) calendar.

## Features

- **Large, high-contrast clock display** — time, date, and day of week
- **7-day calendar view** — upcoming events from a shared calendar
- **Automated reminders** — full-screen alerts 60 seconds before scheduled events, color-coded by type:
  - Red — Medication
  - Blue — Bathroom
  - Green — Exercise
- **Configurable** — calendar URL, timezone, and refresh interval via settings page
- **Remote dismissal** — reminders can be dismissed via an iPhone Shortcut (POST `/clear`)
- **Zero npm dependencies** — uses only Node.js built-in modules

## Requirements

- [Node.js](https://nodejs.org/) v14 or later
- A modern web browser (Chrome/Chromium recommended for kiosk mode)
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

### Manual

```bash
node proxy.js
```

Then open `http://localhost:3000` in your browser.

## Configuration

On first launch, navigate to Settings by clicking the date **5 times rapidly**. Enter:

| Setting | Description | Default |
|---|---|---|
| iCloud Calendar URL | Public `.ics` share link from your calendar app | *(required)* |
| Timezone | IANA timezone name | `America/Chicago` |
| Refresh Interval | How often to fetch calendar updates (minutes) | `5` |

Settings are saved in the browser's `localStorage`.

### Getting an iCloud Calendar URL

1. Open **Calendar.app** on Mac or iPhone
2. Click the info icon next to a calendar → **Share Calendar** → enable **Public Calendar**
3. Copy the `webcal://` link and paste it into Clock settings

## Reminder Dismissal

Reminders can be dismissed by:
- Pressing **Space** on a keyboard
- Connecting a physical button that sends a POST request to `http://localhost:3000/clear`
- An **iPhone Shortcut** that POSTs to that endpoint over local Wi-Fi

## Linux Auto-Start (systemd)

To run the clock automatically on boot:

```bash
# Edit paths in both service files first
mkdir -p ~/.config/systemd/user
cp clock.service clock-browser.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now clock.service
systemctl --user enable --now clock-browser.service
```

## Project Structure

```
Clock/
├── index.html              Main clock display
├── settings.html           Configuration page
├── proxy.js                Node.js HTTP server and calendar proxy
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

The proxy server handles CORS by fetching the remote calendar server-side and returning the data to the browser. The frontend parses the `.ics` data, renders events, and checks for upcoming reminders every second.

## License

MIT
