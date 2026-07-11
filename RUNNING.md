# Running Signal locally

A step-by-step guide to running the Folder Share dashboard on your own machine.
Commands are shown for **Windows PowerShell** (use `npm` instead of `npm.cmd` on
macOS/Linux).

---

## 1. Prerequisites

| Tool | Version | Check | Get it |
|------|---------|-------|--------|
| **Node.js** | 20 or newer | `node --version` | <https://nodejs.org> |
| **cloudflared** | any recent | `cloudflared --version` | [Cloudflare downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) |

`cloudflared` must be on your `PATH` — open a fresh terminal after installing and
run `cloudflared --version` to confirm. The dashboard also shows a red
**"cloudflared missing"** badge if it can't find it.

> You can start the dashboard without cloudflared, but you won't be able to open
> a share until it's installed.

---

## 2. First-time setup

From the project root (`Signal`):

```powershell
# Install the backend has no dependencies, but this builds the React dashboard.
npm.cmd run build
```

`npm run build` installs the frontend's dependencies and compiles the React app
into `frontend/dist`. You only need to re-run it when the UI source changes.

> **Skipping the build?** The server still runs — it automatically falls back to
> a lightweight built-in dashboard. You just won't get the polished "SIGNAL" UI.

---

## 3. Start the app

```powershell
npm.cmd start
```

You should see:

```
Folder Share Dashboard listening at http://127.0.0.1:8787
```

Open **<http://127.0.0.1:8787>** in your browser.

---

## 4. Share a folder

1. Click **Browse** (opens your OS folder picker) or paste a folder path.
2. Pick an **Auto-close** time (how long the link stays alive).
3. Click **Open secure channel**. The link **and passcode are copied to your
   clipboard together**.
4. Send the **link** and the **passcode** to your recipient **through separate
   channels** (e.g. link by email, passcode by text) for best security.
5. Watch the **Active channels** panel — each file the recipient downloads shows
   up live with progress, speed, and status.

To stop a share immediately, click **Stop** on its card and confirm. Closing the
server (`Ctrl+C` in the terminal) stops **every** share at once.

---

## 5. Stopping

Press `Ctrl+C` in the terminal running `npm start`. All tunnels are torn down and
every public link stops working.

---

## Developing the UI (optional)

For live hot-reload while editing the React frontend, run two terminals:

```powershell
# Terminal 1 — backend API + tunnels
npm.cmd start

# Terminal 2 — Vite dev server with hot reload
npm.cmd run dev:ui
```

Then open **<http://127.0.0.1:5173>** (the Vite dev server). It proxies `/api`,
`/s/`, and the recipient stylesheet to the backend on `:8787`, so it behaves
exactly like production. Edits to `frontend/src` refresh instantly.

When you're done, rebuild for production with `npm.cmd run build`.

---

## Ports

| Port | Who | What |
|------|-----|------|
| `8787` | Backend (`npm start`) | Dashboard + API + public share pages. Loopback only. |
| `5173` | Vite (`npm run dev:ui`) | Dev-only hot-reload server. |

Change the backend port with an environment variable:

```powershell
$env:PORT = 9000; npm.cmd start
```

(If you change it, update `BACKEND` in `frontend/vite.config.ts` too so the dev
proxy still points at the right place.)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Red **"cloudflared missing"** badge | Install cloudflared and make sure it's on `PATH`; restart the dashboard. |
| **"Timed out waiting for Cloudflare Quick Tunnel"** | Check your internet connection / firewall, then try again. |
| Browse button does nothing | Make sure you're on `http://127.0.0.1:8787` (the picker only works for local requests). |
| Dashboard looks basic / unstyled | Run `npm.cmd run build` to compile the React UI, then restart. |
| Port `8787` already in use | Set `$env:PORT` to a free port (see above). |

---

## Running the tests

```powershell
npm.cmd test
```

Covers passcode hashing, path-containment/symlink safety, and share lifecycle.
