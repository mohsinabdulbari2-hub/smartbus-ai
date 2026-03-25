import { Feather, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CrowdBadge, LastBusBadge } from "@/components/CrowdBadge";
import Colors from "@/constants/colors";
import { api, LiveBus } from "@/lib/api";

function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const nativeDriver = Platform.OS !== "web";
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.6, duration: 800, useNativeDriver: nativeDriver }),
        Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: nativeDriver }),
      ])
    ).start();
  }, []);
  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotRing, { transform: [{ scale }] }]} />
      <View style={styles.dot} />
    </View>
  );
}

function BusCard({ bus }: { bus: LiveBus }) {
  const crowdBarWidth = bus.crowdLevel === "High" ? "85%" : bus.crowdLevel === "Medium" ? "50%" : "25%";
  const crowdBarColor = bus.crowdLevel === "High" ? Colors.danger : bus.crowdLevel === "Medium" ? Colors.warning : Colors.success;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: "/route/[id]", params: { id: bus.routeId } })}
    >
      {/* Route color accent */}
      <View style={[styles.cardAccent, { backgroundColor: bus.routeColor || Colors.primary }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.routeBadge, { backgroundColor: bus.routeColor || Colors.primary }]}>
            <Text style={styles.routeNumber}>{bus.routeNumber}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.routeName} numberOfLines={1}>{bus.routeName}</Text>
            <View style={styles.nextStop}>
              <Feather name="navigation" size={11} color={Colors.dark.textMuted} />
              <Text style={styles.nextStopText} numberOfLines={1}>→ {bus.nextStop}</Text>
            </View>
          </View>
          <View style={styles.speedBox}>
            <Text style={styles.speedValue}>{Number(bus.speed).toFixed(0)}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.badges}>
            <CrowdBadge level={bus.crowdLevel} />
            {bus.isLastBus && <LastBusBadge />}
          </View>
          <View style={styles.crowdBarWrap}>
            <View style={[styles.crowdBar, { width: crowdBarWidth as any, backgroundColor: crowdBarColor }]} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const { data: buses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["live-buses"],
    queryFn: api.getLiveBuses,
    refetchInterval: 3000,
  });

  const crowdCounts = buses?.reduce(
    (acc, b) => {
      acc[b.crowdLevel] = (acc[b.crowdLevel] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) ?? {};

  return (
    <View style={[styles.container, { backgroundColor: Colors.dark.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.headerTitle}>
            Smart<Text style={styles.headerTitleAccent}>Bus</Text> AI
          </Text>
          <Text style={styles.headerSub}>Bangalore Transit Intelligence</Text>
        </View>
        <View style={styles.liveChip}>
          <PulseDot />
          <Text style={styles.liveText}>
            {isLoading ? "..." : `${buses?.length ?? 0} Live`}
          </Text>
        </View>
      </View>

      {/* Stats row */}
      {buses && buses.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>{crowdCounts["Low"] ?? 0}</Text>
            <Text style={styles.statLabel}>Low Crowd</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{crowdCounts["Medium"] ?? 0}</Text>
            <Text style={styles.statLabel}>Medium</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.danger }]}>{crowdCounts["High"] ?? 0}</Text>
            <Text style={styles.statLabel}>High Crowd</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.accent }]}>8</Text>
            <Text style={styles.statLabel}>Routes</Text>
          </View>
        </View>
      )}

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fleet Status</Text>
        <View style={styles.refreshBadge}>
          <Ionicons name="refresh" size={11} color={Colors.dark.textMuted} />
          <Text style={styles.refreshText}>Refreshing every 3s</Text>
        </View>
      </View>

      <FlatList
        data={buses}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <BusCard bus={item} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 80 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="radio" size={48} color={Colors.dark.textMuted} />
            <Text style={styles.emptyTitle}>
              {isLoading ? "Acquiring GPS feeds..." : "No buses active"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#f1f5f9",
    letterSpacing: -0.5,
  },
  headerTitleAccent: { color: "#f97316" },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#475569",
    marginTop: 2,
  },
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
  liveText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#22c55e",
  },
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
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#475569", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#1e293b" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  refreshBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  refreshText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#475569" },
  list: { paddingHorizontal: 20, gap: 12 },
  card: {
    backgroundColor: "#1a2235",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    overflow: "hidden",
    flexDirection: "row",
  },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  routeBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  routeNumber: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  cardMeta: { flex: 1 },
  routeName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#f1f5f9",
    marginBottom: 4,
  },
  nextStop: { flexDirection: "row", alignItems: "center", gap: 4 },
  nextStopText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#475569",
  },
  speedBox: { alignItems: "flex-end" },
  speedValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#f97316" },
  speedUnit: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#475569" },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badges: { flexDirection: "row", gap: 6, alignItems: "center" },
  crowdBarWrap: {
    height: 4,
    width: 60,
    backgroundColor: "#1e293b",
    borderRadius: 2,
    overflow: "hidden",
  },
  crowdBar: { height: 4, borderRadius: 2 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "#475569",
  },
});
