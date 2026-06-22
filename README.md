# spotibot

Self-hosted web server that watches one or more of **your own** Spotify accounts and, when an account
has had **no music playing for X seconds**, automatically picks an active Spotify Connect device, sets a
volume, and starts a configured playlist/album. Everything is configured from a web UI. Built to grow into
more Spotify automations over the same engine.

> **Not affiliated with Spotify.** Controls only Spotify Connect devices you already own, for genuine
> personal listening. Playback control requires **Spotify Premium** on each controlled account. Spotify's
> developer terms restrict automated/bot-driven streaming intended to manipulate play counts — this tool
> is for your own listening, but you use it at your own risk. See `/temp/spotibot-plan.md` for the legal
> notes that shaped this.

## Stack

- **shared/** — zod DTOs shared by server and web.
- **server/** — TypeScript · Fastify · Drizzle ORM + PostgreSQL · background poller.
- **web/** — React + Vite SPA · React Router · TanStack Query.
- Single multi-stage Docker image; `docker compose` brings up the app + Postgres.

## How it works

The Spotify Web API has no audio stream and no push events, so the server **polls** `GET /me/player`
(~5s) per enabled account. When an account is silent past its threshold it resolves a live device,
transfers playback, sets the volume, and starts the configured music set. Spotify **app credentials live
in the database**, so one deployment can register multiple Spotify apps (each authorizes up to 5 accounts
in Development Mode) and thus manage many accounts.

## Prerequisites

- Node 22+ and `pnpm` (via `corepack enable`), or just Docker.
- A PostgreSQL database.
- One or more Spotify apps from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
  each with redirect URI `$PUBLIC_BASE_URL/api/spotify/callback`.

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env: set DASHBOARD_PASSWORD, SESSION_SECRET (32+ chars), and generate TOKEN_ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
docker compose up --build
```

Open http://localhost:8080, log in, add a Spotify app (Spotify Apps page), then **Connect account**.

## Local development

```bash
pnpm install
pnpm run build:shared            # build shared types once
# Start Postgres (e.g. docker compose up postgres), then set DATABASE_URL in .env
pnpm dev                          # runs shared (watch) + server (:8080) + web (:5173)
```

The Vite dev server proxies `/api` to the backend on `:8080`.

## Quality gates (enforced in CI, zero rule suppressions allowed)

```bash
pnpm run format:check   # prettier
pnpm run lint           # eslint (type-checked), --max-warnings 0
pnpm run typecheck      # tsc strict across all workspaces
pnpm run test           # vitest (pure rules + crypto)
pnpm run build          # shared + web + server bundles
pnpm run db:generate    # regenerate Drizzle SQL migrations after schema changes
```

## CI/CD

GitHub Actions runs the full gate on every push/PR. On push to **`dev`** (the default branch) a green run
builds and publishes the container image to **GHCR** (`ghcr.io/<owner>/spotibot`).
