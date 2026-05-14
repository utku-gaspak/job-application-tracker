# Job Application Tracker 

Job Application Tracker is a full-stack app for managing job applications with JWT authentication, per-user data isolation, and a compact React dashboard, Built to track my own job applications while learning ASP.NET Core because spreadsheets weren't cutting it.

It supports status tracking, application details, drag-and-drop updates, and a top-of-board filter bar for search, status, interest level, and technical skills. The current test suite includes 70 automated tests across the backend and frontend.

Live site: https://traxr.xyz

## Screenshots

The main UI flow is shown below.

![Login screen](docs/screenshots/login1.png)
![Dashboard](docs/screenshots/dashboard1.png)
![Application details](docs/screenshots/details.png)
![Edit application](docs/screenshots/edit.png)

## Core Features

- JWT-based register and login flows
- Per-user job application data
- CRUD operations for job applications
- Kanban status tracking for `Applied`, `Interviewing`, `Rejected`, and `Offer`
- Optional application details, including job URL, location, salary range, job description, notes, interest level, and technical stack
- Compact filter bar above the board with search, status, interest level, and skill transfer controls
- Drag-and-drop card movement with manual board ordering
- Mobile accordion view for Kanban columns on small screens
- Light and dark mode with a theme-aware favicon
- Sort toggle for newest or oldest applications first
- Protected dashboard routes with persisted login state
- Error handling for validation, authorization, server, and connection failures
- OpenAPI and generated TypeScript client support for keeping the backend and frontend in sync

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
- Vitest
- React Testing Library
- MSW

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

The core backend and frontend flows are implemented and tested. Current work is focused on UI/UX refinement and small layout improvements.
