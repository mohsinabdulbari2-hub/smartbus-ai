import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { busRoutesTable, busStopsTable, routeStopsTable, busFrequencyTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

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
}

const busState = new Map<string, BusPosition>();
let initialized = false;

function getCrowdLevel(routeId: string, stopIndex: number): "Low" | "Medium" | "High" {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isMajorStop = stopIndex % 3 === 0;

  let score = 0;
  if (hour >= 8 && hour <= 10) score += 3;
  else if (hour >= 17 && hour <= 20) score += 3;
  else if (hour >= 12 && hour <= 14) score += 1;
  else score -= 1;
  if (!isWeekend) score += 1;
  if (isMajorStop) score += 1;
  const routeHash = routeId.charCodeAt(0) % 3;
  score += routeHash;

  if (score >= 4) return "High";
  if (score >= 2) return "Medium";
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

async function initializeBuses() {
  if (initialized) return;
  initialized = true;

  const routes = await db.select().from(busRoutesTable);

  for (const route of routes) {
    const stops = await db
      .select({ stop: busStopsTable, order: routeStopsTable.order })
      .from(routeStopsTable)
      .innerJoin(busStopsTable, eq(routeStopsTable.stopId, busStopsTable.id))
      .where(eq(routeStopsTable.routeId, route.id))
      .orderBy(routeStopsTable.order);

    if (stops.length < 2) continue;

    const numBuses = Math.max(2, Math.floor(stops.length / 3));
    for (let i = 0; i < numBuses; i++) {
      const stopIndex = Math.floor((i / numBuses) * (stops.length - 1));
      const currentStop = stops[stopIndex].stop;
      const nextStopIdx = Math.min(stopIndex + 1, stops.length - 1);
      const nextStop = stops[nextStopIdx].stop;

      // Speed varies by bus type
      const speedByType: Record<string, number> = {
        Ordinary: 22, Vajra: 30, Volvo: 35, Airport: 55, MetroFeeder: 25, Night: 28,
      };
      const baseSpeed = speedByType[(route as any).busType ?? "Ordinary"] ?? 25;

      const busId = `${route.id}-bus-${i}`;
      busState.set(busId, {
        id: busId,
        routeId: route.id,
        routeNumber: route.number,
        routeName: route.name,
        routeColor: route.color,
        busType: (route as any).busType ?? "Ordinary",
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
      });
    }
  }
}

async function updateBusPositions() {
  const routes = await db.select().from(busRoutesTable);
  const routeStopsCache = new Map<string, Array<{ stop: typeof busStopsTable.$inferSelect; order: number }>>();

  for (const route of routes) {
    const stops = await db
      .select({ stop: busStopsTable, order: routeStopsTable.order })
      .from(routeStopsTable)
      .innerJoin(busStopsTable, eq(routeStopsTable.stopId, busStopsTable.id))
      .where(eq(routeStopsTable.routeId, route.id))
      .orderBy(routeStopsTable.order);
    routeStopsCache.set(route.id, stops);
  }

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
    bus.distanceToNextStop = Math.round((1 - bus.progress) * 1200);
    bus.crowdLevel = getCrowdLevel(bus.routeId, currentIdx);

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
