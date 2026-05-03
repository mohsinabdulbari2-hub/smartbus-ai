import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useMemo, useState, useEffect } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { BUS_TYPE_CONFIG, getBusTypeGradient, LastBusBadge } from "@/components/CrowdBadge";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PulseDot } from "@/components/ui/PulseDot";
import { AnimatedProgress } from "@/components/ui/AnimatedProgress";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { SmartSuggestion } from "@/components/ui/SmartSuggestion";
import { CrowdRow } from "@/components/ui/CrowdRow";
import Colors from "@/constants/colors";
import { MinTouch, Radius, Shadow, Spacing, Type } from "@/constants/theme";
import { api, type LiveBus, type BusType, type BusStatus } from "@/lib/api";
import { fuseFrequency } from "@/lib/frequency";

const FILTERS: { key: BusType | "All"; label: string; emoji: string }[] = [
  { key: "All",         label: "All",      emoji: "🚍" },
  { key: "Vajra",       label: "Vajra",    emoji: "❄️" },
  { key: "Volvo",       label: "Volvo",    emoji: "🌟" },
  { key: "Ordinary",    label: "Ordinary", emoji: "🚌" },
  { key: "Airport",     label: "Airport",  emoji: "✈️" },
  { key: "MetroFeeder", label: "Metro",    emoji: "🚇" },
  { key: "Night",       label: "Night",    emoji: "🌙" },
];

// Lightweight haversine — no library, ~5 lines of math.
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Pseudo-ETA in minutes from on-bus telemetry. Real BMTC has no public
// per-bus ETA feed, so we estimate from distanceToNextStop / speed and
// floor speed at 8 km/h to avoid divide-by-zero / massive ETAs at lights.
// Returns null when distance telemetry is missing — callers must treat
// "no ETA" distinctly from "0 min / Arriving" so unknown buses don't get
// promoted to the top of the list.
function getEtaMinutes(bus: LiveBus): number | null {
  const dMeters = bus.distanceToNextStop;
  if (dMeters == null || !Number.isFinite(dMeters)) return null;
  if (dMeters < 30) return 0; // Arriving
  const speedKmh = Math.max(8, bus.speed || 0);
  return (dMeters / 1000) / speedKmh * 60;
}

// Sort key: Arriving (0) → real ETA → unknown (Infinity) at the bottom.
function getEtaSortKey(bus: LiveBus): number {
  const eta = getEtaMinutes(bus);
  return eta == null ? Number.POSITIVE_INFINITY : eta;
}

const CROWD_ORDER: Record<LiveBus["crowdLevel"], number> = {
  Low: 1, Medium: 2, High: 3, VeryHigh: 4,
};

export default function LiveScreen() {
  const [filter, setFilter] = useState<BusType | "All">("All");
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showFetchHint, setShowFetchHint] = useState(false);
  const [bestBusId, setBestBusId] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching, isFetching, dataUpdatedAt, failureCount } = useQuery({
    queryKey: ["liveBuses"],
    queryFn: api.getLiveBusesWithMeta,
    refetchInterval: 12000,
    placeholderData: (prev) => prev,
  });

  // Stable offline detection — only after 2+ consecutive failures so a
  // single dropped poll doesn't flicker the banner.
  const isOffline = failureCount >= 2;

  // Slow-fetch hint: only after a fetch is genuinely taking >5s.
  useEffect(() => {
    if (!isFetching) {
      setShowFetchHint(false);
      return;
    }
    const t = setTimeout(() => setShowFetchHint(true), 5000);
    return () => clearTimeout(t);
  }, [isFetching]);

  // Get user location once on mount (best-effort; silently no-op if denied).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });
        if (!cancelled) {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {
        // Permission denied / location services off — gracefully omit distance.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Tick "Updated Xs ago" every second, but only after we've had at least
  // one successful fetch (dataUpdatedAt > 0). dataUpdatedAt is updated by
  // TanStack Query ONLY on successful refetch — never on failure — which
  // is exactly the "only update lastFetchTime on success" rule.
  useEffect(() => {
    if (!dataUpdatedAt) return;
    setSecondsAgo(Math.floor((Date.now() - dataUpdatedAt) / 1000));
    const t = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - dataUpdatedAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [dataUpdatedAt]);

  const buses = data?.buses ?? [];
  // Real fleet size from X-Total-Count header. The response body is
  // server-capped at 100 — using it for "Buses on road" would have
  // dramatically under-reported the live fleet.
  const fleetTotal = data?.total ?? buses.length;

  // Filter by bus type, then sort: Arriving first (eta=0), then by lowest
  // pseudo-ETA, then by lowest crowd level. Memoized so we only re-sort
  // when buses or filter actually changes.
  const filtered = useMemo(() => {
    const base = filter === "All" ? buses : buses.filter((b) => b.busType === filter);
    return [...base].sort((a, b) => {
      const etaDiff = getEtaSortKey(a) - getEtaSortKey(b);
      if (etaDiff !== 0) return etaDiff;
      return (CROWD_ORDER[a.crowdLevel] ?? 2) - (CROWD_ORDER[b.crowdLevel] ?? 2);
    });
  }, [buses, filter]);

  // Lock the "Best option" badge to a single bus per session so it doesn't
  // hop between cards every poll. Re-lock only if the current best bus
  // disappears from the list (left service / changed type filter).
  useEffect(() => {
    if (filtered.length === 0) return;
    const stillThere = bestBusId && filtered.some((b) => b.id === bestBusId);
    if (!stillThere) setBestBusId(filtered[0].id);
  }, [filtered, bestBusId]);

  const stats = useMemo(() => {
    const live = buses.filter((b) => b.isOnline !== false);
    const sampleSize = Math.max(1, live.length);
    const ratio = fleetTotal / sampleSize;
    const count = (level: string) => Math.round(live.filter((b) => b.crowdLevel === level).length * ratio);
    return {
      total: fleetTotal,
      low: count("Low"),
      medium: count("Medium"),
      high: count("High"),
      veryHigh: count("VeryHigh"),
    };
  }, [buses, fleetTotal]);

  // Compute per-route live frequency from all buses in the current feed.
  // Each route's buses have known distance-to-next-stop and speed, so we can
  // derive ETA-in-seconds and use gap analysis to estimate buses/hr.
  const routeFreqMap = useMemo(() => {
    const groups = new Map<string, LiveBus[]>();
    for (const bus of buses) {
      if (!groups.has(bus.routeId)) groups.set(bus.routeId, []);
      groups.get(bus.routeId)!.push(bus);
    }
    const map = new Map<string, { freq: number; isLive: boolean }>();
    for (const [routeId, routeBuses] of groups) {
      const etaSec = routeBuses
        .filter((b) => b.speed >= 5 && b.distanceToNextStop != null && b.distanceToNextStop > 0)
        .map((b) => b.distanceToNextStop! / (b.speed * (1000 / 3600)))
        .filter((s) => s > 0 && s < 3600);
      map.set(routeId, fuseFrequency(6, etaSec));
    }
    return map;
  }, [buses]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#1E293B", "#0F172A"]}
        style={styles.bgGradient}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: Spacing.lg }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListHeaderComponent={
            <Header
              total={stats.total}
              low={stats.low}
              medium={stats.medium}
              high={stats.high}
              veryHigh={stats.veryHigh}
              filter={filter}
              setFilter={setFilter}
              dataUpdatedAt={dataUpdatedAt}
              secondsAgo={secondsAgo}
              isOffline={isOffline}
              showFetchHint={showFetchHint}
              showingCount={filtered.length}
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 360)).springify()}>
              <BusCard
                bus={item}
                userLocation={userLocation}
                isTop={item.id === bestBusId}
                dataUpdatedAt={dataUpdatedAt}
                liveFreq={routeFreqMap.get(item.routeId)}
              />
            </Animated.View>
          )}
          ListFooterComponent={
            filtered.length > 0 && filtered.length < 5 ? (
              <Text style={styles.smallListHint}>
                Showing best available buses nearby
              </Text>
            ) : null
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={{ gap: 14, marginTop: 8 }}>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </View>
            ) : (
              <View style={styles.empty}>
                <Feather name="wifi-off" size={36} color={Colors.dark.textMuted} />
                <Text style={styles.emptyText}>
                  {filter === "All" ? "No buses within 5 km" : `No ${filter} buses running`}
                </Text>
                <Text style={styles.emptySub}>
                  {filter === "All"
                    ? "Showing nearest available buses"
                    : "Try another bus type or tap All to see everything"}
                </Text>
                {filter === "All" && (
                  <Text style={styles.emptySub}>Pull down to refresh</Text>
                )}
                {filter !== "All" && (
                  <Pressable
                    onPress={() => { Haptics.selectionAsync(); setFilter("All"); }}
                    style={styles.emptyCta}
                  >
                    <Feather name="refresh-cw" size={14} color={Colors.primary} />
                    <Text style={styles.emptyCtaText}>Show all buses</Text>
                  </Pressable>
                )}
              </View>
            )
          }
        />
      </SafeAreaView>
    </View>
  );
}

function Header({
  total, low, medium, high, veryHigh, filter, setFilter, dataUpdatedAt, secondsAgo, isOffline, showFetchHint, showingCount,
}: {
  total: number; low: number; medium: number; high: number; veryHigh: number;
  filter: BusType | "All"; setFilter: (f: BusType | "All") => void;
  dataUpdatedAt: number;
  secondsAgo: number;
  isOffline: boolean;
  showFetchHint: boolean;
  showingCount: number;
}) {
  const crowded = high + veryHigh;
  const timerLabel = dataUpdatedAt ? `Updated ${secondsAgo}s ago` : "Connecting...";
  const timerColor = !dataUpdatedAt
    ? Colors.dark.textMuted
    : secondsAgo > 20
      ? Colors.warning
      : Colors.dark.textSecondary;
  const dotColor = !dataUpdatedAt || secondsAgo > 20 ? Colors.warning : Colors.success;
  return (
    <View style={{ paddingTop: 8, paddingBottom: 16 }}>
      {/* Top header */}
      <Animated.View entering={FadeInUp.duration(450)}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Live Buses Near You</Text>
            <View style={styles.liveStatusRow}>
              <PulseDot color={dotColor} size={10} />
              <Text style={[styles.liveStatusText, { color: timerColor }]}>
                {timerLabel}
              </Text>
              <Text style={styles.liveLabel}>• Live</Text>
            </View>
          </View>
          <Pressable
            onPress={() => Haptics.selectionAsync()}
            style={styles.profileBtn}
            accessibilityLabel="Profile"
            hitSlop={8}
          >
            <Feather name="user" size={20} color={Colors.dark.text} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Stat cards */}
      <Animated.View entering={FadeInUp.delay(80).duration(450)}>
        {/* Fleet total — full-width banner */}
        <View style={styles.statsBanner}>
          <Text style={styles.statsBannerIcon}>🚍</Text>
          <View>
            <Text style={styles.statsBannerValue}>{total.toLocaleString()}</Text>
            <Text style={styles.statsBannerLabel}>Buses on road</Text>
          </View>
        </View>
        {/* 2×2 crowd grid */}
        <View style={styles.statsGrid}>
          <StatCard label="Seats available" value={low}     icon="🟢" color="#22c55e" glow="rgba(34,197,94,0.25)" />
          <StatCard label="Moderate"        value={medium}  icon="🔵" color="#3b82f6" glow="rgba(59,130,246,0.25)" />
          <StatCard label="Crowded"         value={high}    icon="🟠" color="#f97316" glow="rgba(249,115,22,0.25)" />
          <StatCard label="Very crowded"    value={veryHigh} icon="🔴" color="#ef4444" glow="rgba(239,68,68,0.25)" />
        </View>
      </Animated.View>

      {/* Smart suggestion */}
      {crowded > total * 0.4 && total > 5 && (
        <Animated.View entering={FadeInUp.delay(140)} style={{ marginBottom: 14 }}>
          <SmartSuggestion
            title="Heavy crowds detected"
            message={`${crowded} of ${total} buses are crowded right now. Consider less busy routes.`}
            icon="alert-triangle"
            cta="See alternatives"
          />
        </Animated.View>
      )}

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingRight: 16 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={{ fontSize: 13 }}>{f.emoji}</Text>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isOffline && (
        <Text style={styles.offlineBanner}>
          Offline • Showing last known data
        </Text>
      )}

      {showFetchHint && !isOffline && (
        <Text style={styles.fetchHint}>
          Fetching live buses…
        </Text>
      )}

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Live buses</Text>
        <Text style={styles.sectionCaption}>
          {showingCount === total
            ? `Showing all ${total.toLocaleString()} buses`
            : `Showing ${showingCount.toLocaleString()} of ${total.toLocaleString()} buses`}
        </Text>
      </View>
      <Text style={styles.sortExplain}>
        Sorted by arrival time and crowd level
      </Text>
    </View>
  );
}

function StatCard({
  label, value, icon, color, glow,
}: { label: string; value: number; icon: string; color: string; glow: string }) {
  return (
    <View style={[styles.statCard, Shadow.glow(glow), { borderColor: color + "40" }]}>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: color + "18", borderRadius: Radius.lg }]} />
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: color + "CC" }]}>{label}</Text>
    </View>
  );
}

// Status colors follow real transit-app semantics: movement states are blue,
// "at stop" is green. Red is reserved for crowd severity only — using red
// for "Approaching" misreads as danger instead of motion.
const STATUS_CONFIG: Record<BusStatus, { label: string; color: string }> = {
  At_Stop:     { label: "● At Stop",     color: "#22c55e" }, // green
  Approaching: { label: "● Approaching", color: "#60A5FA" }, // light blue
  Departed:    { label: "● Running",     color: "#3B82F6" }, // blue
  Upcoming:    { label: "● Running",     color: "#3B82F6" }, // blue
};

function BusCard({
  bus,
  userLocation,
  isTop,
  dataUpdatedAt,
  liveFreq,
}: {
  bus: LiveBus;
  userLocation: { lat: number; lng: number } | null;
  isTop: boolean;
  dataUpdatedAt: number;
  liveFreq?: { freq: number; isLive: boolean };
}) {
  const config = BUS_TYPE_CONFIG[bus.busType] || BUS_TYPE_CONFIG.Ordinary;
  const gradient = getBusTypeGradient(bus.busType);
  const progress = bus.totalStops > 0 ? bus.stopsCovered / bus.totalStops : 0;
  const isOffline = bus.isOnline === false;

  // ---------- Live ETA countdown (Uber-style) ----------
  // The server polls every ~12s, so a static ETA looks frozen. We snapshot
  // the pseudo-ETA at fetch time (= dataUpdatedAt) and subtract elapsed
  // minutes on every parent re-render. The parent already re-renders once
  // per second via its `secondsAgo` ticker, so this gets us a smooth
  // countdown for free — no extra timers, no module-level refs to clean.
  // CRITICAL: sort uses raw getEtaSortKey(bus) — never the live value —
  // so the list never reshuffles while a bus's local countdown ticks down.
  const baseEtaMin = getEtaMinutes(bus);
  // NOTE: do NOT wrap in useMemo — Date.now() isn't a dep, so memoizing
  // would freeze the countdown between polls. Inline compute is cheap
  // (a single subtraction) and runs fresh on every parent re-render,
  // which is exactly the 1-per-second cadence we want.
  const liveEtaMin: number | null =
    baseEtaMin == null || !dataUpdatedAt
      ? baseEtaMin
      : Math.max(0, baseEtaMin - (Date.now() - dataUpdatedAt) / 60000);

  // "Arriving" fires either from real proximity OR from the live countdown
  // dropping below 2 minutes — so the card flips to "Arriving" mid-poll
  // instead of waiting for the next fetch.
  const isArriving =
    (bus.distanceToNextStop ?? Number.POSITIVE_INFINITY) < 30 ||
    (liveEtaMin != null && liveEtaMin < 2);

  const statusInfo = bus.status ? STATUS_CONFIG[bus.status] : null;

  const etaText = isArriving
    ? "Arriving"
    : liveEtaMin == null
      ? "— min"
      : `${Math.max(1, Math.ceil(liveEtaMin))} min`;
  const nextStopShort =
    bus.nextStop.length > 22 ? bus.nextStop.slice(0, 22) + "…" : bus.nextStop;
  const arrivingColor = "#60A5FA";

  // Distance from user — store the raw km too so the catch-it logic can
  // reason about walking time without re-doing the haversine.
  const distKm = useMemo(() => {
    if (!userLocation) return null;
    return getDistanceKm(userLocation.lat, userLocation.lng, bus.lat, bus.lng);
  }, [userLocation, bus.lat, bus.lng]);
  const distLabel = useMemo(() => {
    if (distKm == null) return null;
    return distKm < 1 ? `${Math.round(distKm * 1000)} m away` : `${distKm.toFixed(1)} km away`;
  }, [distKm]);

  // ---------- "Catch it" decision signal ----------
  // Walking speed 5 km/h. Show the signal only when:
  //   - we know both walk time + ETA
  //   - bus hasn't already left the stop
  //   - bus is within useful planning range (≤8 min)
  //   - user can physically make it (walk ≤ ETA + 1 min buffer)
  // Falls back to "Good option nearby" when the bus is close + soon but
  // catchability can't be computed (e.g. no location). Catch-it always
  // wins over "Good option" so we never double-stack hints.
  const walkMin = distKm == null ? null : (distKm / 5) * 60;
  const isCatchable =
    liveEtaMin != null &&
    walkMin != null &&
    liveEtaMin > 0 &&
    liveEtaMin <= 8 &&
    walkMin <= liveEtaMin + 1;
  const isUrgent =
    isCatchable && (isArriving || (liveEtaMin != null && liveEtaMin <= 3));
  const isGoodOption =
    !isCatchable &&
    liveEtaMin != null &&
    liveEtaMin <= 5 &&
    distKm != null &&
    distKm <= 1.5;

  return (
    <Card
      onPress={() => router.push(`/route/${bus.routeId}` as any)}
      style={{
        marginBottom: 14,
        opacity: isOffline ? 0.55 : 1,
        // Best card gets a stronger green border so the eye lands on it
        // immediately. Other cards keep the subtle white-10% divider.
        borderWidth: isTop ? 1 : 0.5,
        borderColor: isTop ? "rgba(34,197,94,0.55)" : "rgba(255,255,255,0.10)",
      }}
    >
      {isTop && (
        <Text style={styles.bestOptionBadge}>Best option</Text>
      )}
      {/* Top bar accent */}
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.busAccent}
      />

      <View style={{ padding: 18, gap: 14 }}>
        {/* Header row — BIG route number + destination */}
        <View style={styles.busHeaderRow}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.busNumberBadge}
          >
            <Text style={styles.busNumberText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {bus.routeNumber}
            </Text>
          </LinearGradient>

          <View style={{ flex: 1 }}>
            <Text style={styles.toLabel}>TO</Text>
            <Text style={styles.destinationText} numberOfLines={1}>
              {bus.routeName.split("⇔").pop()?.trim() || bus.routeName}
            </Text>
          </View>
        </View>

        {/* Combined ETA + Next Stop row */}
        <View style={styles.nextStopRow}>
          <View style={styles.nextStopIcon}>
            <Feather
              name={isArriving ? "navigation" : "map-pin"}
              size={16}
              color={isArriving ? arrivingColor : Colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            {/* Hierarchy: ETA is Level 2 (bold + accent), next-stop drops
                to Level 3 (regular weight + softer color) so the eye lands
                on the time first, the destination second. */}
            <Text style={styles.etaLine} numberOfLines={1}>
              <Text
                style={{
                  color: isArriving ? arrivingColor : "#3B82F6",
                  fontFamily: "Inter_700Bold",
                  fontSize: 14,
                }}
              >
                {etaText}
              </Text>
              <Text style={styles.nextStopInline}>
                {`  •  Next: ${nextStopShort}`}
              </Text>
            </Text>
            {distLabel && (
              <Text style={styles.distanceText}>{distLabel}</Text>
            )}
            {isCatchable ? (
              <Text
                style={[
                  styles.catchItText,
                  isUrgent ? styles.catchItUrgent : styles.catchItCalm,
                ]}
                numberOfLines={1}
              >
                {/* Short, scannable copy per spec. We still gate on
                    catchability (walk ≤ eta+1) so we never falsely
                    promise a bus the user physically can't reach. */}
                {isUrgent ? "⚡ Leaving soon" : "✓ Good chance"}
              </Text>
            ) : isGoodOption ? (
              <Text style={styles.goodOptionText} numberOfLines={1}>
                Good option nearby
              </Text>
            ) : null}
          </View>
          {!isArriving && (
            <View style={styles.speedPill}>
              <Feather name="zap" size={12} color={Colors.warning} />
              <Text style={styles.speedText}>{Math.round(bus.speed)} km/h</Text>
            </View>
          )}
        </View>

        {/* Progress */}
        <View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressMetaText}>
              {`Stop ${bus.stopsCovered} of ${bus.totalStops} • ${Math.round(progress * 100)}%`}
            </Text>
          </View>
          <AnimatedProgress value={progress} gradient={gradient} height={6} />
        </View>

        {/* Crowd row — descriptive icon + text + color */}
        <CrowdRow level={bus.crowdLevel} />

        {/* Footer badges */}
        <View style={styles.busFooter}>
          <Badge variant="primary" emoji={config.icon} label={config.label} size="md" />
          {!isArriving && statusInfo && (
            <View style={[styles.statusPill, { borderColor: statusInfo.color + "66", backgroundColor: statusInfo.color + "1A" }]}>
              <Text style={[styles.statusPillText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          )}
          {liveFreq && (
            <View style={styles.freqPill}>
              <Text style={styles.freqText}>~{liveFreq.freq}/hr</Text>
              {liveFreq.isLive && (
                <Text style={styles.freqLiveTag}>live</Text>
              )}
            </View>
          )}
          {isOffline ? (
            <Badge variant="neutral" emoji="⚪" label="Offline" size="md" />
          ) : (
            <Badge variant="success" emoji="🟢" label="Live" size="md" />
          )}
          {bus.isLastBus && <LastBusBadge size="md" />}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark.background },
  bgGradient: { ...StyleSheet.absoluteFillObject },

  topRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
  title: { ...Type.title, color: Colors.dark.text, lineHeight: 32 },
  liveStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  liveStatusText: { ...Type.body, color: Colors.dark.textSecondary },
  profileBtn: {
    width: MinTouch, height: MinTouch, borderRadius: MinTouch / 2,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1, borderColor: Colors.dark.cardBorder,
    alignItems: "center", justifyContent: "center",
  },

  statsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  statsBannerIcon: { fontSize: 28 },
  statsBannerValue: { fontSize: 30, fontFamily: "Inter_700Bold", color: Colors.dark.text, letterSpacing: -0.5 },
  statsBannerLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.dark.textMuted, letterSpacing: 0.5, textTransform: "uppercase" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  statCard: {
    width: "47.5%",
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: "hidden",
    minHeight: 90,
    justifyContent: "space-between",
    borderWidth: 1,
  },
  statOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 2, letterSpacing: -0.5 },
  statLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.0,
    textTransform: "uppercase",
    marginTop: 2,
  },

  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    minHeight: 44,
  },
  chipActive: {
    backgroundColor: "rgba(59,130,246,0.18)",
    borderColor: "#3B82F6",
  },
  chipText: { ...Type.body, color: Colors.dark.textSecondary },
  chipTextActive: { color: "#3B82F6", fontFamily: "Inter_700Bold" },

  sectionTitle: { ...Type.heading, color: Colors.dark.text },
  sectionTitleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 20, marginBottom: 10, gap: 8 },
  sectionCaption: { ...Type.caption, color: Colors.dark.textMuted, flexShrink: 1, textAlign: "right" },
  offlineBanner: {
    ...Type.caption,
    color: Colors.warning,
    backgroundColor: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.35)",
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  fetchHint: {
    ...Type.caption,
    color: Colors.dark.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
  distanceText: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  etaLine: {
    fontSize: 14,
    lineHeight: 18,
  },
  nextStopInline: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  liveLabel: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    fontFamily: "Inter_600SemiBold",
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  sortExplain: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
    marginBottom: 4,
  },
  freqPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  freqText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.textSecondary,
  },
  freqLiveTag: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#22c55e",
    backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: "hidden",
  },
  smallListHint: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 10,
  },
  bestOptionBadge: {
    position: "absolute",
    top: 8,
    right: 12,
    fontSize: 10,
    color: "#22c55e",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    zIndex: 2,
  },
  catchItText: {
    fontSize: 12,
    marginTop: 3,
    letterSpacing: 0.1,
  },
  catchItUrgent: {
    color: "#F97316",
    fontFamily: "Inter_700Bold",
  },
  catchItCalm: {
    color: "#22C55E",
    fontFamily: "Inter_600SemiBold",
  },
  goodOptionText: {
    fontSize: 11,
    marginTop: 3,
    color: "#22C55E",
    fontFamily: "Inter_500Medium",
  },

  busAccent: { height: 4, width: "100%" },
  busHeaderRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  busNumberBadge: {
    minWidth: 78, height: 60,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: "center", justifyContent: "center",
  },
  busNumberText: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.3 },
  toLabel: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.dark.textMuted, letterSpacing: 1.2 },
  destinationText: { ...Type.subtitle, color: Colors.dark.text, marginTop: 2 },

  nextStopRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "rgba(37,99,235,0.10)",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.25)",
  },
  nextStopIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(37,99,235,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  nextStopLabel: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.primary, letterSpacing: 1.2 },
  nextStopValue: { ...Type.body, fontFamily: "Inter_700Bold", color: Colors.dark.text, marginTop: 1 },

  speedPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.warningSoft,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: "rgba(245,158,11,0.3)",
  },
  speedText: { fontSize: 13, color: Colors.warning, fontFamily: "Inter_700Bold" },

  arrivingPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
  },
  arrivingText: { fontSize: 13, color: "#fff", fontFamily: "Inter_700Bold" },

  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  progressMeta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressMetaText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.dark.textSecondary },

  busFooter: { flexDirection: "row", gap: 8, flexWrap: "wrap" },

  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyText: { ...Type.subtitle, color: Colors.dark.text, marginTop: 12, textAlign: "center" },
  emptySub: { ...Type.body, color: Colors.dark.textMuted, textAlign: "center", paddingHorizontal: 20 },
  emptyCta: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 16,
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: "rgba(37,99,235,0.15)",
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: "rgba(37,99,235,0.4)",
  },
  emptyCtaText: { ...Type.body, color: Colors.primary, fontFamily: "Inter_700Bold" },
});
