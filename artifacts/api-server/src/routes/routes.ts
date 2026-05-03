import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { busRoutesTable, busStopsTable, routeStopsTable, busFrequencyTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { classifyBusType } from "../lib/busType.js";
import { busState } from "./buses.js";

const router: IRouter = Router();

// Haversine distance in km between two lat/lng points
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

type StopWithLive = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zone: string | null;
  routeIds: string[];
  liveStatus: "Departed" | "AtStop" | "Upcoming";
  etaMinutes: number | null;
  isNextStop: boolean;
};

router.get("/", async (req, res) => {
  try {
    const routes = await db.select().from(busRoutesTable);
    res.json(routes.map((r) => ({
      id: r.id,
      name: r.name,
      number: r.number,
      from: r.from,
      to: r.to,
      color: r.color,
      totalStops: r.totalStops,
      lastBusTime: r.lastBusTime,
      busType: classifyBusType(r),
      depot: r.depot,
      distance: r.distance,
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching routes");
    res.status(500).json({ error: "Failed to fetch routes" });
  }
});

router.get("/:routeId/frequency", async (req, res) => {
  try {
    const { routeId } = req.params;
    const { dayType = "weekday" } = req.query as { dayType?: string };

    const freq = await db
      .select()
      .from(busFrequencyTable)
      .where(eq(busFrequencyTable.routeId, routeId));

    const found = freq.find((f) => f.dayType === dayType) || freq[0];

    if (!found) {
      res.status(404).json({ error: "No frequency data" });
      return;
    }

    res.json({
      routeId: found.routeId,
      dayType: found.dayType,
      morning: found.morning,
      afternoon: found.afternoon,
      evening: found.evening,
      night: found.night,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching frequency");
    res.status(500).json({ error: "Failed to fetch frequency" });
  }
});

router.get("/:routeId", async (req, res) => {
  try {
    const { routeId } = req.params;
    const routes = await db
      .select()
      .from(busRoutesTable)
      .where(eq(busRoutesTable.id, routeId));

    if (!routes.length) {
      res.status(404).json({ error: "Route not found" });
      return;
    }

    const route = routes[0];

    const stops = await db
      .select({ stop: busStopsTable, order: routeStopsTable.order })
      .from(routeStopsTable)
      .innerJoin(busStopsTable, eq(routeStopsTable.stopId, busStopsTable.id))
      .where(eq(routeStopsTable.routeId, routeId))
      .orderBy(routeStopsTable.order);

    let isLastBus = false;
    if (route.lastBusTime) {
      const [h, m] = route.lastBusTime.split(":").map(Number);
      const lastBus = new Date();
      lastBus.setHours(h, m, 0, 0);
      const diffMs = lastBus.getTime() - new Date().getTime();
      isLastBus = diffMs > 0 && diffMs < 45 * 60 * 1000;
    }

    // ── Per-stop live status & ETA ───────────────────────────────────────
    // For each stop in the route's ordered sequence, derive:
    //   liveStatus: Departed | AtStop | Upcoming
    //   etaMinutes: minutes until nearest approaching bus reaches this stop
    //   isNextStop: the closest upcoming stop for any approaching bus
    // Logic is bidirection-aware (BMTC routes run both ways).
    const liveBuses = Array.from(busState.values()).filter(
      (b) => b.routeId === routeId && b.isOnline !== false,
    );

    // Pre-compute cumulative km from start of route to each stop (forward dir)
    const cumKm: number[] = new Array(stops.length).fill(0);
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1].stop;
      const b = stops[i].stop;
      cumKm[i] = cumKm[i - 1] + haversineKm(a.lat, a.lng, b.lat, b.lng);
    }

    const stopsEnriched: StopWithLive[] = stops.map((s, i) => {
      let liveStatus: StopWithLive["liveStatus"] = "Upcoming";
      let etaMinutes: number | null = null;
      let nearestApproachingKm = Infinity;
      let nearestApproachingSpeed = 20;
      let anyAtStop = false;
      let anyApproaching = false;
      let anyPassed = false;

      for (const bus of liveBuses) {
        if (bus.stopIndex === i) {
          anyAtStop = true;
          continue;
        }
        // Determine if this stop is ahead of the bus in its current travel
        // direction (direction = 1 means moving toward higher stop indices).
        const ahead = bus.direction === 1 ? i > bus.stopIndex : i < bus.stopIndex;
        if (ahead) {
          anyApproaching = true;
          // Distance bus → this stop = sum of segment lengths along the route.
          // For dir 1 we walk from bus.stopIndex up to i; for dir -1 from i up
          // to bus.stopIndex. cumKm is monotonic so abs(diff) gives us the
          // right value either way.
          const distAlongRoute = Math.abs(cumKm[i] - cumKm[bus.stopIndex]);
          if (distAlongRoute < nearestApproachingKm) {
            nearestApproachingKm = distAlongRoute;
            nearestApproachingSpeed = Math.max(8, bus.speed); // floor 8 km/h
          }
        } else {
          anyPassed = true;
        }
      }

      if (anyAtStop) {
        liveStatus = "AtStop";
        etaMinutes = 0;
      } else if (anyApproaching) {
        liveStatus = "Upcoming";
        etaMinutes = Math.max(1, Math.round((nearestApproachingKm / nearestApproachingSpeed) * 60));
      } else if (anyPassed) {
        // No bus is heading toward this stop; the last one already left.
        liveStatus = "Departed";
        etaMinutes = null;
      } else {
        // No live buses on the route — keep "Upcoming" without an ETA.
        liveStatus = "Upcoming";
        etaMinutes = null;
      }

      return {
        id: s.stop.id,
        name: s.stop.name,
        lat: s.stop.lat,
        lng: s.stop.lng,
        zone: s.stop.zone,
        routeIds: [routeId],
        liveStatus,
        etaMinutes,
        isNextStop: false,
      };
    });

    // Mark "next stop" = the upcoming stop with the smallest ETA across the route.
    let nextIdx = -1;
    let nextEta = Infinity;
    for (let i = 0; i < stopsEnriched.length; i++) {
      const s = stopsEnriched[i];
      if (s.liveStatus === "Upcoming" && s.etaMinutes != null && s.etaMinutes < nextEta) {
        nextEta = s.etaMinutes;
        nextIdx = i;
      }
    }
    if (nextIdx >= 0) stopsEnriched[nextIdx].isNextStop = true;

    res.json({
      id: route.id,
      name: route.name,
      number: route.number,
      from: route.from,
      to: route.to,
      color: route.color,
      totalStops: route.totalStops,
      lastBusTime: route.lastBusTime,
      busType: classifyBusType(route),
      depot: route.depot,
      distance: route.distance,
      isLastBus,
      stops: stopsEnriched,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching route");
    res.status(500).json({ error: "Failed to fetch route" });
  }
});

export default router;
