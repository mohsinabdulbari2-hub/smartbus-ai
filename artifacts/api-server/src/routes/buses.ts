import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { busRoutesTable, busStopsTable, routeStopsTable, busFrequencyTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { classifyBusType, type NormalizedBusType } from "../lib/busType.js";

const router: IRouter = Router();

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
  crowdLevel: "Low" | "Medium" | "High";
  isLastBus: boolean;
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

function getCrowdLevel(routeId: string, stopIndex: number): "Low" | "Medium" | "High" {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Base "demand" varies by time of day (0..1)
  let timeFactor = 0.4;
  if (hour >= 8 && hour <= 10) timeFactor = 0.65;       // morning peak
  else if (hour >= 17 && hour <= 20) timeFactor = 0.65; // evening peak
  else if (hour >= 12 && hour <= 14) timeFactor = 0.5;  // lunch
  else if (hour >= 6 && hour < 8) timeFactor = 0.45;    // early morning
  else if (hour >= 21 || hour < 6) timeFactor = 0.2;    // night
  else timeFactor = 0.4;

  if (isWeekend) timeFactor *= 0.75;

  // Per-bus pseudo-random variation so different buses on the same route
  // don't all show the same crowd level (wide range so all 3 levels appear).
  let h = 0;
  const seed = `${routeId}-${stopIndex}`;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const jitter = ((Math.abs(h) % 100) / 100) * 0.8 - 0.4; // -0.4..+0.4

  const score = timeFactor + jitter;

  if (score >= 0.65) return "High";
  if (score >= 0.35) return "Medium";
  return "Low";
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
const MAX_LIVE_ROUTES = 80;
const BUSES_PER_ROUTE = 3;

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

  // Pick a balanced sample so every filter chip has buses to show
  const TYPES: NormalizedBusType[] = ["Ordinary", "Vajra", "Volvo", "Airport", "MetroFeeder", "Night"];
  const PER_TYPE: Record<NormalizedBusType, number> = {
    Ordinary: 30, Vajra: 14, Volvo: 12, Airport: 8, MetroFeeder: 10, Night: 6,
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
      const stopIndex = Math.floor((i / numBuses) * (stops.length - 1));
      const currentStop = stops[stopIndex].stop;
      const nextStopIdx = Math.min(stopIndex + 1, stops.length - 1);
      const nextStop = stops[nextStopIdx].stop;

      // Speed varies by bus type
      const speedByType: Record<string, number> = {
        Ordinary: 22, Vajra: 30, Volvo: 35, Airport: 55, MetroFeeder: 25, Night: 28,
      };
      const baseSpeed = speedByType[type] ?? 25;

      const busId = `${route.id}-bus-${i}`;
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

router.get("/live", async (req, res) => {
  try {
    if (!initialized) await initializeBuses();
    const buses = Array.from(busState.values());
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
