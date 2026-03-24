import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { busRoutesTable, busStopsTable, routeStopsTable, busFrequencyTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { busState, getCrowdLevel } from "./buses.js";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const { source, destination } = req.query as { source: string; destination: string };

    if (!source || !destination) {
      res.status(400).json({ error: "source and destination are required" });
      return;
    }

    const allStops = await db.select().from(busStopsTable);
    const allRoutes = await db.select().from(busRoutesTable);
    const allRouteStops = await db.select().from(routeStopsTable);
    const allFreq = await db.select().from(busFrequencyTable);

    const sourceLower = source.toLowerCase();
    const destLower = destination.toLowerCase();

    const matchingSourceStops = allStops.filter(
      (s) =>
        s.name.toLowerCase().includes(sourceLower) ||
        sourceLower.includes(s.name.toLowerCase().split(" ")[0])
    );
    const matchingDestStops = allStops.filter(
      (s) =>
        s.name.toLowerCase().includes(destLower) ||
        destLower.includes(s.name.toLowerCase().split(" ")[0])
    );

    const results = [];
    const now = new Date();
    const dayType =
      now.getDay() === 0 || now.getDay() === 6 ? "weekend" : "weekday";

    for (const route of allRoutes) {
      const routeStopIds = allRouteStops
        .filter((rs) => rs.routeId === route.id)
        .sort((a, b) => a.order - b.order)
        .map((rs) => rs.stopId);

      for (const srcStop of matchingSourceStops) {
        if (!routeStopIds.includes(srcStop.id)) continue;
        for (const dstStop of matchingDestStops) {
          if (!routeStopIds.includes(dstStop.id)) continue;
          if (srcStop.id === dstStop.id) continue;

          const srcIdx = routeStopIds.indexOf(srcStop.id);
          const dstIdx = routeStopIds.indexOf(dstStop.id);
          if (srcIdx >= dstIdx) continue;

          const freqData = allFreq.find(
            (f) => f.routeId === route.id && f.dayType === dayType
          );

          const hour = now.getHours();
          let frequency = 4;
          if (freqData) {
            if (hour >= 6 && hour < 10) frequency = freqData.morning;
            else if (hour >= 10 && hour < 17) frequency = freqData.afternoon;
            else if (hour >= 17 && hour < 21) frequency = freqData.evening;
            else frequency = freqData.night;
          }

          const routeBuses = Array.from(busState.values()).filter(
            (b) => b.routeId === route.id
          );

          const etaMinutes =
            routeBuses.length > 0
              ? Math.max(2, Math.min(20, Math.round(Math.random() * 15 + 3)))
              : Math.round(60 / Math.max(frequency, 1));

          const level = getCrowdLevel(route.id, srcIdx);

          const isLastBus = (() => {
            if (!route.lastBusTime) return false;
            const [h, m] = route.lastBusTime.split(":").map(Number);
            const lb = new Date();
            lb.setHours(h, m, 0, 0);
            const diff = lb.getTime() - now.getTime();
            return diff > 0 && diff < 45 * 60 * 1000;
          })();

          results.push({
            routeId: route.id,
            routeNumber: route.number,
            routeName: route.name,
            routeColor: route.color,
            sourceStop: srcStop.name,
            destinationStop: dstStop.name,
            etaMinutes,
            crowdLevel: level,
            isLastBus,
            frequency,
          });
          break;
        }
        if (results.find((r) => r.routeId === route.id)) break;
      }
    }

    results.sort((a, b) => a.etaMinutes - b.etaMinutes);
    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Error searching routes");
    res.status(500).json({ error: "Failed to search routes" });
  }
});

export default router;
