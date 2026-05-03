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
- **Frontend (web)**: React + Vite + Tailwind CSS v4
- **Mobile**: Expo / React Native (Expo Router, react-query, react-native-svg, expo-blur, expo-haptics, expo-linear-gradient, react-native-reanimated 4)
- **Map**: react-leaflet (web) + custom SVG mini-map (mobile, no API key) — mobile mini-map renders the **real GTFS-derived road polyline** (Douglas-Peucker simplified to ~50 pts/route) when available, falling back to a Bezier curve through stop coords. Web `LiveMap` uses CARTO `dark_nolabels` tiles, viewport-culled minimal markers (max 100), in-memory route shape cache, click-to-select polyline highlighting, and a floating bottom info panel.
- **Charts**: Recharts (frequency bar charts)
- **Animations**: framer-motion (web), react-native-reanimated (mobile)
- **Mobile UI theme**: Premium dark palette — bg #0F172A, surface #1E293B, primary #2563EB, secondary #7C3AED. Reusable tokens in `artifacts/smartbus-mobile/constants/{colors,theme}.ts` and primitives in `artifacts/smartbus-mobile/components/ui/*` (Card, Badge, Button, PulseDot, AnimatedProgress, Skeleton, CrowdMeter, RouteMiniMap, SmartSuggestion).

## Features

- **Live Bus Tracking** — animated bus icons moving on Leaflet map, polled every 3s
- **ETA Prediction** — arrival times based on distance and speed
- **Crowd Prediction** — Low/Medium/High based on time of day, day type, route
- **Bus Frequency** — weekday vs weekend chart (morning/afternoon/evening/night)
- **Last Bus Alert** — warns when a bus is the last one for the night
- **Route Search** — search by source → destination, with **fuzzy "Routes that look similar" suggestions** in the empty state (uses cached `getRoutes` data + client-side fuzzy ranking)
- **Route Detail** — stops list + frequency chart, **per-stop live status (Departed / At stop / Upcoming) + per-stop ETA** computed from all live buses on the route (bidirection-aware via `bus.direction`); next stop highlighted; route detail auto-refreshes every 15s without flicker
- **Typo-tolerant routes filter** — Routes tab uses client-side `fuzzyMatch` (token + Levenshtein ≤1/2) on name/from/to so "majstic" finds "Majestic", "indrangr" finds "Indiranagar", etc. Helper at `artifacts/smartbus-mobile/lib/fuzzy.ts` mirrors a slim subset of the server's `fuzzy.ts` (used by `/search`).
- **Flicker-free polling** — every refetching query (live buses 8s/12s, route detail 15s, routes catalog) uses `placeholderData: (prev) => prev` so the previous frame stays mounted during background refetch.
- **Real road polylines** — each route in the DB carries a `shape jsonb` column ([[lat,lng], …]) sourced from BMTC GTFS `shapes.txt` and Douglas-Peucker simplified by `scripts/convert_gtfs.py`. `RouteMiniMap` draws the polyline directly when present.

## BMTC GTFS data pipeline

Source feed: https://github.com/Vonter/bmtc-gtfs (zip in `attached_assets/`).
Converter: `scripts/convert_gtfs.py` reads the GTFS txt files extracted to `/tmp/bmtc_extract/` and writes:
- `lib/db/src/data/bmtc-stops.json` — 8,475 stops with lat/lng (only stops used by ≥1 route are emitted)
- `lib/db/src/data/bmtc-routes.json` — 4,208 routes; each route picks its longest UP-direction trip as the representative stop sequence
- `lib/db/src/data/bmtc-shapes.json` — 4,208 polylines, simplified to avg 50 pts each (~4 MB total)

Re-import workflow: `python3 scripts/convert_gtfs.py` → `pnpm --filter @workspace/db push` → `pnpm --filter @workspace/scripts seed` → restart api-server.
- **Stop Detail** — upcoming buses with ETA and crowd level

## Stop status & ETA logic

Implemented in `artifacts/api-server/src/routes/routes.ts` (GET `/:routeId`):
- Pre-computes cumulative km between consecutive stops via haversine.
- For each stop, scans all online live buses on the route:
  - `bus.stopIndex === i` → **AtStop**
  - bus is heading toward stop (forward dir + `i > stopIndex`, or reverse dir + `i < stopIndex`) → **Upcoming**, ETA = (km along route) / max(8, bus.speed) × 60
  - else → contributes to "passed" count
- Priority: `AtStop` > `Upcoming` (any direction) > `Departed` (only when no bus is approaching from any direction).
- Server exports `busState` from `buses.ts` for cross-module access. `RouteStop` type in mobile `lib/api.ts` carries optional `liveStatus`, `etaMinutes`, `isNextStop`. Mobile route detail screen renders status as a pill on the existing stop row (no layout change).

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
