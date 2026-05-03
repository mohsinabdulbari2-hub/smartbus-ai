import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { busRoutesTable, busStopsTable, routeStopsTable, busFrequencyTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { classifyBusType, type NormalizedBusType } from "../lib/busType.js";

const router: IRouter = Router();

type CrowdLevel = "Low" | "Medium" | "High" | "VeryHigh";

interface BusPosition {
  id: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  routeColor: string;
  busType: string;
  depot: string | null;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  nextStop: string;
  nextStopId: string;
  distanceToNextStop: number;
  crowdLevel: CrowdLevel;
  isLastBus: boolean;
  isOnline: boolean;
  lastUpdated: string;
  stopIndex: number;
  direction: number;
  progress: number;
  totalStops: number;
  stopsCovered: number;
  stopsRemaining: number;
  currentStop: string;
}

const busState = new Map<string, BusPosition>();
let initialized = false;

// Popularity weight per route: longer routes = busier corridors.
// Populated during initializeBuses(); falls back to 0 if missing.
const routePopularity = new Map<string, number>();

function getCrowdLevel(routeId: string, stopIndex: number): CrowdLevel {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // 1) Time-of-day demand (0..1)
  let timeFactor = 0.4;
  if (hour >= 8 && hour <= 10) timeFactor = 0.7;        // morning peak
  else if (hour >= 17 && hour <= 20) timeFactor = 0.72; // evening peak
  else if (hour >= 12 && hour <= 14) timeFactor = 0.5;  // lunch
  else if (hour >= 6 && hour < 8) timeFactor = 0.45;    // early morning
  else if (hour >= 21 || hour < 6) timeFactor = 0.2;    // night
  else timeFactor = 0.4;

  if (isWeekend) timeFactor *= 0.75;

  // 2) Route popularity boost (longer/major corridors carry more passengers).
  //    Normalized 0..0.18 — capped so it never overrides time-of-day.
  const popularity = Math.min(routePopularity.get(routeId) ?? 0, 1) * 0.18;

  // 3) Stop density boost: middle of the route is the busiest segment;
  //    endpoints are quieter. Triangular weighting in 0..0.12.
  let densityBoost = 0;
  const len = routePopularity.get(routeId);
  if (len && len > 1) {
    // Use stopIndex relative to a notional length anchor — peak at midpoint.
    const t = Math.min(1, Math.max(0, stopIndex / Math.max(1, (len * 30))));
    densityBoost = (1 - Math.abs(0.5 - t) * 2) * 0.12;
  } else {
    densityBoost = 0.05;
  }

  // 4) Per-bus pseudo-random jitter so buses on the same route differ.
  let h = 0;
  const seed = `${routeId}-${stopIndex}`;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const jitter = ((Math.abs(h) % 100) / 100) * 0.7 - 0.35; // -0.35..+0.35

  const score = timeFactor + popularity + densityBoost + jitter;

  if (score >= 0.9) return "VeryHigh";
  if (score >= 0.65) return "High";
  if (score >= 0.35) return "Medium";
  return "Low";
}

// Stable per-bus online flag — about 80% of buses are "running" at any time.
function getInitialOnline(busId: string): boolean {
  let h = 0;
  for (let i = 0; i < busId.length; i++) h = (h * 31 + busId.charCodeAt(i)) | 0;
  return Math.abs(h) % 10 >= 2; // ~80% online
}

function isLastBus(lastBusTime: string | null): boolean {
  if (!lastBusTime) return false;
  const now = new Date();
  const [hours, minutes] = lastBusTime.split(":").map(Number);
  const lastBus = new Date();
  lastBus.setHours(hours, minutes, 0, 0);
  const diffMs = lastBus.getTime() - now.getTime();
  return diffMs > 0 && diffMs < 45 * 60 * 1000;
}

// Cache route stop sequences in-memory (built once from a single bulk query)
let routeStopsCache: Map<string, Array<{ stop: typeof busStopsTable.$inferSelect; order: number }>> | null = null;

async function getRouteStopsCache() {
  if (routeStopsCache) return routeStopsCache;
  const rows = await db
    .select({ stop: busStopsTable, order: routeStopsTable.order, routeId: routeStopsTable.routeId })
    .from(routeStopsTable)
    .innerJoin(busStopsTable, eq(routeStopsTable.stopId, busStopsTable.id))
    .orderBy(routeStopsTable.order);
  const map = new Map<string, Array<{ stop: typeof busStopsTable.$inferSelect; order: number }>>();
  for (const r of rows) {
    let arr = map.get(r.routeId);
    if (!arr) { arr = []; map.set(r.routeId, arr); }
    arr.push({ stop: r.stop, order: r.order });
  }
  for (const arr of map.values()) arr.sort((a, b) => a.order - b.order);
  routeStopsCache = map;
  return map;
}

// How many routes do we simulate live buses for? With 4,200+ routes, simulating
// every one would create thousands of buses. Cap to a representative sample.
// 100 routes × 5 buses ≈ 500 live buses — large enough to feel like a city
// fleet, small enough to keep payloads under ~150KB.
const MAX_LIVE_ROUTES = 100;
const BUSES_PER_ROUTE = 5;

async function initializeBuses() {
  if (initialized) return;
  initialized = true;

  const allRoutes = await db.select().from(busRoutesTable);
  const cache = await getRouteStopsCache();

  // Annotate every route with its normalised type + stop count
  const annotated = allRoutes
    .map((r) => ({ route: r, type: classifyBusType(r as any), len: cache.get(r.id)?.length ?? 0 }))
    .filter((x) => x.len >= 5)
    .sort((a, b) => b.len - a.len);

  // Populate route popularity map (normalized stop count → 0..1).
  // Longer routes ≈ busier corridors → higher crowd weight.
  const maxLen = annotated.length > 0 ? annotated[0].len : 1;
  for (const x of annotated) {
    routePopularity.set(x.route.id, x.len / Math.max(1, maxLen));
  }

  // Pick a balanced sample so every filter chip has buses to show
  const TYPES: NormalizedBusType[] = ["Ordinary", "Vajra", "Volvo", "Airport", "MetroFeeder", "Night"];
  const PER_TYPE: Record<NormalizedBusType, number> = {
    Ordinary: 40, Vajra: 18, Volvo: 14, Airport: 10, MetroFeeder: 12, Night: 8,
  };
  const picked: Array<{ route: typeof allRoutes[number]; type: NormalizedBusType }> = [];
  for (const t of TYPES) {
    const pool = annotated.filter((x) => x.type === t).slice(0, PER_TYPE[t]);
    for (const x of pool) picked.push({ route: x.route, type: x.type });
  }
  // Top up with the longest remaining routes if any quota was short
  if (picked.length < MAX_LIVE_ROUTES) {
    const used = new Set(picked.map((p) => p.route.id));
    for (const x of annotated) {
      if (picked.length >= MAX_LIVE_ROUTES) break;
      if (!used.has(x.route.id)) picked.push({ route: x.route, type: x.type });
    }
  }
  const ranked = picked.slice(0, MAX_LIVE_ROUTES);

  const breakdown = ranked.reduce((acc, p) => { acc[p.type] = (acc[p.type] || 0) + 1; return acc; }, {} as Record<string, number>);
  console.log(`[buses] initializing ~${ranked.length * BUSES_PER_ROUTE} live buses across ${ranked.length} routes`, breakdown);

  for (const { route, type } of ranked) {
    const stops = cache.get(route.id) ?? [];
    if (stops.length < 2) continue;

    const numBuses = BUSES_PER_ROUTE;
    for (let i = 0; i < numBuses; i++) {
      // Spread starting positions evenly + small per-bus jitter so two buses
      // on the same route never start at the exact same stop.
      const baseFrac = i / numBuses;
      const jitterFrac = (Math.random() - 0.5) * (0.5 / numBuses);
      const stopIndex = Math.max(
        0,
        Math.min(stops.length - 2, Math.floor((baseFrac + jitterFrac) * (stops.length - 1))),
      );
      const currentStop = stops[stopIndex].stop;
      const nextStopIdx = Math.min(stopIndex + 1, stops.length - 1);
      const nextStop = stops[nextStopIdx].stop;

      // Speed varies by bus type
      const speedByType: Record<string, number> = {
        Ordinary: 22, Vajra: 30, Volvo: 35, Airport: 55, MetroFeeder: 25, Night: 28,
      };
      const baseSpeed = speedByType[type] ?? 25;

      const busId = `${route.id}-bus-${i}`;
      const online = getInitialOnline(busId);
      busState.set(busId, {
        id: busId,
        routeId: route.id,
        routeNumber: route.number,
        routeName: route.name,
        routeColor: route.color,
        busType: type,
        depot: (route as any).depot ?? null,
        lat: currentStop.lat,
        lng: currentStop.lng,
        speed: baseSpeed + Math.random() * 10,
        heading: 0,
        nextStop: nextStop.name,
        nextStopId: nextStop.id,
        distanceToNextStop: 500 + Math.random() * 1000,
        crowdLevel: getCrowdLevel(route.id, stopIndex),
        isLastBus: isLastBus(route.lastBusTime),
        isOnline: online,
        lastUpdated: new Date().toISOString(),
        stopIndex,
        direction: 1,
        progress: Math.random(),
        totalStops: stops.length,
        stopsCovered: stopIndex,
        stopsRemaining: stops.length - 1 - stopIndex,
        currentStop: currentStop.name,
      });
    }
  }
}

async function updateBusPositions() {
  const routeStopsCache = await getRouteStopsCache();

  for (const [busId, bus] of busState) {
    const stops = routeStopsCache.get(bus.routeId);
    if (!stops || stops.length < 2) continue;

    // Tiny chance per tick to flip online/offline (so the fleet feels alive).
    if (Math.random() < 0.01) bus.isOnline = !bus.isOnline;
    if (!bus.isOnline) {
      bus.lastUpdated = new Date().toISOString();
      continue; // offline buses don't move
    }

    bus.progress += 0.003 + Math.random() * 0.002;

    if (bus.progress >= 1) {
      bus.progress = 0;
      bus.stopIndex = (bus.stopIndex + bus.direction + stops.length) % stops.length;

      if (bus.stopIndex === stops.length - 1) bus.direction = -1;
      else if (bus.stopIndex === 0) bus.direction = 1;
    }

    const currentIdx = bus.stopIndex;
    const nextIdx = Math.min(currentIdx + 1, stops.length - 1);

    const from = stops[currentIdx].stop;
    const to = stops[nextIdx].stop;

    bus.lat = from.lat + (to.lat - from.lat) * bus.progress;
    bus.lng = from.lng + (to.lng - from.lng) * bus.progress;

    const dLat = to.lat - from.lat;
    const dLng = to.lng - from.lng;
    bus.heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;

    bus.nextStop = to.name;
    bus.nextStopId = to.id;
    bus.currentStop = from.name;
    bus.distanceToNextStop = Math.round((1 - bus.progress) * 1200);
    bus.crowdLevel = getCrowdLevel(bus.routeId, currentIdx);
    bus.totalStops = stops.length;
    // Stops covered along the current direction of travel
    bus.stopsCovered = bus.direction === 1 ? currentIdx : stops.length - 1 - currentIdx;
    bus.stopsRemaining = stops.length - 1 - bus.stopsCovered;

    const route = routes.find((r) => r.id === bus.routeId);
    bus.isLastBus = isLastBus(route?.lastBusTime ?? null);
    bus.lastUpdated = new Date().toISOString();
  }
}

setInterval(async () => {
  try {
    if (!initialized) await initializeBuses();
    await updateBusPositions();
  } catch {
  }
}, 2000);

// Simple haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

router.get("/live", async (req, res) => {
  try {
    if (!initialized) await initializeBuses();
    let buses = Array.from(busState.values());

    // Optional server-side filtering (keeps payload small; backward-compatible:
    // old clients that don't pass these get the full list as before).
    const { busType, lat, lng, radius, limit, offset } = req.query as Record<string, string>;

    if (busType && busType.toLowerCase() !== "all") {
      const want = busType.toLowerCase();
      buses = buses.filter((b) => b.busType.toLowerCase() === want);
    }

    if (lat && lng) {
      const la = parseFloat(lat);
      const ln = parseFloat(lng);
      const radKm = radius ? parseFloat(radius) : 8; // default 8 km
      if (!Number.isNaN(la) && !Number.isNaN(ln)) {
        // Annotate with distance once
        const withDist = buses.map((b) => ({ b, d: haversineKm(la, ln, b.lat, b.lng) }));
        let nearby = withDist.filter((x) => x.d <= radKm);
        // Fallback: if the requested radius yields nothing, return the 20
        // closest buses regardless — guarantees the "Nearby" screen never
        // shows an empty list when buses exist on the network.
        if (nearby.length === 0 && withDist.length > 0) {
          nearby = withDist.sort((a, b) => a.d - b.d).slice(0, 20);
        } else {
          nearby.sort((a, b) => a.d - b.d);
        }
        buses = nearby.map((x) => x.b);
      }
    }

    const total = buses.length;

    if (offset || limit) {
      const off = Math.max(0, parseInt(offset ?? "0", 10) || 0);
      const lim = Math.max(1, Math.min(200, parseInt(limit ?? "30", 10) || 30));
      buses = buses.slice(off, off + lim);
      // When pagination is requested, return an envelope so clients can know total.
      res.set("X-Total-Count", String(total));
    }

    res.json(buses);
  } catch (err) {
    req.log.error({ err }, "Error fetching live buses");
    res.status(500).json({ error: "Failed to fetch buses" });
  }
});

router.get("/:busId", async (req, res) => {
  try {
    if (!initialized) await initializeBuses();
    const bus = busState.get(req.params.busId);
    if (!bus) {
      res.status(404).json({ error: "Bus not found" });
      return;
    }
    res.json(bus);
  } catch (err) {
    req.log.error({ err }, "Error fetching bus");
    res.status(500).json({ error: "Failed to fetch bus" });
  }
});

export { initializeBuses, busState, getCrowdLevel, isLastBus as checkIsLastBus };
export default router;
