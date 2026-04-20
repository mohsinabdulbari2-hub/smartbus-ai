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

import { CrowdBadge, BUS_TYPE_CONFIG, getBusTypeGradient, LastBusBadge } from "@/components/CrowdBadge";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PulseDot } from "@/components/ui/PulseDot";
import { AnimatedProgress } from "@/components/ui/AnimatedProgress";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { SmartSuggestion } from "@/components/ui/SmartSuggestion";
import Colors from "@/constants/colors";
import { Radius, Shadow, Spacing, Type } from "@/constants/theme";
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
    queryFn: api.getLiveBuses,
    refetchInterval: 12000,
  });

  useEffect(() => {
    if (data) setLastUpdate(Date.now());
  }, [data]);

  // Tick "X sec ago" every second
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const buses = data ?? [];
  const filtered = useMemo(
    () => (filter === "All" ? buses : buses.filter((b) => b.busType === filter)),
    [buses, filter],
  );

  const stats = useMemo(() => {
    const total = buses.length;
    const crowded = buses.filter((b) => b.crowdLevel === "High").length;
    const empty = buses.filter((b) => b.crowdLevel === "Low").length;
    return { total, crowded, empty };
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
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 600)).springify()}>
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
                <Text style={styles.emptyText}>No buses match this filter</Text>
                <Text style={styles.emptySub}>Try a different bus type</Text>
              </View>
            )
          }
        />
      </SafeAreaView>
    </View>
  );
}

function Header({
  total, crowded, empty, filter, setFilter, lastUpdate,
}: {
  total: number; crowded: number; empty: number;
  filter: BusType | "All"; setFilter: (f: BusType | "All") => void;
  lastUpdate: number;
}) {
  return (
    <View style={{ paddingTop: 8, paddingBottom: 16 }}>
      {/* Top header */}
      <Animated.View entering={FadeInUp.duration(450)}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <PulseDot color={Colors.success} size={10} />
              <Text style={styles.liveLabel}>LIVE TRACKING</Text>
            </View>
            <Text style={styles.title}>SmartBus AI</Text>
            <Text style={styles.subtitle}>
              {total} buses on road · Updated {timeAgo(lastUpdate)}
            </Text>
          </View>
          <Pressable
            onPress={() => Haptics.selectionAsync()}
            style={styles.profileBtn}
          >
            <Feather name="user" size={18} color={Colors.dark.text} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Stat cards */}
      <Animated.View entering={FadeInUp.delay(80).duration(450)}>
        <View style={styles.statsRow}>
          <StatCard
            label="ON ROAD"
            value={total}
            icon="🚍"
            gradient={Colors.gradients.primary}
            glow={Colors.primaryGlow}
          />
          <StatCard
            label="EMPTY"
            value={empty}
            icon="🟢"
            gradient={Colors.gradients.success}
            glow="rgba(34,197,94,0.3)"
          />
          <StatCard
            label="CROWDED"
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

      <Text style={styles.sectionTitle}>Live buses</Text>
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

  return (
    <Card
      onPress={() => router.push(`/route/${bus.routeId}` as any)}
      glow={`${config.color}40`}
      style={{ marginBottom: 12 }}
    >
      {/* Top bar accent */}
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.busAccent}
      />

      <View style={{ padding: 16, gap: 12 }}>
        {/* Header row */}
        <View style={styles.busHeaderRow}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.busNumberBadge}
          >
            <Text style={styles.busNumberText} numberOfLines={1}>{bus.routeNumber}</Text>
          </LinearGradient>

          <View style={{ flex: 1 }}>
            <Text style={styles.routeName} numberOfLines={1}>{bus.routeName}</Text>
            <Text style={styles.routePath} numberOfLines={1}>
              <Feather name="navigation" size={11} color={Colors.dark.textMuted} /> {bus.currentStop}
            </Text>
          </View>

          <View style={styles.speedPill}>
            <Feather name="zap" size={11} color={Colors.warning} />
            <Text style={styles.speedText}>{Math.round(bus.speed)}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
        </View>

        {/* Progress */}
        <View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressMetaText}>
              {bus.stopsCovered} / {bus.totalStops} stops
            </Text>
            <Text style={styles.progressMetaText}>
              <Feather name="map-pin" size={10} color={Colors.dark.textMuted} /> {bus.nextStop}
            </Text>
          </View>
          <AnimatedProgress value={progress} gradient={gradient} height={5} />
        </View>

        {/* Footer badges */}
        <View style={styles.busFooter}>
          <Badge variant="primary" emoji={config.icon} label={config.label} size="sm" />
          <CrowdBadge level={bus.crowdLevel} />
          {bus.isLastBus && <LastBusBadge />}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark.background },
  bgGradient: { ...StyleSheet.absoluteFillObject },

  topRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 18 },
  liveLabel: { ...Type.micro, color: Colors.success, letterSpacing: 1.5 },
  title: { ...Type.display, color: Colors.dark.text, marginTop: 2 },
  subtitle: { ...Type.caption, color: Colors.dark.textMuted, marginTop: 2 },
  profileBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1, borderColor: Colors.dark.cardBorder,
    alignItems: "center", justifyContent: "center",
  },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 12,
    overflow: "hidden",
    minHeight: 92,
    justifyContent: "space-between",
  },
  statOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  statIcon: { fontSize: 18 },
  statValue: { ...Type.title, color: "#fff", marginTop: 4 },
  statLabel: { ...Type.micro, color: "rgba(255,255,255,0.85)", letterSpacing: 1 },

  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.dark.cardBorder,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadow.glow(Colors.primaryGlow),
  },
  chipText: { ...Type.caption, color: Colors.dark.textSecondary },
  chipTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },

  sectionTitle: { ...Type.heading, color: Colors.dark.text, marginTop: 18, marginBottom: 8 },

  busAccent: { height: 3, width: "100%" },
  busHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  busNumberBadge: {
    minWidth: 56, height: 44,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: "center", justifyContent: "center",
  },
  busNumberText: { ...Type.heading, color: "#fff", letterSpacing: 0.3 },
  routeName: { ...Type.subtitle, color: Colors.dark.text },
  routePath: { ...Type.caption, color: Colors.dark.textMuted, marginTop: 2 },
  speedPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.warningSoft,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: "rgba(245,158,11,0.3)",
  },
  speedText: { ...Type.caption, color: Colors.warning, fontFamily: "Inter_700Bold" },
  speedUnit: { fontSize: 9, color: Colors.warning, fontFamily: "Inter_500Medium" },

  progressMeta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressMetaText: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted },

  busFooter: { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyText: { ...Type.subtitle, color: Colors.dark.text, marginTop: 12 },
  emptySub: { ...Type.caption, color: Colors.dark.textMuted },
});
