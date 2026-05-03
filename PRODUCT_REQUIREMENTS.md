# SmartBus AI — Product Requirements Document

## 1. Product Overview

**SmartBus AI** is a real-time bus tracking and crowd prediction platform for BMTC (Bangalore Metropolitan Transport Corporation), built with a three-tier architecture:

| Layer | Technology | Port |
|---|---|---|
| API Server | Express 5 + TypeScript + Drizzle ORM | 8080 |
| Web App | React 19 + Vite + Tailwind CSS v4 | 19337 |
| Mobile App | Expo / React Native (Expo Router v6) | 19356 |

**Positioning**: Rapido + Google Maps hybrid — live tracking aesthetics with BMTC-specific crowd intelligence.

---

## 2. Core User Stories

| # | As a… | I want to… | So that… |
|---|---|---|---|
| U1 | Commuter | See all live BMTC buses on a map | I know where the nearest bus is |
| U2 | Commuter | Know how crowded a bus is right now | I can choose a less crowded one |
| U3 | Commuter | Search from stop A to stop B | I find exactly which bus to board |
| U4 | Commuter | See the next bus ETA at my stop | I don't have to guess waiting time |
| U5 | Commuter | View bus frequency (morning/evening/night) | I can plan my travel time |
| U6 | Commuter | Get a last-bus warning | I don't get stranded at night |
| U7 | Planner | Browse all 4,200+ BMTC routes | I find new routes in the city |
| U8 | Commuter | Tap a route and see all stops + live status | I track exactly where my bus is |

---

## 3. Data Architecture

### 3.1 BMTC GTFS Dataset
- **Source**: https://github.com/Vonter/bmtc-gtfs (official BMTC GTFS feed)
- **Routes**: 4,208 real BMTC routes
- **Stops**: 8,475 unique stops with GPS coordinates
- **Shapes**: 4,208 route polylines (Douglas-Peucker simplified, ~50 pts each)
- **Reference stops**: 1,086 additional KGIS BMTC stops (appear on map, not in route detail)

### 3.2 Dataset Files
```
lib/db/src/data/
├── bmtc-routes.json         # 4,208 routes (1.9 MB)
├── bmtc-stops.json          # 8,475 stops (608 KB)
├── bmtc-shapes.json         # 4,208 polylines (4.1 MB)
└── bmtc-reference-stops.json # 1,086 KGIS stops (120 KB)
```

### 3.3 Database Schema (PostgreSQL + Drizzle ORM)

#### `bus_routes`
| Column | Type | Description |
|---|---|---|
| id | text PK | e.g. "r3447" |
| name | text | Route display name |
| number | text | BMTC route number (e.g. "500D") |
| from_stop | text | Origin terminal name |
| to_stop | text | Destination terminal name |
| color | text | Hex color for UI |
| total_stops | integer | Count of stops on route |
| last_bus_time | text | e.g. "22:30" |
| bus_type | text | Ordinary / Vajra / Volvo / Airport / MetroFeeder / Night |
| depot | text | Depot name (nullable) |
| distance_km | real | Haversine route distance |
| shape | jsonb | [[lat,lng], …] polyline |

#### `bus_stops`
| Column | Type | Description |
|---|---|---|
| id | text PK | e.g. "s1234" |
| name | text | Stop display name |
| lat | real | Latitude |
| lng | real | Longitude |
| zone | text | Central / North-East / North-West / South-East / South-West |

#### `route_stops`
| Column | Type | Description |
|---|---|---|
| route_id | text FK | References bus_routes.id |
| stop_id | text FK | References bus_stops.id |
| order | integer | Stop sequence index (0-based) |

#### `bus_frequency`
| Column | Type | Description |
|---|---|---|
| route_id | text FK | References bus_routes.id |
| day_type | text | "weekday" or "weekend" |
| morning | real | Buses/hr, 6–10am |
| afternoon | real | Buses/hr, 11–3pm |
| evening | real | Buses/hr, 4–8pm (peak) |
| night | real | Buses/hr, 9pm+ |

**Frequency baselines by bus type (midday reference, buses/hr):**
| Type | Base | Weekday morning | Weekday evening | Weekend evening |
|---|---|---|---|---|
| Ordinary | 7 | 11 | 13 | 8 |
| MetroFeeder | 5 | 8 | 9 | 6 |
| Vajra | 3 | 5 | 5 | 4 |
| Volvo | 3 | 5 | 5 | 4 |
| Airport | 2 | 3 | 4 | 2 |
| Night | 2 | 3 | 4 | 2 |

Weekend = 65% of weekday. Time multipliers: morning ×1.5, afternoon ×1.0, evening ×1.8, night ×0.35.

---

## 4. Live Bus Simulation

### 4.1 Fleet Composition
- **700 simulated buses** across 300 routes (200 major × 3 buses + 100 minor × 1)
- Bus type distribution: Ordinary 160, Vajra 50, MetroFeeder 36, Night 24, Airport 25, Volvo 5

### 4.2 Bus State Machine
Each bus has:
- `routeId`, `stopIndex` (current stop), `direction` (1=forward, -1=reverse)
- `speed` (km/h): 8–45 depending on stop position and time
- `distanceToNextStop` (metres): counts down, resets at stop arrival
- `crowdLevel`: Low | Medium | High | VeryHigh
- `status`: At_Stop | Approaching | Departed | Upcoming
- `isLastBus`: true after last-bus time for that route

### 4.3 Crowd Prediction Model (PHASE 1 → PHASE 2)

**PHASE 1 — Raw score calculation:**
1. **Base**: 0.45 (45% occupancy neutral)
2. **Time multiplier** (by hour bracket):
   - Early morning 5–6am: ×0.55
   - Morning peak 7–9am: ×1.35
   - Mid-morning 10–11am: ×1.10
   - Midday 12–1pm: ×1.20 (office lunch)
   - Afternoon 2–4pm: ×0.95
   - Evening peak 5–8pm: ×1.40 (highest)
   - Early evening 4–5pm: ×1.25
   - Night 9–10pm: ×0.80
   - Late night 11pm+: ×0.50
3. **Direction bias**: toward city centre ×1.12 (morning), away ×1.18 (evening)
4. **Route tier**: Tier-1 major corridors ×1.25, Tier-2 ×1.10, Tier-3 minor ×0.90
5. **Hotspot stops**: MG Road, Majestic, Marathahalli etc. get +0.18 to +0.28 boost
6. **Rain**: deterministic seed by day+hour, ~26% of blocks get ×1.15 wet weather surge

**PHASE 2 — Realism shaping:**
1. Downward bias: ×0.85 (BMTC buses rarely fully packed)
2. 30% of stops randomly inject low crowd: score ×0.45
3. 10% of stops inject spike: ×1.25
4. Gaussian jitter: ±0.20
5. Night cap: max 0.5 after 10pm
6. Hard clamp: 0.0 – 0.95

**Thresholds**: Low <0.35, Medium <0.60, High <0.80, VeryHigh ≥0.80

### 4.4 Frequency Fusion
Live observed frequency is fused with the DB baseline:
```
weight = live_bus_count >= 4 → 0.50
         live_bus_count >= 2 → 0.35
         else                → 0.20

freq = baseline × (1 - weight) + live_observed × weight
freq = min(freq, time_ceiling)
```
Time ceiling uses `getBaselineFreq(hour, isWeekend)` — BMTC-realistic values (3–17 buses/hr range).

---

## 5. API Specification

### Base URL: `GET /api`

#### `GET /api/buses/live`
Returns live bus positions. Supports viewport filtering.

**Query params:**
| Param | Type | Description |
|---|---|---|
| lat_min, lat_max, lng_min, lng_max | number | Viewport bbox filter |
| limit | number | Max buses returned (server cap: 100) |
| lat, lng, radius | number | Legacy radial filter |

**Response header**: `X-Total-Count: 700`

**Response body**: `LiveBus[]`
```typescript
interface LiveBus {
  id: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  busType: string;
  lat: number;
  lng: number;
  speed: number;              // km/h
  heading: number;            // degrees
  crowdLevel: "Low" | "Medium" | "High" | "VeryHigh";
  status: "At_Stop" | "Approaching" | "Departed" | "Upcoming";
  currentStop: string;
  nextStop: string;
  distanceToNextStop: number; // metres
  stopsCovered: number;
  stopsRemaining: number;
  totalStops: number;
  isLastBus: boolean;
  direction: number;          // 1 or -1
  stopIndex: number;
}
```

#### `GET /api/routes`
All routes. Returns `BusRoute[]`.

#### `GET /api/routes/:id`
Route detail with all stops, per-stop live status and ETA.

**Response**: `BusRouteDetail` with `stops: RouteStop[]`
```typescript
interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  liveStatus?: "AtStop" | "Departed" | "Upcoming";
  etaMinutes?: number;
  isNextStop?: boolean;
}
```

**Stop status logic:**
- `AtStop` — a bus has `stopIndex === i`
- `Upcoming` — a bus is heading toward stop (ETA = route km / max(8, bus.speed) × 60)
- `Departed` — no bus approaching from any direction

#### `GET /api/routes/:id/frequency?dayType=weekday|weekend`
Frequency chart data for the route.

**Response**: `FrequencyData`
```typescript
interface FrequencyData {
  routeId: string;
  dayType: string;
  morning: number;   // buses/hr, 6–10am
  afternoon: number; // buses/hr, 11–3pm
  evening: number;   // buses/hr, 4–8pm (always highest)
  night: number;     // buses/hr, 9pm+ (always lowest)
}
```

#### `GET /api/stops`
All 9,561 stops (8,475 GTFS + 1,086 KGIS reference).

#### `GET /api/stops/:id/eta`
Upcoming buses at a stop with ETA and crowd level.

#### `GET /api/stops/:id/crowd`
Crowd prediction for a stop.

#### `GET /api/search?source=X&destination=Y`
Fuzzy route search. Uses token + Levenshtein ≤1/2 matching.

---

## 6. Web App Features

### Map (LiveMap.tsx)
- **Tiles**: CARTO dark_nolabels (no API key required)
- **Markers**: Viewport-culled, max 100 bus icons on screen
- **Interaction**: Click bus → floating bottom panel with route info, frequency, crowd
- **Route highlight**: Selected bus route polyline rendered in route colour
- **Frequency display**: Fused live + DB frequency shown as `~N/hr`
- **Stop markers**: CircleMarkers for all stops, highlighted for selected route

### Sidebar
- Route list with live bus count
- Frequency bar chart (Recharts) — weekday/weekend toggle
- Crowd meter

### Search
- Source → destination text search
- Fuzzy suggestions when no exact match ("majstic" → "Majestic")

---

## 7. Mobile App Features

### Tab 1: Live Fleet (Home)
- KPI cards: Live buses, Active routes, Avg speed
- Live bus cards with crowd badge, speed, route info
- Auto-refreshes every 8 seconds
- Smart suggestions (popular routes at this hour)

### Tab 2: Journey Planner (Search)
- FROM / TO stop search with swap button
- Popular journey quick-pick cards (2×2 grid)
- Results with ETA number display and crowd badge

### Tab 3: Routes Directory
- Filter chips: All / Ordinary / Vajra / Volvo / Airport / MetroFeeder / Night
- Typo-tolerant live search (client-side fuzzy matching)
- Route cards with 62×62 number badge, from/to path, meta pills

### Route Detail (`/route/[id]`)
- Hero card: route number, name, endpoints, bus type badge
- Real-road mini-map (GTFS polyline, no API key)
- Live buses section with progress bar
- **Frequency chart**: weekday/weekend toggle, 4 time slots with animated progress bars
- Live frequency fusion banner (when buses are observed)
- All stops timeline with live status pills and ETA

### Stop Detail (`/stop/[id]`)
- Upcoming buses with ETA and crowd level

---

## 8. Premium UI Design System (Mobile)

### Colour Tokens
| Token | Value | Usage |
|---|---|---|
| background | #0F172A | Screen background |
| surface | #1E293B | Card background |
| primary | #2563EB | Primary actions |
| secondary | #7C3AED | Secondary accents |
| success | #22c55e | Low crowd / arrived |
| warning | #f59e0b | Medium crowd / next stop |
| danger | #ef4444 | High crowd |
| textPrimary | #F1F5F9 | Main text |
| textMuted | #64748B | Secondary text |

### Primitive Components
| Component | File | Description |
|---|---|---|
| Card | `components/ui/Card.tsx` | Rounded dark surface with optional glow border |
| Badge | `components/ui/Badge.tsx` | Pill with icon + label, 4 variants |
| Button | `components/ui/Button.tsx` | Gradient primary / outline / ghost |
| PulseDot | `components/ui/PulseDot.tsx` | Animated live indicator |
| AnimatedProgress | `components/ui/AnimatedProgress.tsx` | Gradient progress bar (Reanimated) |
| Skeleton | `components/ui/Skeleton.tsx` | Loading placeholder |
| CrowdMeter | `components/ui/CrowdMeter.tsx` | Visual occupancy meter |
| RouteMiniMap | `components/ui/RouteMiniMap.tsx` | SVG polyline mini-map |
| SmartSuggestion | `components/ui/SmartSuggestion.tsx` | AI-style suggestion chip |
| CrowdBadge | `components/CrowdBadge.tsx` | Low/Medium/High/VeryHigh pill |

---

## 9. Re-Import Data Pipeline

To re-import fresh BMTC GTFS data:
```bash
# 1. Download and extract GTFS zip to /tmp/bmtc_extract/
python3 scripts/convert_gtfs.py

# 2. Push schema changes (if any)
pnpm --filter @workspace/db push

# 3. Seed the database
pnpm --filter @workspace/scripts run seed

# 4. Restart API server (clears in-memory bus state)
# Restart the "API Server" workflow
```

---

## 10. Project Setup & Run

### Prerequisites
- Node.js 24+
- pnpm 9+
- PostgreSQL database (connection string in `DATABASE_URL` env var)

### Environment Variables
| Variable | Required | Description |
|---|---|---|
| DATABASE_URL | Yes | PostgreSQL connection string |
| PORT | No | API server port (default 8080) |
| EXPO_PUBLIC_DOMAIN | Yes (mobile) | API server domain for Expo |

### Install & Run
```bash
# Install all dependencies
pnpm install

# Seed the database (first run)
pnpm --filter @workspace/scripts run seed

# Start all services
pnpm --filter @workspace/api-server run dev   # API on :8080
pnpm --filter @workspace/smartbus run dev      # Web on :19337
pnpm --filter @workspace/smartbus-mobile run dev # Mobile on :19356
```

### After API Code Changes
The live bus state is held **in-memory** — restart the API server after any backend change to reinitialize the fleet.

---

## 11. Folder Structure

```
smartbus-ai/
├── artifacts/
│   ├── api-server/
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point
│   │   │   ├── app.ts                # Express app setup
│   │   │   ├── routes/
│   │   │   │   ├── buses.ts          # Live bus state + crowd logic
│   │   │   │   ├── routes.ts         # Route endpoints + stop status
│   │   │   │   ├── stops.ts          # Stop ETA + crowd endpoints
│   │   │   │   ├── search.ts         # Fuzzy search endpoint
│   │   │   │   └── index.ts          # Router mount
│   │   │   └── lib/
│   │   │       ├── busType.ts        # Bus type classifier
│   │   │       ├── fuzzy.ts          # Levenshtein fuzzy matching
│   │   │       └── logger.ts         # Pino logger
│   │   ├── package.json
│   │   └── build.mjs
│   │
│   ├── smartbus/                     # React + Vite web app
│   │   └── src/
│   │       ├── components/
│   │       │   └── map/LiveMap.tsx   # Main map component
│   │       ├── lib/
│   │       │   └── frequency.ts      # fuseFrequency + getBaselineFreq
│   │       └── hooks/
│   │           └── use-geolocation.ts
│   │
│   └── smartbus-mobile/              # Expo React Native
│       ├── app/
│       │   ├── (tabs)/
│       │   │   ├── index.tsx         # Live Fleet tab
│       │   │   ├── search.tsx        # Journey Planner tab
│       │   │   └── routes.tsx        # Routes Directory tab
│       │   ├── route/[id].tsx        # Route detail
│       │   └── stop/[id].tsx         # Stop arrivals
│       ├── components/
│       │   ├── CrowdBadge.tsx
│       │   └── ui/                   # Design system primitives
│       ├── constants/
│       │   ├── colors.ts             # Dark theme palette
│       │   └── theme.ts              # Spacing, typography, radius
│       └── lib/
│           ├── api.ts                # API client
│           ├── frequency.ts          # getBaselineFreq, fuseFrequency
│           └── fuzzy.ts              # Client-side fuzzy matching
│
├── lib/
│   ├── api-spec/                     # OpenAPI 3.0 spec
│   ├── api-client-react/             # Orval-generated React Query hooks
│   ├── api-zod/                      # Orval-generated Zod schemas
│   └── db/
│       ├── src/
│       │   ├── schema/routes.ts      # Drizzle table definitions
│       │   └── data/                 # JSON datasets (BMTC GTFS)
│       └── drizzle.config.ts
│
└── scripts/
    └── src/
        ├── seed.ts                   # DB seed from JSON datasets
        └── hello.ts
```

---

## 12. Known Constraints & Design Decisions

| Decision | Rationale |
|---|---|
| No Google Maps API | Uses CARTO tiles (free, no key) + GTFS polylines for real road shapes |
| In-memory bus simulation | BMTC doesn't publish a real-time GTFS-RT feed; simulation calibrated to real patterns |
| Crowd = computed, not measured | No passenger count sensor data; uses time/route/stop heuristics |
| Frequency = synthetic | BMTC doesn't publish per-route timetables; values derived from route type and BMTC operational patterns |
| Viewport culling | 700 buses rendered naively would freeze the map; hard cap of 100 markers with bbox filtering |
| Weekend −35% frequency | BMTC operates reduced service on Sundays (school/office closures) |
| Evening peak = highest | 4–8pm has highest BMTC ridership (office + school return) |

---

*Last updated: May 2026 — SmartBus AI v1.0*
