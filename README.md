# Signal - Folder Share Dashboard

Beam a folder straight from your computer to anyone, through a temporary,
passcode-protected Cloudflare Quick Tunnel - and watch their downloads in real
time. Files are never uploaded to this app or any storage provider; they stream
directly off your disk while the tunnel is open.

> 📖 **Just want to run it?** See **[RUNNING.md](RUNNING.md)** for a step-by-step
> local setup guide.

## How it works

- A local **Node HTTP server** (`src/`) spawns `cloudflared`, opens the native OS
  folder picker, streams files with HTTP range/resume support, and pushes live
  transfer telemetry over Server-Sent Events.
- The **dashboard UI** (`frontend/`) is a Vite + React + TypeScript app built on
  [shadcn/ui](https://ui.shadcn.com) (new-york style) with a custom "SIGNAL"
  theme. The Node server serves the built app to you locally; your recipients
  only ever see the server-rendered `/s/<id>` share pages through the tunnel.

## Requirements

- Node.js 20+
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
  installed and available on `PATH`

## Run

Build the dashboard once, then start the server:

```powershell
# Windows (PowerShell)
npm.cmd run build   # installs frontend deps + builds frontend/dist
npm.cmd start       # serves the dashboard at http://127.0.0.1:8787
```

```bash
# macOS / Linux
npm run build   # installs frontend deps + builds frontend/dist
npm start       # serves the dashboard at http://127.0.0.1:8787
```

Open `http://127.0.0.1:8787`, choose a folder, open a secure channel, and send
the public link and passcode **separately**. Closing the service stops every share.

> If `frontend/dist` is missing (you skipped the build), the server automatically
> falls back to the lightweight inline dashboard - nothing breaks.

## Develop the UI

Run the backend and the Vite dev server (with hot reload) side by side:

```powershell
# Windows (PowerShell)
npm.cmd start          # terminal 1 - backend on :8787
npm.cmd run dev:ui     # terminal 2 - Vite on http://127.0.0.1:5173
```

```bash
# macOS / Linux
npm start          # terminal 1 - backend on :8787
npm run dev:ui     # terminal 2 - Vite on http://127.0.0.1:5173
```

Vite proxies `/api`, `/s/`, and the recipient stylesheet to the backend, so the
dev server behaves exactly like production.

## Security notes

- The dashboard binds only to loopback. Public file pages are reachable only
  through the Cloudflare tunnel, and only after the recipient enters the passcode.
- Passcodes are stored as a salted scrypt hash; sessions are HMAC-signed cookies.
- File requests are path-contained and reject symlinks that escape the shared folder.

## Test

```powershell
npm.cmd test    # Windows (PowerShell)
```

```bash
npm test        # macOS / Linux
```
