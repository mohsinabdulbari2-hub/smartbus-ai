import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
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
import { api, type LiveBus, type BusType } from "@/lib/api";

const FILTERS: { key: BusType | "All"; label: string; emoji: string }[] = [
  { key: "All",         label: "All",      emoji: "🚍" },
  { key: "Vajra",       label: "Vajra",    emoji: "❄️" },
  { key: "Volvo",       label: "Volvo",    emoji: "🌟" },
  { key: "Ordinary",    label: "Ordinary", emoji: "🚌" },
  { key: "Airport",     label: "Airport",  emoji: "✈️" },
  { key: "MetroFeeder", label: "Metro",    emoji: "🚇" },
  { key: "Night",       label: "Night",    emoji: "🌙" },
];

function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

export default function LiveScreen() {
  const [filter, setFilter] = useState<BusType | "All">("All");
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [, force] = useState(0);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["liveBuses"],
    queryFn: api.getLiveBusesWithMeta,
    refetchInterval: 12000,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (data) setLastUpdate(Date.now());
  }, [data]);

  // Tick "X sec ago" every second
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const buses = data?.buses ?? [];
  // Real fleet size from X-Total-Count header. The response body is
  // server-capped at 100 — using it for "Buses on road" would have
  // dramatically under-reported the live fleet.
  const fleetTotal = data?.total ?? buses.length;
  const filtered = useMemo(
    () => (filter === "All" ? buses : buses.filter((b) => b.busType === filter)),
    [buses, filter],
  );

  const stats = useMemo(() => {
    const live = buses.filter((b) => b.isOnline !== false);
    const sampleCrowded = live.filter(
      (b) => b.crowdLevel === "High" || b.crowdLevel === "VeryHigh",
    ).length;
    const sampleEmpty = live.filter((b) => b.crowdLevel === "Low").length;
    // Project the sample's crowd/empty ratios onto the real fleet size so
    // the three stat cards stay coherent (you can't have 30 crowded buses
    // out of "65 on road" when the real fleet is 700).
    const sampleSize = Math.max(1, live.length);
    const ratio = fleetTotal / sampleSize;
    return {
      total: fleetTotal,
      crowded: Math.round(sampleCrowded * ratio),
      empty: Math.round(sampleEmpty * ratio),
    };
  }, [buses, fleetTotal]);

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
              crowded={stats.crowded}
              empty={stats.empty}
              filter={filter}
              setFilter={setFilter}
              lastUpdate={lastUpdate}
              showingCount={filtered.length}
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 360)).springify()}>
              <BusCard bus={item} />
            </Animated.View>
          )}
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
                  {filter === "All" ? "No buses on the road right now" : `No ${filter} buses running`}
                </Text>
                <Text style={styles.emptySub}>
                  {filter === "All"
                    ? "Pull down to refresh in a moment"
                    : "Try another bus type or tap All to see everything"}
                </Text>
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
  total, crowded, empty, filter, setFilter, lastUpdate, showingCount,
}: {
  total: number; crowded: number; empty: number;
  filter: BusType | "All"; setFilter: (f: BusType | "All") => void;
  lastUpdate: number;
  showingCount: number;
}) {
  return (
    <View style={{ paddingTop: 8, paddingBottom: 16 }}>
      {/* Top header */}
      <Animated.View entering={FadeInUp.duration(450)}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Live Buses Near You</Text>
            <View style={styles.liveStatusRow}>
              <PulseDot color={Colors.success} size={10} />
              <Text style={styles.liveStatusText}>
                Updated {timeAgo(lastUpdate)}
              </Text>
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
        <View style={styles.statsRow}>
          <StatCard
            label="Buses on road"
            value={total}
            icon="🚍"
            gradient={Colors.gradients.primary}
            glow={Colors.primaryGlow}
          />
          <StatCard
            label="Less crowded"
            value={empty}
            icon="🟢"
            gradient={Colors.gradients.success}
            glow="rgba(34,197,94,0.3)"
          />
          <StatCard
            label="Crowded"
            value={crowded}
            icon="🔴"
            gradient={Colors.gradients.danger}
            glow="rgba(239,68,68,0.3)"
          />
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

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Live buses</Text>
        <Text style={styles.sectionCaption}>
          {showingCount < 20 && total > showingCount
            ? `No buses nearby • Showing nearest ${showingCount}`
            : `Showing ${showingCount.toLocaleString()} of ${total.toLocaleString()} buses`}
        </Text>
      </View>
    </View>
  );
}

function StatCard({
  label, value, icon, gradient, glow,
}: { label: string; value: number; icon: string; gradient: [string, string]; glow: string }) {
  return (
    <View style={[styles.statCard, Shadow.glow(glow)]}>
      <LinearGradient
        colors={gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.statOverlay} />
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BusCard({ bus }: { bus: LiveBus }) {
  const config = BUS_TYPE_CONFIG[bus.busType] || BUS_TYPE_CONFIG.Ordinary;
  const gradient = getBusTypeGradient(bus.busType);
  const progress = bus.totalStops > 0 ? bus.stopsCovered / bus.totalStops : 0;
  const isOffline = bus.isOnline === false;

  return (
    <Card
      onPress={() => router.push(`/route/${bus.routeId}` as any)}
      glow={isOffline ? undefined : `${config.color}40`}
      style={{ marginBottom: 14, opacity: isOffline ? 0.55 : 1 }}
    >
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

        {/* Next stop — highlighted */}
        <View style={styles.nextStopRow}>
          <View style={styles.nextStopIcon}>
            <Feather name="map-pin" size={16} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextStopLabel}>NEXT STOP</Text>
            <Text style={styles.nextStopValue} numberOfLines={1}>
              {bus.nextStop}
            </Text>
          </View>
          <View style={styles.speedPill}>
            <Feather name="zap" size={12} color={Colors.warning} />
            <Text style={styles.speedText}>{Math.round(bus.speed)} km/h</Text>
          </View>
        </View>

        {/* Progress */}
        <View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressMetaText}>
              Stop {bus.stopsCovered} of {bus.totalStops}
            </Text>
            <Text style={styles.progressMetaText}>
              {Math.round(progress * 100)}% complete
            </Text>
          </View>
          <AnimatedProgress value={progress} gradient={gradient} height={6} />
        </View>

        {/* Crowd row — descriptive icon + text + color */}
        <CrowdRow level={bus.crowdLevel} />

        {/* Footer badges */}
        <View style={styles.busFooter}>
          <Badge variant="primary" emoji={config.icon} label={config.label} size="md" />
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

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  statCard: {
    flex: 1,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 12,
    overflow: "hidden",
    minHeight: 110,
    justifyContent: "space-between",
  },
  statOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 4, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.95)", letterSpacing: 0.3 },

  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.dark.cardBorder,
    minHeight: 44,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadow.glow(Colors.primaryGlow),
  },
  chipText: { ...Type.body, color: Colors.dark.textSecondary },
  chipTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },

  sectionTitle: { ...Type.heading, color: Colors.dark.text },
  sectionTitleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 20, marginBottom: 10, gap: 8 },
  sectionCaption: { ...Type.caption, color: Colors.dark.textMuted, flexShrink: 1, textAlign: "right" },

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
