import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { busRoutesTable, busStopsTable, routeStopsTable, busFrequencyTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { classifyBusType, type NormalizedBusType } from "../lib/busType.js";

const router: IRouter = Router();

type CrowdLevel = "Low" | "Medium" | "High" | "VeryHigh";
type BusStatus = "At_Stop" | "Approaching" | "Departed" | "Upcoming";

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
  /** Live km/h reported to clients; modulated by approach-to-stop. */
  speed: number;
  /** Cruising speed for the bus; held constant from init. */
  baseSpeed: number;
  heading: number;
  nextStop: string;
  nextStopId: string;
  distanceToNextStop: number;
  crowdLevel: CrowdLevel;
  status: BusStatus;
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

// routeId → lastBusTime so the per-tick "is this the last bus?" check no
// longer depends on a stale module-level variable that was never defined.
const routeLastBusTime = new Map<string, string | null>();

// Compute per-bus operational status from distance + speed. The thresholds
// match the spec: At_Stop = ≤50m & <5 km/h, Approaching = ≤500m, Departed =
// just left the previous stop, otherwise Upcoming.
function computeStatus(
  distanceToNextStopMeters: number,
  speedKmh: number,
  progress: number,
): BusStatus {
  if (distanceToNextStopMeters <= 50 && speedKmh < 5) return "At_Stop";
  if (distanceToNextStopMeters <= 500) return "Approaching";
  if (progress < 0.1) return "Departed";
  return "Upcoming";
}

export const busState = new Map<string, BusPosition>();
let initialized = false;
// Shared promise gate so concurrent /live requests during cold-start don't see
// a partially populated busState (architect-flagged init race).
let initializationPromise: Promise<void> | null = null;
function ensureInitialized(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (!initializationPromise) {
    initializationPromise = initializeBuses().catch((err) => {
      // On failure, allow a future caller to retry.
      initializationPromise = null;
      throw err;
    });
  }
  return initializationPromise;
}

// Popularity weight per route: longer routes = busier corridors.
// Populated during initializeBuses(); falls back to 0 if missing.
const routePopularity = new Map<string, number>();

// ── BMTC Route tiers ────────────────────────────────────────────────────────
// High-traffic BMTC routes (Silk Board corridor, Majestic trunk services, etc.)
const ROUTE_TIER_HIGH = new Set(["356M","356","KBS-1","KBS-5H","500D","500C","G-2","G-6","401G","500K"]);
const ROUTE_TIER_MED  = new Set(["201","215","600","401","402","250","210","221"]);
function getRouteFactor(routeNumber: string): number {
  if (ROUTE_TIER_HIGH.has(routeNumber)) return 1.25;
  if (ROUTE_TIER_MED.has(routeNumber))  return 1.10;
  return 0.90;
}

// ── Bangalore hotspot areas ──────────────────────────────────────────────────
const AREA_FACTORS: [string, number][] = [
  ["silk board",     1.25],
  ["majestic",       1.30],
  ["kr market",      1.20],
  ["kempegowda",     1.20],
  ["shivajinagar",   1.20],
  ["electronic city",1.15],
  ["marathahalli",   1.15],
  ["whitefield",     1.10],
  ["koramangala",    1.10],
];
function getHotspotFactor(stopName: string): number {
  const lower = stopName.toLowerCase();
  for (const [kw, f] of AREA_FACTORS) if (lower.includes(kw)) return f;
  return 1.0;
}

// ── Deterministic rain simulation ────────────────────────────────────────────
// No external API — uses day-of-year + 3-hour block as a stable seed.
// Result: ~26% of 3-hour slots are "rainy" (realistic for Bangalore).
let _rainCache = { ts: 0, value: false };
function isRaining(): boolean {
  const now = Date.now();
  if (now - _rainCache.ts < 10_000) return _rainCache.value;
  const d = new Date();
  const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
  const block = Math.floor(d.getHours() / 3);
  _rainCache = { ts: now, value: ((doy * 17 + block * 7) % 31) < 8 };
  return _rainCache.value;
}

function getCrowdLevel(routeId: string, stopIndex: number, direction: number = 1, routeNumber: string = "", stopName: string = ""): CrowdLevel {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  // BMTC time slots: 6-10 morning peak, 10-16 midday, 16-21 evening peak, rest night
  const isMorningPeak = hour >= 6 && hour < 10;
  const isEveningPeak = hour >= 16 && hour < 21;
  const isNight       = hour < 6 || hour >= 21;

  // 1) Base time factor (BMTC-tuned)
  let timeFactor: number;
  if (isMorningPeak)                        timeFactor = 0.55;
  else if (isEveningPeak)                   timeFactor = 0.55;
  else if (hour >= 10 && hour < 16)         timeFactor = 0.25; // midday
  else                                      timeFactor = 0.12; // night

  if (isWeekend) timeFactor *= 0.70;

  // 2) Direction bias (Bangalore commute flow)
  if (isMorningPeak && direction === 1)  timeFactor *= 1.2;
  if (isEveningPeak && direction === -1) timeFactor *= 1.2;

  // 3) Popularity-based density (0.8–1.2)
  const pop = Math.min(routePopularity.get(routeId) ?? 0, 1);
  const routeDensity = 0.8 + pop * 0.4;
  const popularity   = pop * 0.08;

  // 4) Stop position boost (busier in middle of route)
  let densityBoost = 0.02;
  if (pop > 0) {
    const t = Math.min(1, Math.max(0, stopIndex / Math.max(1, pop * 30)));
    densityBoost = (1 - Math.abs(0.5 - t) * 2) * 0.06;
  }

  // ── PHASE 1: ALL REALISM MULTIPLIERS (applied in full before any distribution) ──

  // 5) Base load from time + popularity + stop position
  let load = (timeFactor + popularity + densityBoost) * routeDensity;

  // 6) BMTC route-tier multiplier (named routes are busier)
  load *= getRouteFactor(routeNumber);

  // 7) Hotspot area boost (Silk Board, Majestic, etc.)
  load *= getHotspotFactor(stopName);

  // 8) Rain boost — applied after all static multipliers
  const rainy = isRaining();
  if (rainy) {
    load *= 1.15;
    if (isMorningPeak || isEveningPeak) load *= 1.1;
  }

  // ── PHASE 2: DISTRIBUTION CORRECTION (must run AFTER all boosts above) ──
  // Boosts above can push load into 0.5–0.8 range, wiping out low/very-high tiers.
  // This block restores a realistic spread across all 4 categories.

  // 9) Stronger downward pull — essential to counteract accumulated boost pressure
  load *= 0.85;

  // 10) Guaranteed low segment: ~30% of buses are near-empty
  //     (just left terminus, contra-peak direction, low-demand spur)
  if (Math.random() < 0.30) load *= 0.45;

  // 11) Rare very-crowded spike: ~10% chance (peak crush hours, Silk Board etc.)
  if (Math.random() < 0.10) load *= 1.25;

  // 12) Wide jitter ±0.20 — ensures no two buses on same route are identical
  load += (Math.random() - 0.5) * 0.4;

  // 13) Night safety cap — no "Crowded" or "Very crowded" after 9pm
  if (isNight) load = Math.min(load, 0.5);

  // 14) Final clamp — 0.95 ceiling gives very_high tier breathing room
  load = Math.max(0, Math.min(load, 0.95));

  if (load >= 0.75) return "VeryHigh";
  if (load >= 0.52) return "High";
  if (load >= 0.28) return "Medium";
  return "Low";
}

// All buses are online — every simulated bus in the fleet is "running".
function getInitialOnline(_busId: string): boolean {
  return true;
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
// We simulate ACTIVE buses, not total fleet capacity. Routes ≠ buses.
// 200 major routes × 3 buses + 100 minor routes × 1 bus = 700 live buses
// — matches the spec's 600–800 active-fleet target.
// "Major" = top 200 picked routes by stop count (busier corridors run more buses).
const MAJOR_ROUTES_COUNT = 200;
const MINOR_ROUTES_COUNT = 100;
const MAX_LIVE_ROUTES = MAJOR_ROUTES_COUNT + MINOR_ROUTES_COUNT; // 300
const MAJOR_BUSES_PER_ROUTE = 3;
const MINOR_BUSES_PER_ROUTE = 1;

async function initializeBuses() {
  if (initialized) return;

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
    Ordinary: 120, Vajra: 50, Volvo: 40, Airport: 30, MetroFeeder: 36, Night: 24,
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
  // Interleave by type so consecutive insertions cycle through the type
  // pool. Map iteration order = insertion order, so the default /live
  // response (capped at 100) ends up with a balanced type mix instead of
  // 100 buses of the first type. Filter chips on the mobile client all
  // populate, and the "All Buses" pill shows realistic variety.
  const buckets = new Map<NormalizedBusType, typeof picked>();
  for (const p of picked) {
    const arr = buckets.get(p.type) ?? [];
    arr.push(p);
    buckets.set(p.type, arr);
  }
  const interleaved: typeof picked = [];
  let stillHaveItems = true;
  while (stillHaveItems) {
    stillHaveItems = false;
    for (const t of TYPES) {
      const arr = buckets.get(t);
      if (arr && arr.length > 0) {
        interleaved.push(arr.shift()!);
        if (arr.length > 0) stillHaveItems = true;
      }
    }
  }
  const ranked = interleaved.slice(0, MAX_LIVE_ROUTES);

  // Decide tier (major/minor) by stop count among the picked set. Insertion order
  // stays the type-interleaved order above so the capped /live response remains
  // balanced across types.
  const byLenDesc = [...ranked].sort(
    (a, b) => (cache.get(b.route.id)?.length ?? 0) - (cache.get(a.route.id)?.length ?? 0),
  );
  const majorIds = new Set(byLenDesc.slice(0, MAJOR_ROUTES_COUNT).map((p) => p.route.id));

  const totalBuses =
    Math.min(MAJOR_ROUTES_COUNT, ranked.length) * MAJOR_BUSES_PER_ROUTE +
    Math.max(0, ranked.length - MAJOR_ROUTES_COUNT) * MINOR_BUSES_PER_ROUTE;
  const breakdown = ranked.reduce((acc, p) => { acc[p.type] = (acc[p.type] || 0) + 1; return acc; }, {} as Record<string, number>);
  console.log(`[buses] initializing ${totalBuses} live buses across ${ranked.length} routes (${majorIds.size} major × ${MAJOR_BUSES_PER_ROUTE} + ${ranked.length - majorIds.size} minor × ${MINOR_BUSES_PER_ROUTE})`, breakdown);

  // Flip the readiness flag *after* the loop so concurrent callers awaiting
  // ensureInitialized() can never see a half-built busState.
  for (const { route, type } of ranked) {
    const stops = cache.get(route.id) ?? [];
    if (stops.length < 2) continue;

    const numBuses = majorIds.has(route.id) ? MAJOR_BUSES_PER_ROUTE : MINOR_BUSES_PER_ROUTE;
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
      const speed = baseSpeed + Math.random() * 10;
      const initialDistance = 500 + Math.random() * 1000;
      const initialProgress = Math.random();
      routeLastBusTime.set(route.id, route.lastBusTime);
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
        speed,
        baseSpeed: speed,
        heading: 0,
        nextStop: nextStop.name,
        nextStopId: nextStop.id,
        distanceToNextStop: initialDistance,
        crowdLevel: getCrowdLevel(route.id, stopIndex, 1, route.number, nextStop.name),
        status: computeStatus(initialDistance, speed, initialProgress),
        isLastBus: isLastBus(route.lastBusTime),
        isOnline: online,
        lastUpdated: new Date().toISOString(),
        stopIndex,
        direction: 1,
        progress: initialProgress,
        totalStops: stops.length,
        stopsCovered: stopIndex,
        stopsRemaining: stops.length - 1 - stopIndex,
        currentStop: currentStop.name,
      });
    }
  }

  initialized = true;
}

async function updateBusPositions() {
  const routeStopsCache = await getRouteStopsCache();

  for (const [busId, bus] of busState) {
    const stops = routeStopsCache.get(bus.routeId);
    if (!stops || stops.length < 2) continue;

    // All buses stay online — no offline flipping.
    bus.isOnline = true;

    // Dwell pause: if a bus has dwelled at a stop, freeze position until the
    // dwell window expires. Hard cap = 90s so a stuck dwellUntil can never
    // strand a bus permanently.
    const now = Date.now();
    const dwellUntil = (bus as { dwellUntil?: number }).dwellUntil ?? 0;
    if (dwellUntil > now) {
      bus.lastUpdated = new Date().toISOString();
      continue;
    }

    bus.progress += 0.003 + Math.random() * 0.002;

    if (bus.progress >= 1) {
      bus.progress = 0;
      bus.stopIndex = (bus.stopIndex + bus.direction + stops.length) % stops.length;

      if (bus.stopIndex === stops.length - 1) bus.direction = -1;
      else if (bus.stopIndex === 0) bus.direction = 1;

      // Bus just arrived at a stop → dwell 30–60s (capped 90s by fallback rule)
      const dwellMs = Math.min(90_000, 30_000 + Math.floor(Math.random() * 30_000));
      (bus as { dwellUntil?: number }).dwellUntil = now + dwellMs;
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
    // Modulate speed near the stop so At_Stop is actually reachable: bus
    // decelerates within 200m, dwells very slowly under 50m, then resumes
    // cruising once it's back into the open leg.
    if (bus.distanceToNextStop <= 50) {
      bus.speed = 2;
    } else if (bus.distanceToNextStop <= 200) {
      bus.speed = Math.max(8, bus.baseSpeed * 0.4);
    } else {
      bus.speed = bus.baseSpeed;
    }
    bus.crowdLevel = getCrowdLevel(bus.routeId, currentIdx, bus.direction, bus.routeNumber, bus.nextStop);
    bus.status = computeStatus(bus.distanceToNextStop, bus.speed, bus.progress);
    bus.totalStops = stops.length;
    // Stops covered along the current direction of travel
    bus.stopsCovered = bus.direction === 1 ? currentIdx : stops.length - 1 - currentIdx;
    bus.stopsRemaining = stops.length - 1 - bus.stopsCovered;

    bus.isLastBus = isLastBus(routeLastBusTime.get(bus.routeId) ?? null);
    bus.lastUpdated = new Date().toISOString();
  }
}

// 8s sim tick — slow enough to cut backend cost ~37% vs 5s while still
// fast enough that client polls (10–12s) usually see fresh data.
setInterval(async () => {
  try {
    await ensureInitialized();
    await updateBusPositions();
  } catch {
  }
}, 8000);

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

// Hard server cap on /buses/live response size — the spec requires no more
// than 100 buses per request to keep payloads small and rendering snappy.
const LIVE_RESPONSE_HARD_CAP = 100;
const LIVE_RESPONSE_MIN_FALLBACK = 20;

router.get("/live", async (req, res) => {
  try {
    await ensureInitialized();
    let buses = Array.from(busState.values());

    // Optional server-side filtering (keeps payload small; backward-compatible:
    // old clients that don't pass these get the full list as before).
    const {
      busType,
      lat,
      lng,
      radius,
      limit,
      offset,
      lat_min,
      lat_max,
      lng_min,
      lng_max,
    } = req.query as Record<string, string>;

    if (busType && busType.toLowerCase() !== "all") {
      const want = busType.toLowerCase();
      buses = buses.filter((b) => b.busType.toLowerCase() === want);
    }

    // ----- Viewport bounding-box filter (preferred over lat/lng radius) -----
    // When all four bbox params are present, return buses inside the box.
    // If fewer than 20 fall inside, top up with the nearest buses to the box
    // center so the map is never visibly empty.
    const latMin = parseFloat(lat_min);
    const latMax = parseFloat(lat_max);
    const lngMin = parseFloat(lng_min);
    const lngMax = parseFloat(lng_max);
    const allBboxNumbers =
      !Number.isNaN(latMin) && !Number.isNaN(latMax) &&
      !Number.isNaN(lngMin) && !Number.isNaN(lngMax);
    // A degenerate (zero-area / inverted) box is treated as a valid request
    // for the bbox path — we just won't have any "inside" buses, so the
    // nearest-to-center fallback returns the closest 20. Returning citywide
    // results would be surprising to the client.
    const bboxDegenerate = allBboxNumbers && (latMax <= latMin || lngMax <= lngMin);
    const bboxValid = allBboxNumbers && !bboxDegenerate;
    const bboxPathRequested = allBboxNumbers;

    if (bboxPathRequested) {
      const inside = bboxValid
        ? buses.filter(
            (b) => b.lat >= latMin && b.lat <= latMax && b.lng >= lngMin && b.lng <= lngMax,
          )
        : [];
      if (inside.length >= LIVE_RESPONSE_MIN_FALLBACK) {
        buses = inside;
      } else {
        // Top up with nearest-to-center buses outside the viewport.
        // For degenerate boxes the "center" is just the (latMin, lngMin) point.
        const centerLat = (latMin + latMax) / 2;
        const centerLng = (lngMin + lngMax) / 2;
        const insideIds = new Set(inside.map((b) => b.id));
        const outsideRanked = buses
          .filter((b) => !insideIds.has(b.id))
          .map((b) => ({ b, d: haversineKm(centerLat, centerLng, b.lat, b.lng) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, LIVE_RESPONSE_MIN_FALLBACK - inside.length)
          .map((x) => x.b);
        buses = [...inside, ...outsideRanked];
      }
    } else if (lat && lng) {
      // Legacy radius mode (kept for backward compatibility).
      const la = parseFloat(lat);
      const ln = parseFloat(lng);
      const radKm = radius ? parseFloat(radius) : 8;
      if (!Number.isNaN(la) && !Number.isNaN(ln)) {
        const withDist = buses.map((b) => ({ b, d: haversineKm(la, ln, b.lat, b.lng) }));
        let nearby = withDist.filter((x) => x.d <= radKm);
        if (nearby.length === 0 && withDist.length > 0) {
          nearby = withDist.sort((a, b) => a.d - b.d).slice(0, 20);
        } else {
          nearby.sort((a, b) => a.d - b.d);
        }
        buses = nearby.map((x) => x.b);
      }
    }

    const total = buses.length;

    // Apply pagination if requested, else just enforce the hard cap of 100.
    if (offset || limit) {
      const off = Math.max(0, parseInt(offset ?? "0", 10) || 0);
      const lim = Math.max(
        1,
        Math.min(LIVE_RESPONSE_HARD_CAP, parseInt(limit ?? "30", 10) || 30),
      );
      buses = buses.slice(off, off + lim);
      res.set("X-Total-Count", String(total));
    } else if (buses.length > LIVE_RESPONSE_HARD_CAP) {
      buses = buses.slice(0, LIVE_RESPONSE_HARD_CAP);
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
    await ensureInitialized();
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

export { initializeBuses, getCrowdLevel, isLastBus as checkIsLastBus };
export default router;
