import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { busRoutesTable, busStopsTable, routeStopsTable, busFrequencyTable } from "@workspace/db";
import { busState, getCrowdLevel } from "./buses.js";
import { fuzzyScoreTokens, tokenize, normalize } from "../lib/fuzzy.js";

const router: IRouter = Router();

const MIN_QUERY_LENGTH = 3;

type StopRow = { id: string; name: string; lat: number; lng: number; [key: string]: unknown };

// Lightweight learning: count how often each route appears in search results.
// Decays slowly — popular corridors get a small ranking boost over time.
// Persists only for the lifetime of the server process (no DB write, no cost).
const searchPopularity = new Map<string, number>();
function bumpSearchPopularity(routeId: string) {
  searchPopularity.set(routeId, (searchPopularity.get(routeId) ?? 0) + 1);
}
function getSearchPopularityScore(routeId: string): number {
  const raw = searchPopularity.get(routeId) ?? 0;
  // log-scaled so a route searched 100 times doesn't dominate one searched 5
  return Math.min(10, Math.log2(raw + 1) * 2);
}

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
type RouteRow = { id: string; number: string; name: string; color: string | null; busType: string | null; lastBusTime: string | null; [key: string]: unknown };
type FreqRow = { routeId: string; dayType: string; morning: number; afternoon: number; evening: number; night: number; [key: string]: unknown };

interface StopWithTokens {
  stop: StopRow;
  tokens: string[];
  lower: string;
}

interface CachedTransitData {
  allStops: StopRow[];
  stopsTokenized: StopWithTokens[];
  stopById: Map<string, StopRow>;
  allRoutes: RouteRow[];
  allFreq: FreqRow[];
  routeStopIndex: Map<string, string[]>;
}

const CACHE_TTL_MS = 60_000;

let transitCache: { data: CachedTransitData | null; expiresAt: number } = { data: null, expiresAt: 0 };
let refreshPromise: Promise<CachedTransitData> | null = null;

async function fetchFreshData(): Promise<CachedTransitData> {
  const [allStops, allRoutes, allRouteStops, allFreq] = await Promise.all([
    db.select().from(busStopsTable),
    db.select().from(busRoutesTable),
    db.select().from(routeStopsTable),
    db.select().from(busFrequencyTable),
  ]);
  const routeStopIndex = new Map<string, string[]>();
  for (const rs of allRouteStops as { routeId: string; stopId: string; order: number }[]) {
    if (!routeStopIndex.has(rs.routeId)) routeStopIndex.set(rs.routeId, []);
    routeStopIndex.get(rs.routeId)!.push(rs.stopId + ":" + rs.order);
  }
  for (const [routeId, entries] of routeStopIndex) {
    routeStopIndex.set(
      routeId,
      entries.sort((a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1])).map((e) => e.split(":")[0])
    );
  }
  const stopRows = allStops as StopRow[];
  const stopsTokenized: StopWithTokens[] = stopRows.map((s) => ({
    stop: s,
    tokens: tokenize(s.name),
    lower: normalize(s.name),
  }));
  const stopById = new Map(stopRows.map((s) => [s.id, s] as const));
  return {
    allStops: stopRows,
    stopsTokenized,
    stopById,
    allRoutes: allRoutes as RouteRow[],
    allFreq: allFreq as FreqRow[],
    routeStopIndex,
  };
}

async function getTransitData(): Promise<CachedTransitData> {
  const now = Date.now();
  if (transitCache.data && now < transitCache.expiresAt) {
    return transitCache.data;
  }
  if (!refreshPromise) {
    refreshPromise = fetchFreshData().then((data) => {
      transitCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
      refreshPromise = null;
      return data;
    }).catch((err) => {
      refreshPromise = null;
      throw err;
    });
  }
  return refreshPromise;
}

router.get("/", async (req, res) => {
  try {
    const { source, destination } = req.query as { source: string; destination: string };

    if (!source || !destination) {
      res.status(400).json({ error: "source and destination are required" });
      return;
    }

    if (source.trim().length < MIN_QUERY_LENGTH || destination.trim().length < MIN_QUERY_LENGTH) {
      res.status(400).json({ error: `source and destination must each be at least ${MIN_QUERY_LENGTH} characters` });
      return;
    }

    const { stopsTokenized, stopById, allRoutes, allFreq, routeStopIndex } = await getTransitData();

    const srcTokens = tokenize(source);
    const srcLower = normalize(source);
    const dstTokens = tokenize(destination);
    const dstLower = normalize(destination);

    const scoredSource = stopsTokenized
      .map((x) => ({ stop: x.stop, fs: fuzzyScoreTokens(srcTokens, srcLower, x.tokens, x.lower) }))
      .filter((x) => x.fs.matched)
      .sort((a, b) => b.fs.score - a.fs.score)
      .slice(0, 60);
    const scoredDest = stopsTokenized
      .map((x) => ({ stop: x.stop, fs: fuzzyScoreTokens(dstTokens, dstLower, x.tokens, x.lower) }))
      .filter((x) => x.fs.matched)
      .sort((a, b) => b.fs.score - a.fs.score)
      .slice(0, 60);

    const matchingSourceStops = scoredSource.map((x) => x.stop);
    const matchingDestStops = scoredDest.map((x) => x.stop);

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
      const routeStopIds = routeStopIndex.get(route.id) ?? [];

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
            (b) => b.routeId === route.id && b.isOnline !== false
          );

          // Deterministic ETA: actual road distance / average bus speed
          // Distance = sum of segment haversine distances along the route
          let routeKm = 0;
          for (let i = srcIdx; i < dstIdx; i++) {
            const a = stopById.get(routeStopIds[i]);
            const b = stopById.get(routeStopIds[i + 1]);
            if (a && b) routeKm += haversineKm(a.lat, a.lng, b.lat, b.lng);
          }
          // Fallback if any stop coords were missing
          if (routeKm <= 0) routeKm = stopsInBetween * 0.6;

          // Average speed by bus type (km/h, includes stop dwell time)
          const speedByType: Record<string, number> = {
            Ordinary: 18, Vajra: 22, Volvo: 24, Airport: 32, "Metro Feeder": 20, MetroFeeder: 20, Night: 25,
          };
          const avgSpeed = speedByType[route.busType ?? "Ordinary"] ?? 20;

          // ETA = (distance / speed) × 60. Add wait time when no live bus.
          const travelMin = (routeKm / avgSpeed) * 60;
          const waitMin = routeBuses.length > 0 ? 2 : Math.round(60 / Math.max(frequency, 1) / 2);
          const etaMinutes = Math.max(1, Math.round(travelMin + waitMin));

          const level = getCrowdLevel(route.id, srcIdx);

          const isLastBus = (() => {
            if (!route.lastBusTime) return false;
            const [h, m] = route.lastBusTime.split(":").map(Number);
            const lb = new Date();
            lb.setHours(h, m, 0, 0);
            const diff = lb.getTime() - now.getTime();
            return diff > 0 && diff < 45 * 60 * 1000;
          })();

          // Scoring: lower is better (faster + less crowded + more frequent + popular)
          const crowdPenalty =
            level === "VeryHigh" ? 25 : level === "High" ? 15 : level === "Medium" ? 5 : 0;
          const freqBonus = Math.round(60 / Math.max(frequency, 1));
          const popularityBonus = getSearchPopularityScore(route.id); // 0..10 (subtracts from score)
          const score = etaMinutes + crowdPenalty + freqBonus - popularityBonus;
          bumpSearchPopularity(route.id);

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
    const crowdOrder = { Low: 0, Medium: 1, High: 2, VeryHigh: 3 };
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
