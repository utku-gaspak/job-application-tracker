# Traxr

A job application tracker I built for myself and kept extending. Scrape job listings, swipe through them, track applications on a Kanban board.

Live at **[traxr.xyz](https://traxr.xyz)** — demo account: `demo` / `demo123`

## What it does

**Scout** — Import job postings from [hiring.cafe](https://hiring.cafe) (or a JSON file), swipe right to save, left to discard. Saved jobs go into a To Apply queue with direct links to company application pages.

**Tracker** — Kanban board with Applied, Interviewing, Rejected, and Offer columns. Drag cards between columns, filter by status, interest level, or tech stack, export to CSV or JSON.

**Scrape** — Paste a hiring.cafe search URL, the backend scrapes results into your Scout queue automatically.

## Tech

Backend: .NET 10 / ASP.NET Core / PostgreSQL  
Frontend: React / TypeScript / Tailwind  
Deployment: Docker Compose + Caddy  

## Running locally

You need .NET 10 SDK and PostgreSQL running. Copy `.env.example` to `.env`, fill in the database password and a JWT signing key (64+ chars).

```bash
dotnet tool restore
dotnet run --project server/api     # API on :5075
cd client && bun install && bun run dev   # Frontend on :5173
```

The backend auto-runs migrations on startup and seeds a demo account (`demo` / `demo123`).

## Tests

```bash
dotnet test server/server.slnx      # 71 tests
cd client && bun run test -- --run   # 22 tests
```
