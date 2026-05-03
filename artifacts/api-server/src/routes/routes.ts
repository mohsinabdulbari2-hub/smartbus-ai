import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { busRoutesTable, busStopsTable, routeStopsTable, busFrequencyTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { classifyBusType } from "../lib/busType.js";

const router: IRouter = Router();

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
      stops: stops.map((s) => ({
        id: s.stop.id,
        name: s.stop.name,
        lat: s.stop.lat,
        lng: s.stop.lng,
        zone: s.stop.zone,
        routeIds: [routeId],
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching route");
    res.status(500).json({ error: "Failed to fetch route" });
  }
});

export default router;
