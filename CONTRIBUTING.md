# Contributing to Signal

Thanks for wanting to improve Signal. This is a small, focused project - please
keep contributions the same way.

## Getting set up

Follow [RUNNING.md](RUNNING.md) to get the backend and dashboard running from
source. Short version:

```bash
npm ci
npm run build      # compiles the React dashboard into frontend/dist
npm start           # http://127.0.0.1:8787
```

For UI work, run `npm start` and `npm run dev:ui` side by side for hot reload
(see RUNNING.md's "Developing the UI" section).

To work on the Electron desktop app, see the **Desktop app** section of the
[README](README.md#desktop-app-mac--windows).

## Before opening a PR

- **Run the tests**: `npm test`. New backend behavior (routes, security checks,
  share lifecycle) should come with a test in `test/server.test.js`.
- **Keep changes scoped.** A bug fix shouldn't carry drive-by refactors; a new
  feature shouldn't restyle unrelated components. Small, reviewable PRs get
  merged faster.
- **Match the existing style**: no comments explaining *what* code does (names
  should already make that clear) - only comment on genuinely non-obvious
  *why* (a workaround, a subtle invariant, a security constraint). Don't add
  abstractions, config options, or error handling for cases that can't happen.
- **Security-sensitive changes** (anything touching path resolution, passcode
  handling, session tokens, or file streaming) should explain the threat model
  in the PR description, not just the code change.

## Reporting bugs / requesting features

Open a [GitHub Issue](https://github.com/HindzSight/Signal/issues) with:
- What you did, what you expected, what happened instead.
- Whether you're running from source or the packaged desktop app (and which
  OS/version).
- Any relevant terminal output - the dashboard logs errors to the console.

## Project layout

| Path | What lives there |
|---|---|
| `src/` | Node HTTP server: share lifecycle, passcode auth, file/zip streaming, SSE telemetry. Zero framework, only `yazl` as a runtime dependency. |
| `frontend/` | Vite + React + TypeScript sender dashboard (shadcn/ui, "SIGNAL" theme). |
| `electron/` | Desktop app shell - wraps the same server in a native window. |
| `scripts/` | Build-time tooling (icon generation, cloudflared binary fetching). |
| `test/` | Node's built-in test runner (`node --test`) against `src/`. |

## License

By contributing, you agree your contribution is licensed under this project's
[MIT License](LICENSE).
