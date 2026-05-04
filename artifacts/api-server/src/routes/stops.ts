import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { busStopsTable, routeStopsTable, busRoutesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { busState, getCrowdLevel, checkIsLastBus } from "./buses.js";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const stops = await db.select().from(busStopsTable);
    const routeLinks = await db.select().from(routeStopsTable);

    const stopRouteMap = new Map<string, string[]>();
    for (const link of routeLinks) {
      if (!stopRouteMap.has(link.stopId)) stopRouteMap.set(link.stopId, []);
      stopRouteMap.get(link.stopId)!.push(link.routeId);
    }

    res.json(stops.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      routeIds: stopRouteMap.get(s.id) ?? [],
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching stops");
    res.status(500).json({ error: "Failed to fetch stops" });
  }
});

router.get("/:stopId/eta", async (req, res) => {
  try {
    const { stopId } = req.params;

    const routeLinks = await db
      .select()
      .from(routeStopsTable)
      .where(eq(routeStopsTable.stopId, stopId));

    const routeIds = routeLinks.map((r) => r.routeId);

    const routes = await db.select().from(busRoutesTable);
    const routeMap = new Map(routes.map((r) => [r.id, r]));

    const stopInfo = await db
      .select()
      .from(busStopsTable)
      .where(eq(busStopsTable.id, stopId));

    if (!stopInfo.length) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }

    const stop = stopInfo[0];
    const etas = [];

    for (const routeId of routeIds) {
      const route = routeMap.get(routeId);
      if (!route) continue;

      const routeBuses = Array.from(busState.values()).filter(
        (b) => b.routeId === routeId && b.nextStopId === stopId && b.isOnline !== false
      );

      if (routeBuses.length === 0) {
        const allRouteBuses = Array.from(busState.values()).filter(
          (b) => b.routeId === routeId && b.isOnline !== false
        );

        if (allRouteBuses.length > 0) {
          const nearest = allRouteBuses.reduce((a, b) => {
            const distA = Math.sqrt(
              Math.pow(a.lat - stop.lat, 2) + Math.pow(a.lng - stop.lng, 2)
            );
            const distB = Math.sqrt(
              Math.pow(b.lat - stop.lat, 2) + Math.pow(b.lng - stop.lng, 2)
            );
            return distA < distB ? a : b;
          });

          const dist = Math.sqrt(
            Math.pow(nearest.lat - stop.lat, 2) + Math.pow(nearest.lng - stop.lng, 2)
          );
          const etaMinutes = Math.max(1, Math.round((dist * 111) / (nearest.speed / 60)));

          etas.push({
            busId: nearest.id,
            routeId: route.id,
            routeNumber: route.number,
            routeName: route.name,
            routeColor: route.color,
            etaMinutes: Math.min(etaMinutes, 25),
            crowdLevel: nearest.crowdLevel,
            isLastBus: nearest.isLastBus,
          });
        }
      } else {
        const bus = routeBuses[0];
        const etaMinutes = Math.max(
          1,
          Math.round(bus.distanceToNextStop / ((bus.speed * 1000) / 60))
        );

        etas.push({
          busId: bus.id,
          routeId: route.id,
          routeNumber: route.number,
          routeName: route.name,
          routeColor: route.color,
          etaMinutes: Math.min(etaMinutes, 20),
          crowdLevel: bus.crowdLevel,
          isLastBus: bus.isLastBus,
        });
      }
    }

    etas.sort((a, b) => a.etaMinutes - b.etaMinutes);
    res.json(etas);
  } catch (err) {
    req.log.error({ err }, "Error fetching ETA");
    res.status(500).json({ error: "Failed to fetch ETA" });
  }
});

router.get("/:stopId/crowd", async (req, res) => {
  try {
    const { stopId } = req.params;
    const { routeId } = req.query as { routeId?: string };

    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const level = getCrowdLevel(routeId ?? stopId, 0);

    let estimatedPassengers = 0;
    let reason = "";

    if (level === "High") {
      estimatedPassengers = 60 + Math.floor(Math.random() * 30);
      if (hour >= 8 && hour <= 10) reason = "Morning peak hour - high demand";
      else if (hour >= 17 && hour <= 20) reason = "Evening rush hour - high demand";
      else reason = "High passenger demand at this stop";
    } else if (level === "Medium") {
      estimatedPassengers = 25 + Math.floor(Math.random() * 20);
      reason = "Moderate passenger traffic expected";
    } else {
      estimatedPassengers = 5 + Math.floor(Math.random() * 15);
      reason = "Low passenger traffic at this time";
    }

    if (isWeekend) reason += " (weekend)";

    res.json({
      stopId,
      routeId: routeId ?? null,
      level,
      estimatedPassengers,
      reason,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching crowd prediction");
    res.status(500).json({ error: "Failed to fetch crowd prediction" });
  }
});

export default router;
