import { Feather, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BusTypeBadge, BUS_TYPE_CONFIG, CrowdBadge, LastBusBadge } from "@/components/CrowdBadge";
import Colors from "@/constants/colors";
import { api, BusType, LiveBus } from "@/lib/api";

const ALL_BUS_TYPES: Array<{ key: string; label: string; icon: string }> = [
  { key: "All", label: "All", icon: "🚌" },
  { key: "Ordinary", label: "Ordinary", icon: "🚌" },
  { key: "Vajra", label: "Vajra AC", icon: "❄️" },
  { key: "Volvo", label: "Volvo AC", icon: "⭐" },
  { key: "Airport", label: "Airport", icon: "✈️" },
  { key: "MetroFeeder", label: "Metro Feeder", icon: "🚇" },
  { key: "Night", label: "Night", icon: "🌙" },
];

function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const nativeDriver = Platform.OS !== "web";
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 900, useNativeDriver: nativeDriver }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: nativeDriver }),
      ])
    ).start();
  }, []);
  return (
    <View style={s.dotWrap}>
      <Animated.View style={[s.dotRing, { transform: [{ scale }] }]} />
      <View style={s.dot} />
    </View>
  );
}

function BusCard({ bus }: { bus: LiveBus }) {
  const crowdBarPct = bus.crowdLevel === "High" ? 0.85 : bus.crowdLevel === "Medium" ? 0.5 : 0.22;
  const crowdColor = bus.crowdLevel === "High" ? Colors.danger : bus.crowdLevel === "Medium" ? Colors.warning : Colors.success;
  const typeConf = BUS_TYPE_CONFIG[bus.busType] || BUS_TYPE_CONFIG.Ordinary;

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: "/route/[id]", params: { id: bus.routeId } });
      }}
    >
      <View style={[s.cardAccent, { backgroundColor: bus.routeColor || Colors.primary }]} />
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <View style={[s.routeBadge, { backgroundColor: bus.routeColor || Colors.primary }]}>
            <Text style={s.routeNumber} numberOfLines={1}>{bus.routeNumber}</Text>
          </View>
          <View style={s.cardMeta}>
            <Text style={s.routeName} numberOfLines={1}>{bus.routeName}</Text>
            <View style={s.nextStopRow}>
              <Feather name="navigation" size={11} color={Colors.dark.textMuted} />
              <Text style={s.nextStopText} numberOfLines={1}>→ {bus.nextStop}</Text>
            </View>
          </View>
          <View style={s.speedBox}>
            <Text style={s.speedVal}>{Number(bus.speed).toFixed(0)}</Text>
            <Text style={s.speedUnit}>km/h</Text>
          </View>
        </View>
        <View style={s.cardBottom}>
          <View style={s.badgeRow}>
            <BusTypeBadge busType={bus.busType} />
            <CrowdBadge level={bus.crowdLevel} />
            {bus.isLastBus && <LastBusBadge />}
          </View>
          <View style={s.crowdBarWrap}>
            <View style={[s.crowdBar, { width: `${crowdBarPct * 100}%` as any, backgroundColor: crowdColor }]} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const [typeFilter, setTypeFilter] = useState("All");

  const { data: buses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["live-buses"],
    queryFn: api.getLiveBuses,
    refetchInterval: 3000,
  });

  const filtered = useMemo(() => {
    if (!buses) return [];
    if (typeFilter === "All") return buses;
    return buses.filter(b => b.busType === typeFilter);
  }, [buses, typeFilter]);

  const typeCounts = useMemo(() => {
    if (!buses) return {} as Record<string, number>;
    return buses.reduce((acc, b) => {
      acc[b.busType] = (acc[b.busType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [buses]);

  const crowdCounts = useMemo(() => {
    if (!buses) return { Low: 0, Medium: 0, High: 0 };
    return buses.reduce((acc, b) => {
      acc[b.crowdLevel as keyof typeof acc] = (acc[b.crowdLevel as keyof typeof acc] || 0) + 1;
      return acc;
    }, { Low: 0, Medium: 0, High: 0 });
  }, [buses]);

  return (
    <View style={[s.container, { backgroundColor: Colors.dark.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>
            Smart<Text style={{ color: Colors.primary }}>Bus</Text> AI
          </Text>
          <Text style={s.headerSub}>BMTC · Bengaluru</Text>
        </View>
        <View style={s.liveChip}>
          <PulseDot />
          <Text style={s.liveText}>{buses?.length ?? 0} Active</Text>
        </View>
      </View>

      {/* Fleet stats row */}
      {buses && buses.length > 0 && (
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: Colors.success }]}>{crowdCounts.Low}</Text>
            <Text style={s.statLbl}>Low Crowd</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: Colors.warning }]}>{crowdCounts.Medium}</Text>
            <Text style={s.statLbl}>Medium</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: Colors.danger }]}>{crowdCounts.High}</Text>
            <Text style={s.statLbl}>High</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: Colors.accent }]}>{Object.keys(typeCounts).length}</Text>
            <Text style={s.statLbl}>Types</Text>
          </View>
        </View>
      )}

      {/* Bus type filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeFilter}>
        {ALL_BUS_TYPES.filter(t => t.key === "All" || (typeCounts[t.key] ?? 0) > 0).map((t) => {
          const isActive = typeFilter === t.key;
          const cfg = t.key !== "All" ? BUS_TYPE_CONFIG[t.key] : null;
          return (
            <Pressable
              key={t.key}
              onPress={() => { setTypeFilter(t.key); Haptics.selectionAsync(); }}
              style={[
                s.typeTab,
                isActive && { backgroundColor: cfg ? cfg.text + "22" : "rgba(249,115,22,0.15)", borderColor: cfg ? cfg.text : Colors.primary },
              ]}
            >
              <Text style={s.typeTabIcon}>{t.icon}</Text>
              <Text style={[s.typeTabLabel, isActive && { color: cfg ? cfg.text : Colors.primary }]}>{t.label}</Text>
              {t.key !== "All" && (typeCounts[t.key] ?? 0) > 0 && (
                <View style={[s.typeCount, { backgroundColor: cfg ? cfg.text + "22" : Colors.primary + "22" }]}>
                  <Text style={[s.typeCountText, { color: cfg ? cfg.text : Colors.primary }]}>{typeCounts[t.key]}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Section header */}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>
          {typeFilter === "All" ? "All Active Buses" : `${typeFilter === "MetroFeeder" ? "Metro Feeder" : typeFilter} Buses`}
          <Text style={{ color: Colors.dark.textMuted, fontSize: 13 }}> ({filtered.length})</Text>
        </Text>
        <View style={s.refreshRow}>
          <Ionicons name="refresh" size={11} color={Colors.dark.textMuted} />
          <Text style={s.refreshText}>Live · 3s</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <BusCard bus={item} />}
        contentContainerStyle={[s.list, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>{typeFilter !== "All" ? BUS_TYPE_CONFIG[typeFilter]?.icon ?? "🚌" : "🚌"}</Text>
            <Text style={s.emptyTitle}>{isLoading ? "Acquiring GPS feeds..." : "No buses active"}</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: {},
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#f1f5f9", letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569", marginTop: 2 },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.2)",
    marginTop: 4,
  },
  liveText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#22c55e" },
  dotWrap: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  dotRing: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(34,197,94,0.3)",
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "#1a2235",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  statItem: { flex: 1, alignItems: "center" },
  statVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#475569", marginTop: 2 },
  statDiv: { width: 1, backgroundColor: "#1e293b" },
  typeFilter: { paddingHorizontal: 20, marginBottom: 12 },
  typeTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#1a2235",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginRight: 8,
  },
  typeTabIcon: { fontSize: 13 },
  typeTabLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#475569" },
  typeCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  typeCountText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  refreshRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  refreshText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#475569" },
  list: { paddingHorizontal: 20, gap: 10 },
  card: {
    backgroundColor: "#1a2235",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    overflow: "hidden",
    flexDirection: "row",
  },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  routeBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  routeNumber: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  cardMeta: { flex: 1 },
  routeName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#f1f5f9", marginBottom: 4 },
  nextStopRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  nextStopText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569" },
  speedBox: { alignItems: "flex-end" },
  speedVal: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#f97316" },
  speedUnit: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#475569" },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  badgeRow: { flexDirection: "row", gap: 5, alignItems: "center", flexWrap: "wrap" },
  crowdBarWrap: {
    height: 4,
    width: 50,
    backgroundColor: "#1e293b",
    borderRadius: 2,
    overflow: "hidden",
  },
  crowdBar: { height: 4, borderRadius: 2 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 14 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_500Medium", color: "#475569" },
});
