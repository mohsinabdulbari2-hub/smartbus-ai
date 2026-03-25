import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { busRoutesTable, busStopsTable, routeStopsTable, busFrequencyTable } from "@workspace/db";
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

    const sourceLower = source.toLowerCase().trim();
    const destLower = destination.toLowerCase().trim();

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

    const results: Array<{
      routeId: string;
      routeNumber: string;
      routeName: string;
      routeColor: string | null;
      busType: string;
      sourceStop: string;
      destinationStop: string;
      etaMinutes: number;
      crowdLevel: string;
      isLastBus: boolean;
      frequency: number;
      stopCount: number;
      tags: string[];
      isRecommended: boolean;
      isFastest: boolean;
      isLeastCrowded: boolean;
      score: number;
      type: "direct";
    }> = [];

    const now = new Date();
    const dayType =
      now.getDay() === 0 || now.getDay() === 6 ? "weekend" : "weekday";
    const hour = now.getHours();

    for (const route of allRoutes) {
      const routeStopEntries = allRouteStops
        .filter((rs) => rs.routeId === route.id)
        .sort((a, b) => a.order - b.order);
      const routeStopIds = routeStopEntries.map((rs) => rs.stopId);

      for (const srcStop of matchingSourceStops) {
        if (!routeStopIds.includes(srcStop.id)) continue;
        for (const dstStop of matchingDestStops) {
          if (!routeStopIds.includes(dstStop.id)) continue;
          if (srcStop.id === dstStop.id) continue;

          const srcIdx = routeStopIds.indexOf(srcStop.id);
          const dstIdx = routeStopIds.indexOf(dstStop.id);
          if (srcIdx >= dstIdx) continue;

          const stopsInBetween = dstIdx - srcIdx;

          const freqData = allFreq.find(
            (f) => f.routeId === route.id && f.dayType === dayType
          );

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

          // More realistic ETA: base on stops + live bus proximity
          const baseEta = stopsInBetween * 4 + Math.round(Math.random() * 5 + 2);
          const etaMinutes = routeBuses.length > 0
            ? Math.max(1, Math.min(baseEta, 35))
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

          // Scoring: lower is better (faster + less crowded + more frequent)
          const crowdPenalty = level === "High" ? 15 : level === "Medium" ? 5 : 0;
          const freqBonus = Math.round(60 / Math.max(frequency, 1));
          const score = etaMinutes + crowdPenalty + freqBonus;

          results.push({
            routeId: route.id,
            routeNumber: route.number,
            routeName: route.name,
            routeColor: route.color,
            busType: route.busType ?? "Ordinary",
            sourceStop: srcStop.name,
            destinationStop: dstStop.name,
            etaMinutes,
            crowdLevel: level,
            isLastBus,
            frequency,
            stopCount: stopsInBetween,
            tags: [],
            isRecommended: false,
            isFastest: false,
            isLeastCrowded: false,
            score,
            type: "direct",
          });
          break;
        }
        if (results.find((r) => r.routeId === route.id)) break;
      }
    }

    if (results.length === 0) {
      res.json([]);
      return;
    }

    // Sort by score (best overall)
    results.sort((a, b) => a.score - b.score);

    // Tag: Best / Recommended (best overall score)
    results[0].isRecommended = true;
    results[0].tags.push("Recommended");

    // Tag: Fastest (lowest ETA)
    const fastestIdx = results.reduce(
      (bestIdx, r, idx) => (r.etaMinutes < results[bestIdx].etaMinutes ? idx : bestIdx),
      0
    );
    if (!results[fastestIdx].isRecommended) {
      results[fastestIdx].isFastest = true;
      results[fastestIdx].tags.push("Fastest");
    } else {
      results[fastestIdx].tags.push("Fastest");
    }

    // Tag: Least Crowded (lowest crowd penalty)
    const crowdOrder = { Low: 0, Medium: 1, High: 2 };
    const leastCrowdedIdx = results.reduce(
      (bestIdx, r, idx) =>
        (crowdOrder[r.crowdLevel as keyof typeof crowdOrder] ?? 1) <
        (crowdOrder[results[bestIdx].crowdLevel as keyof typeof crowdOrder] ?? 1)
          ? idx
          : bestIdx,
      0
    );
    if (!results[leastCrowdedIdx].isRecommended && !results[leastCrowdedIdx].isFastest) {
      results[leastCrowdedIdx].isLeastCrowded = true;
      results[leastCrowdedIdx].tags.push("Less Crowded");
    } else {
      results[leastCrowdedIdx].tags.push("Less Crowded");
    }

    // Mark remaining as Alternative
    results.forEach((r, idx) => {
      if (idx > 0 && r.tags.length === 0) {
        r.tags.push("Alternative");
      }
    });

    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Error searching routes");
    res.status(500).json({ error: "Failed to search routes" });
  }
});

export default router;
