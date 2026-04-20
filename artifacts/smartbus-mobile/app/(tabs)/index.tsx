import { Feather, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
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
import Colors from "@/constants/colors";
import { api, LiveBus } from "@/lib/api";

function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const nativeDriver = Platform.OS !== "web";
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.6, duration: 900, useNativeDriver: nativeDriver }),
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

function crowdLabel(level: string) {
  if (level === "High") return "Crowded";
  if (level === "Medium") return "Some seats";
  return "Empty seats";
}

function BusCard({ bus }: { bus: LiveBus }) {
  const crowdColor = bus.crowdLevel === "High" ? Colors.danger : bus.crowdLevel === "Medium" ? Colors.warning : Colors.success;
  const total = bus.totalStops ?? 1;
  const covered = bus.stopsCovered ?? 0;
  const remaining = bus.stopsRemaining ?? Math.max(0, total - 1 - covered);
  const journeyPct = total > 1 ? Math.min(1, Math.max(0, covered / (total - 1))) : 0;

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: "/route/[id]", params: { id: bus.routeId } });
      }}
    >
      {/* Top row: big route number + name */}
      <View style={s.cardTop}>
        <View style={[s.routeBadge, { backgroundColor: bus.routeColor || Colors.primary }]}>
          <Text style={s.routeNumber} numberOfLines={1}>{bus.routeNumber}</Text>
        </View>
        <View style={s.cardMeta}>
          <Text style={s.routeName} numberOfLines={2}>{bus.routeName}</Text>
        </View>
      </View>

      {/* Going to: BIG */}
      <View style={s.goingTo}>
        <Feather name="navigation" size={16} color={Colors.primary} />
        <Text style={s.goingToLabel}>Going to</Text>
        <Text style={s.goingToStop} numberOfLines={1}>{bus.nextStop}</Text>
      </View>

      {/* Big stop progress */}
      <View style={s.progressBlock}>
        <View style={s.progressTopRow}>
          <Text style={s.progressBigText}>
            <Text style={s.progressBigNum}>{covered}</Text> stops done
          </Text>
          <Text style={s.progressBigText}>
            <Text style={[s.progressBigNum, { color: Colors.primary }]}>{remaining}</Text> to go
          </Text>
        </View>
        <View style={s.progressBarTrack}>
          <View style={[s.progressBarFill, { width: `${journeyPct * 100}%` as any, backgroundColor: bus.routeColor || Colors.primary }]} />
        </View>
        <Text style={s.progressStopCount}>Stop {Math.min(covered + 1, total)} of {total}</Text>
      </View>

      {/* Bottom: crowd + last bus warning */}
      <View style={s.cardBottom}>
        <View style={[s.crowdPill, { backgroundColor: crowdColor + "15", borderColor: crowdColor + "40" }]}>
          <View style={[s.crowdDot, { backgroundColor: crowdColor }]} />
          <Text style={[s.crowdText, { color: crowdColor }]}>{crowdLabel(bus.crowdLevel)}</Text>
        </View>
        {bus.isLastBus && (
          <View style={s.lastBusPill}>
            <Feather name="moon" size={13} color={Colors.warning} />
            <Text style={s.lastBusText}>Last bus tonight</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function LiveScreen() {
  const insets = useSafeAreaInsets();

  const { data: buses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["live-buses"],
    queryFn: api.getLiveBuses,
    refetchInterval: 5000,
  });

  const refreshSpin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isRefetching) {
      refreshSpin.setValue(0);
      const loop = Animated.loop(
        Animated.timing(refreshSpin, {
          toValue: 1,
          duration: 800,
          useNativeDriver: Platform.OS !== "web",
        })
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isRefetching]);

  return (
    <View style={[s.container, { backgroundColor: Colors.dark.background }]}>
      {/* Simple header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={s.headerTitle}>
            Smart<Text style={{ color: Colors.primary }}>Bus</Text>
          </Text>
          <Text style={s.headerSub}>BMTC Bengaluru · Live buses</Text>
        </View>
        <View style={s.liveChip}>
          <PulseDot />
          <Text style={s.liveText}>{buses?.length ?? 0} buses</Text>
        </View>
      </View>

      {/* One big refresh button */}
      <Pressable
        onPress={() => { Haptics.selectionAsync(); refetch(); }}
        style={({ pressed }) => [s.bigRefresh, pressed && { opacity: 0.85 }]}
      >
        <Animated.View style={isRefetching ? { transform: [{ rotate: refreshSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] } : undefined}>
          <Ionicons name="refresh" size={18} color={"#fff"} />
        </Animated.View>
        <Text style={s.bigRefreshText}>{isRefetching ? "Updating live data..." : "Tap to refresh"}</Text>
      </Pressable>

      <FlatList
        data={buses ?? []}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <BusCard bus={item} />}
        contentContainerStyle={[s.list, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 56 }}>🚌</Text>
            <Text style={s.emptyTitle}>{isLoading ? "Loading buses..." : "No buses right now"}</Text>
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
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#0f172a", letterSpacing: -0.5 },
  headerSub: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#64748b", marginTop: 2 },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
    marginTop: 6,
  },
  liveText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#16a34a" },
  dotWrap: { width: 12, height: 12, alignItems: "center", justifyContent: "center" },
  dotRing: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(34,197,94,0.3)",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" },

  bigRefresh: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    marginBottom: 14,
    paddingVertical: 14,
    borderRadius: 16,
  },
  bigRefreshText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },

  list: { paddingHorizontal: 20, gap: 14 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 18,
  },
  cardPressed: { opacity: 0.85 },

  cardTop: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  routeBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  routeNumber: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  cardMeta: { flex: 1 },
  routeName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0f172a", lineHeight: 22 },

  goingTo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(37,99,235,0.06)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  goingToLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748b" },
  goingToStop: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0f172a", flex: 1 },

  progressBlock: { marginBottom: 14 },
  progressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressBigText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#64748b" },
  progressBigNum: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#16a34a" },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: { height: 8, borderRadius: 4 },
  progressStopCount: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 6,
  },

  cardBottom: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  crowdPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  crowdDot: { width: 8, height: 8, borderRadius: 4 },
  crowdText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  lastBusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    backgroundColor: "rgba(245,158,11,0.1)",
    borderColor: "rgba(245,158,11,0.3)",
  },
  lastBusText: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.warning },

  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_500Medium", color: "#64748b" },
});
