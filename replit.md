# SmartBus AI Workspace

## Overview

SmartBus AI is a live bus tracking and crowd prediction system inspired by Rapido + Google Maps, built for BMTC (Bangalore Metropolitan Transport Corporation) buses.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS v4
- **Map**: react-leaflet + OpenStreetMap (no API key needed)
- **Charts**: Recharts (frequency bar charts)
- **Animations**: framer-motion

## Features

- **Live Bus Tracking** — animated bus icons moving on Leaflet map, polled every 3s
- **ETA Prediction** — arrival times based on distance and speed
- **Crowd Prediction** — Low/Medium/High based on time of day, day type, route
- **Bus Frequency** — weekday vs weekend chart (morning/afternoon/evening/night)
- **Last Bus Alert** — warns when a bus is the last one for the night
- **Route Search** — search by source → destination
- **Route Detail** — stops list + frequency chart
- **Stop Detail** — upcoming buses with ETA and crowd level

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── smartbus/           # React+Vite frontend (SmartBus AI)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/
│   └── src/seed.ts         # BMTC route seed data script
```

## Database Schema

- `bus_routes` — route info (id, name, number, from, to, color, lastBusTime)
- `bus_stops` — stop info (id, name, lat, lng)
- `route_stops` — join table (routeId, stopId, order)
- `bus_frequency` — frequency per time period (weekday/weekend)

## BMTC Routes Seeded

500D, 356F, 201R, 401, 313C, KIA-9, 252, 600K — all major Bangalore routes

## Seed Data

Run: `pnpm --filter @workspace/scripts run seed`

## API Endpoints

- `GET /api/buses/live` — live bus positions (poll every 3s)
- `GET /api/routes` — all routes
- `GET /api/routes/:id` — route detail + stops
- `GET /api/routes/:id/frequency` — frequency by day type
- `GET /api/stops` — all stops
- `GET /api/stops/:id/eta` — ETA per stop
- `GET /api/stops/:id/crowd` — crowd prediction
- `GET /api/search?source=X&destination=Y` — route search
