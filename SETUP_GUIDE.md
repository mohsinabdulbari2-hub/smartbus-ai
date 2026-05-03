# SmartBus AI — Complete Setup & Deployment Guide

## What You're Getting

A full-stack bus tracking system with:
- **Express API server** — live bus simulation, crowd prediction, BMTC GTFS data
- **React web app** — live map with bus tracking, frequency charts
- **Expo mobile app** — iOS/Android app with journey planner, route browser

---

## System Requirements

| Tool | Minimum version | Install |
|---|---|---|
| Node.js | 24.x | https://nodejs.org |
| pnpm | 9.x | `npm install -g pnpm` |
| PostgreSQL | 14+ | https://postgresql.org |
| Python | 3.8+ | For GTFS re-import (optional) |

---

## Step 1 — Extract & Install

```bash
# Unzip the archive
unzip smartbus-ai-full.zip -d smartbus-ai
cd smartbus-ai

# Install all dependencies across all packages
pnpm install
```

---

## Step 2 — Create PostgreSQL Database

```bash
# On Linux/Mac with PostgreSQL installed locally:
createdb smartbus_ai

# Or via psql:
psql -U postgres -c "CREATE DATABASE smartbus_ai;"
```

---

## Step 3 — Configure Environment Variables

Create the following `.env` files:

### `artifacts/api-server/.env`
```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/smartbus_ai
PORT=8080
NODE_ENV=development
```

### `artifacts/smartbus/.env`
```env
VITE_API_BASE_URL=http://localhost:8080
```

### `artifacts/smartbus-mobile/.env`
```env
EXPO_PUBLIC_DOMAIN=localhost:8080
```

> **Cloud/hosted PostgreSQL**: Replace `DATABASE_URL` with your connection string from
> Supabase, Neon, Railway, PlanetScale, or any managed Postgres provider.

---

## Step 4 — Push Database Schema

```bash
# Creates all 4 tables: bus_routes, bus_stops, route_stops, bus_frequency
pnpm --filter @workspace/db push
```

---

## Step 5 — Seed the Database

```bash
# Loads 4,208 routes, 8,475 stops, 4,208 shapes, 8,416 frequency rows
pnpm --filter @workspace/scripts run seed
```

Expected output:
```
🚌 Seeding SmartBus AI from official BMTC GTFS data
   4,208 routes, 8,475 stops
Clearing existing data...
Inserting stops...
Inserting routes...
Inserting route ↔ stop edges...
   122,860 edges
Inserting bus frequencies...
Inserting 1,086 reference stops…
✅ Seed complete!
```

---

## Step 6 — Run Everything

Open **3 terminal windows**:

**Terminal 1 — API Server**
```bash
pnpm --filter @workspace/api-server run dev
# Running at http://localhost:8080
```

**Terminal 2 — Web App**
```bash
pnpm --filter @workspace/smartbus run dev
# Running at http://localhost:19337
```

**Terminal 3 — Mobile App**
```bash
pnpm --filter @workspace/smartbus-mobile run dev
# Running at http://localhost:19356 (web preview)
# Scan QR code with Expo Go app for real device
```

---

## Verify It's Working

```bash
# Check API health
curl http://localhost:8080/api/health

# Get live buses
curl http://localhost:8080/api/buses/live | python3 -m json.tool | head -40

# Get a route's frequency
curl "http://localhost:8080/api/routes/r3447/frequency?dayType=weekday"
```

---

## Deployment Options

### Option A — Replit (Easiest, Zero Config)
1. Create a free account at https://replit.com
2. Create a new Repl → Import from ZIP
3. Add a PostgreSQL integration from the Integrations panel
4. The `DATABASE_URL` env var is set automatically
5. Run `pnpm install` in the Shell
6. Run `pnpm --filter @workspace/db push` to create tables
7. Run `pnpm --filter @workspace/scripts run seed`
8. Start each workflow from the Workflows panel

### Option B — Railway (Full Stack, Free Tier)
1. Go to https://railway.app → New Project
2. Add PostgreSQL service (Railway provides `DATABASE_URL`)
3. Add a new service → Deploy from GitHub / upload files
4. Set environment variables in Railway dashboard
5. Set start command: `pnpm --filter @workspace/api-server run start`
6. The seed runs once via the shell tab

### Option C — Render.com
1. Create a PostgreSQL database at https://render.com (free tier available)
2. Create a new Web Service → connect your repo
3. Build command: `pnpm install && pnpm --filter @workspace/db push && pnpm --filter @workspace/scripts run seed`
4. Start command: `pnpm --filter @workspace/api-server run start`
5. Add env var `DATABASE_URL` from the Render PostgreSQL dashboard

### Option D — Local Docker (Self-Hosted)
```bash
# Start PostgreSQL via Docker
docker run -d \
  --name smartbus-db \
  -e POSTGRES_DB=smartbus_ai \
  -e POSTGRES_PASSWORD=secret \
  -p 5432:5432 \
  postgres:16

# Set env, push schema, seed, run
export DATABASE_URL="postgresql://postgres:secret@localhost:5432/smartbus_ai"
pnpm --filter @workspace/db push
pnpm --filter @workspace/scripts run seed
pnpm --filter @workspace/api-server run dev
```

### Option E — VPS (AWS / DigitalOcean / Hetzner)
```bash
# On the server:
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs postgresql
npm install -g pnpm

# Create DB
sudo -u postgres createdb smartbus_ai
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'yourpassword';"

# Upload your project files (scp / git clone)
# Then:
export DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/smartbus_ai"
pnpm install
pnpm --filter @workspace/db push
pnpm --filter @workspace/scripts run seed

# Run with PM2 (process manager)
npm install -g pm2
pm2 start "pnpm --filter @workspace/api-server run start" --name api
pm2 start "pnpm --filter @workspace/smartbus run preview" --name web
pm2 save
```

---

## Mobile App — Real Device (Expo Go)

1. Install **Expo Go** on your phone (iOS App Store or Google Play)
2. In `artifacts/smartbus-mobile/.env`, set:
   ```env
   EXPO_PUBLIC_DOMAIN=<your-machine-ip>:8080
   ```
   (Find your IP: `ipconfig` on Windows, `ifconfig` on Mac/Linux)
3. Run `pnpm --filter @workspace/smartbus-mobile run dev`
4. Scan the QR code with Expo Go

---

## Mobile App — Build APK/IPA (Production)

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Configure build
cd artifacts/smartbus-mobile
eas build:configure

# Android APK
eas build --platform android --profile preview

# iOS (requires Apple Developer account)
eas build --platform ios
```

---

## Updating BMTC Data (Optional)

If BMTC releases a new GTFS feed:
```bash
# 1. Download latest GTFS from https://github.com/Vonter/bmtc-gtfs
#    Extract to /tmp/bmtc_extract/

# 2. Run the converter
python3 scripts/convert_gtfs.py

# 3. Push schema (if changed)
pnpm --filter @workspace/db push

# 4. Re-seed
pnpm --filter @workspace/scripts run seed

# 5. Restart API server (clears in-memory bus state)
```

---

## Project Structure Quick Reference

```
smartbus-ai/
├── artifacts/
│   ├── api-server/          ← Express backend (PORT 8080)
│   │   └── src/
│   │       ├── routes/buses.ts    ← Live bus simulation + crowd logic
│   │       ├── routes/routes.ts   ← Route + stop endpoints
│   │       └── routes/stops.ts    ← Stop ETA + crowd endpoints
│   │
│   ├── smartbus/            ← React web app (PORT 19337)
│   │   └── src/
│   │       └── components/map/LiveMap.tsx  ← Main map
│   │
│   └── smartbus-mobile/     ← Expo mobile app (PORT 19356)
│       └── app/
│           ├── (tabs)/index.tsx    ← Live Fleet
│           ├── (tabs)/search.tsx   ← Journey Planner
│           ├── (tabs)/routes.tsx   ← Routes Directory
│           ├── route/[id].tsx      ← Route Detail
│           └── stop/[id].tsx       ← Stop Arrivals
│
├── lib/
│   ├── db/src/
│   │   ├── schema/routes.ts   ← Database table definitions
│   │   └── data/              ← BMTC JSON datasets (4,208 routes)
│   ├── api-spec/              ← OpenAPI 3.0 spec
│   └── api-client-react/      ← Auto-generated React Query hooks
│
└── scripts/
    └── src/seed.ts            ← Database seeder
```

---

## Common Issues & Fixes

| Error | Fix |
|---|---|
| `DATABASE_URL not set` | Create the `.env` file in `artifacts/api-server/` |
| `relation "bus_routes" does not exist` | Run `pnpm --filter @workspace/db push` first |
| `No frequency data` (404) | Run the seed script — DB is empty |
| Mobile app can't reach API | Set `EXPO_PUBLIC_DOMAIN` to your machine's LAN IP, not localhost |
| Map is blank | The CARTO tile server requires internet access |
| `Bus frequency` chart shows wrong values | Restart API server after schema/seed changes |

---

## Tech Stack Summary

| Layer | Libraries |
|---|---|
| API | Express 5, Drizzle ORM, Pino logger, Zod |
| Web | React 19, Vite 7, Tailwind CSS v4, react-leaflet, Recharts, Framer Motion |
| Mobile | Expo Router v6, React Native, expo-linear-gradient, expo-haptics, react-native-reanimated 4 |
| Database | PostgreSQL 14+, Drizzle ORM |
| Codegen | Orval (OpenAPI → React Query hooks + Zod schemas) |
| Monorepo | pnpm workspaces, TypeScript 5.9 |

---

*SmartBus AI v1.0 — Built for BMTC Bangalore | May 2026*
