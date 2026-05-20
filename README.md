# Traxr - Job Application Tracker

Traxr is a full-stack job search workflow tool with JWT authentication, per-user data isolation, and a React dashboard. I built it to track my own applications while learning ASP.NET Core - and kept extending it into a complete end-to-end job search tool.

It covers the full pipeline: scrape job postings with [hiring-cafe-scout](https://github.com/utku-gaspak/hiring-cafe-scout), evaluate them with a swipe UI, queue the ones worth applying to, apply directly on company websites, then track status through the Kanban board.

Live site: https://traxr.xyz

## Screenshots

![Login screen](docs/screenshots/login1.png)
![Dashboard](docs/screenshots/dashboard1.png)
![Application details](docs/screenshots/details.png)
![Edit application](docs/screenshots/edit.png)

## Core Features

### Job Scout
- Upload jobs.json output from [hiring-cafe-scout](https://github.com/utku-gaspak/hiring-cafe-scout) directly into the app
- Swipe-based evaluation UI - right to save, left to discard, keyboard shortcuts supported
- To Apply queue with direct company apply links
- JSON or CSV export for the Scout queue
- Scout-side summary counts for the current queue
- One-click promotion from To Apply to the Kanban board as Applied

### Application Tracker
- JWT-based register and login flows
- Demo login with a seeded board for quick walkthroughs
- Per-user job application data
- CRUD operations for job applications
- Kanban status tracking for `Applied`, `Interviewing`, `Rejected`, and `Offer`
- Optional application details including job URL, location, salary range, job description, notes, interest level, and technical stack
- Compact filter bar with search, status, interest level, and skill transfer controls
- Drag-and-drop card movement with manual board ordering
- Mobile accordion view for Kanban columns on small screens
- Toggleable tracker status diagram with PNG export
- Light and dark mode with a theme-aware favicon
- Sort toggle for newest or oldest applications first
- Guided onboarding tour for tracker and Scout flows
- Protected dashboard routes with persisted login state
- Error handling for validation, authorization, server, and connection failures
- OpenAPI and generated TypeScript client support for keeping the backend and frontend in sync
- Docker Compose deployment with Caddy, PostgreSQL, and separate frontend/backend containers

## Tech Stack

### Backend
- .NET 10
- ASP.NET Core Web API
- Entity Framework Core
- PostgreSQL with Npgsql
- xUnit
- Moq
- FluentAssertions

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Bun
- Vitest
- React Testing Library
- MSW

### Deployment
- Docker Compose
- Caddy
- Nginx
- PostgreSQL container for VPS deployment

## Testing

The project uses focused tests at both layers instead of relying on a live external system during normal verification.

- Backend tests cover services, controllers, validation, authentication behavior, and persistence rules using an in-memory EF Core test database and targeted mocks.
- Frontend tests use MSW to verify UI behavior without a live backend, including CRUD flows, loading states, empty states, validation, failed requests, and auth-expiry behavior.

Current test count:
- Backend: `48` tests
- Frontend: `19` tests
- Total: `67` tests

Run the suites with:

```bash
dotnet test server/server.slnx
```

```bash
cd client
bun run test
```

## Setup Guide

### Backend

Provide the required API configuration:
- `ConnectionStrings__DefaultConnection`
- `JWT__Issuer`
- `JWT__Audience`
- `JWT__SigningKey`

Restore and run the API:

```bash
dotnet restore server/server.slnx
dotnet run --project server/api
```

The API runs on `http://localhost:5075` by default.

### Frontend

Install dependencies:

```bash
cd client
bun install
```

Start the client:

```bash
bun run dev
```

The frontend expects the API at `http://localhost:5075` unless `VITE_API_BASE_URL` is provided.

## Project Status

The core backend and frontend flows are implemented, tested, and deployed. The Scout feature adds a scraper integration workflow on top of the existing tracker. Normal next-step improvements include email verification, password reset, rate limiting, backups, and more end-to-end testing.
