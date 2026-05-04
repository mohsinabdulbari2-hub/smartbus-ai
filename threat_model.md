# Threat Model

## Project Overview

SmartBus AI is a public transit information application with an Express 5 API (`artifacts/api-server`), a React + Vite web client (`artifacts/smartbus`), and an Expo mobile client (`artifacts/smartbus-mobile`). It serves public bus-route, stop, ETA, and crowd-prediction data backed by PostgreSQL via Drizzle ORM (`lib/db`).

The current production design is intentionally unauthenticated: clients fetch public transit data over `/api`, and there are no user accounts, payment flows, admin panels, or user-generated content paths in the production application.

Production-scope assumptions for this scan:
- Replit terminates TLS for deployed traffic.
- `NODE_ENV` is `production` in deployed environments.
- `artifacts/mockup-sandbox/` is dev-only and should be ignored unless production reachability is proven.
- `scripts/` and mobile build tooling are build-time/developer surfaces unless they are invoked by a production service.

## Assets

- **Application availability** — the primary security-sensitive asset in this project is service uptime. Public route search, live bus positions, and stop lookups are user-facing core functionality and can be degraded by resource exhaustion.
- **Transit dataset integrity** — route, stop, and frequency data in PostgreSQL drives journey planning and ETA responses. Corruption would misroute users and poison downstream predictions.
- **Live bus state and derived predictions** — the in-memory bus simulation and crowd/ETA outputs are part of the public product experience. They are not confidential, but they are operationally important.
- **Infrastructure secrets** — `DATABASE_URL`, deployment environment variables, and any future third-party service credentials must stay server-side.
- **Server resources** — database connections, CPU, memory, and network bandwidth are finite and are directly exposed to unauthenticated API traffic.

## Trust Boundaries

- **Browser / Mobile client → API** — all request parameters, headers, and paths are attacker-controlled. The API must validate inputs and remain resilient to abusive request patterns.
- **API → PostgreSQL** — the API has direct read/write capability on the transit database. Query construction and query volume directly affect confidentiality, integrity, and availability.
- **Public internet → unauthenticated endpoints** — every production endpoint is currently public by design. Because there is no auth boundary today, availability and safe input handling matter more than access-control checks.
- **Mobile static server → client browser / Expo Go** — `artifacts/smartbus-mobile/server/serve.js` serves generated static assets and landing-page content. Request metadata and file paths crossing this boundary must not permit traversal or script injection.
- **Development / build-time surfaces → production** — `artifacts/mockup-sandbox/`, `scripts/`, and `artifacts/smartbus-mobile/scripts/` are usually out of scope unless they are reachable from deployed services.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/smartbus/src/main.tsx`, `artifacts/smartbus-mobile/app/_layout.tsx`, `artifacts/smartbus-mobile/server/serve.js`.
- **Highest-risk code areas**: `artifacts/api-server/src/routes/search.ts`, `artifacts/api-server/src/routes/stops.ts`, `artifacts/api-server/src/routes/buses.ts`, `lib/db/src/index.ts`.
- **Public surfaces**: all `/api/*` routes in `artifacts/api-server/src/routes/` and the mobile landing/static server.
- **No current authenticated/admin surface**: absence of auth is currently by product design because only public transit data is exposed.
- **Usually dev-only**: `artifacts/mockup-sandbox/`, `scripts/`, `artifacts/smartbus-mobile/scripts/`, generated build output under `dist/`.

## Threat Categories

### Tampering

The current product is read-heavy and has no public mutation endpoints, which limits classic business-logic tampering. The main guarantee here is that all request-derived values reaching route selection, file serving, and database access must be validated so attackers cannot influence code paths beyond intended search/filter behavior.

### Information Disclosure

The application mostly serves public transit data, so confidentiality risk is concentrated in infrastructure details rather than business records. Server-side environment variables, database connection strings, cookies, and future credentials must never be exposed to the client, logs, or error responses. Error handling must remain generic in production.

### Denial of Service

Denial of service is the most relevant threat category for this project. Every production endpoint is public, and some endpoints perform database-wide reads or repeated in-memory processing over large GTFS-derived datasets. The system must bound per-request work, avoid full-table scans for attacker-controlled queries where possible, and apply controls such as caching, pagination, request shaping, or rate limiting on expensive public endpoints.

### Elevation of Privilege

There is no current user/admin privilege model, so classic privilege-escalation issues are limited. The relevant guarantees are instead defensive coding guarantees: database access must remain parameterized, file-serving code must prevent traversal outside intended roots, and any future authenticated or administrative features must add server-side authorization rather than relying on current public-only assumptions.

### Spoofing

User impersonation is not a primary concern today because there are no accounts or sessions. The main spoofing-related requirement is that any future webhook, admin, or authenticated surface introduced later must not inherit the current "public by design" assumptions.
