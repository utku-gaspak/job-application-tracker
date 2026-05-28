# Traxr

A job application tracker I built to organize my own search and kept extending as the feature set grew.

**[traxr.xyz](https://traxr.xyz)** — demo: `demo` / `demo123`

## What it does

**Scout** — Import job listings (from [hiring.cafe](https://hiring.cafe) or a JSON file), evaluate with a swipe UI, queue the ones worth applying to.

**Tracker** — Kanban board (Applied / Interviewing / Rejected / Offer) with drag-and-drop, filters, and CSV/JSON export.

**Scrape** — Runs a headless browser against a hiring.cafe search URL and imports results into your Scout queue.

Per-user data isolation, JWT auth, light/dark mode.

## Stack

.NET 10, ASP.NET Core, PostgreSQL, Entity Framework Core — backend  
React, TypeScript, Tailwind, Vite — frontend  
Docker Compose, Caddy — deployment  

## Running locally

Needs .NET 10 SDK and PostgreSQL. Copy `.env.example` to `.env` and set a database password and JWT signing key.

```bash
dotnet tool restore
dotnet run --project server/api
cd client && bun install && bun run dev
```

Migrations run on startup. A demo account (`demo` / `demo123`) is seeded automatically.

## Tests

```bash
dotnet test server/server.slnx       # 71
cd client && bun run test -- --run    # 22
```
