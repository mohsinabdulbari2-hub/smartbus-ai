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

## Mobile App (Expo React Native)

- **Location**: `artifacts/smartbus-mobile/`
- **Port**: 19356, preview at `/mobile/`
- **Framework**: Expo Router v6 + React Native
- **API**: Direct fetch to `https://$EXPO_PUBLIC_DOMAIN/api`
- **Screens**: Live Fleet (Home), Search/Journey Planner, Routes Directory, Route Detail, Stop Detail
- **Fonts**: Inter (via @expo-google-fonts/inter)
- **Theme**: Dark navy #0a0f1e, orange #f97316 primary

Key files:
- `artifacts/smartbus-mobile/lib/api.ts` — custom fetch-based API client
- `artifacts/smartbus-mobile/constants/colors.ts` — dark theme palette
- `artifacts/smartbus-mobile/app/(tabs)/index.tsx` — Live fleet tab
- `artifacts/smartbus-mobile/app/(tabs)/search.tsx` — Journey planner
- `artifacts/smartbus-mobile/app/(tabs)/routes.tsx` — Routes grid
- `artifacts/smartbus-mobile/app/route/[id].tsx` — Route detail
- `artifacts/smartbus-mobile/app/stop/[id].tsx` — Stop arrivals

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   ├── smartbus/           # React+Vite frontend (port 19337)
│   └── smartbus-mobile/    # Expo React Native mobile app (port 19356)
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
