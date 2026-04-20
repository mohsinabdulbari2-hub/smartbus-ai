import { Feather, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CrowdBadge, LastBusBadge } from "@/components/CrowdBadge";
import Colors from "@/constants/colors";
import { api, FrequencyData } from "@/lib/api";

const DAY_LABELS = ["morning", "afternoon", "evening", "night"] as const;
const DAY_LABELS_DISPLAY: Record<string, string> = {
  morning: "6–10am",
  afternoon: "11–3pm",
  evening: "4–8pm",
  night: "9pm+",
};

function FrequencyBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? value / max : 0;
  const barColor = pct > 0.7 ? Colors.success : pct > 0.4 ? Colors.accent : Colors.warning;
  return (
    <View style={freqStyles.row}>
      <Text style={freqStyles.label}>{DAY_LABELS_DISPLAY[label]}</Text>
      <View style={freqStyles.barWrap}>
        <View style={[freqStyles.bar, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={freqStyles.value}>{value} /hr</Text>
    </View>
  );
}

const freqStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94a3b8", width: 50 },
  barWrap: { flex: 1, height: 8, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden" },
  bar: { height: 8, borderRadius: 4 },
  value: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#0f172a", width: 44, textAlign: "right" },
});

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [dayType, setDayType] = useState<"weekday" | "weekend">("weekday");

  const { data: route, isLoading } = useQuery({
    queryKey: ["route", id],
    queryFn: () => api.getRoute(id!),
    enabled: !!id,
  });

  const { data: freq } = useQuery<FrequencyData>({
    queryKey: ["route-freq", id, dayType],
    queryFn: () => api.getRouteFrequency(id!),
    enabled: !!id,
  });

  const { data: liveBuses } = useQuery({
    queryKey: ["live-buses"],
    queryFn: api.getLiveBuses,
    refetchInterval: 3000,
  });

  const routeBuses = liveBuses?.filter((b) => b.routeId === id);

  useEffect(() => {
    if (route) {
      navigation.setOptions({ title: `Route ${route.number}` });
    }
  }, [route]);

  if (isLoading || !route) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: Colors.dark.background }]}>
        <Feather name="loader" size={32} color={Colors.primary} />
        <Text style={styles.loadingText}>Loading route...</Text>
      </View>
    );
  }

  const maxFreq = freq ? Math.max(...DAY_LABELS.map((k) => (freq as any)[k] || 0)) : 1;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.dark.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Route header card */}
      <View style={[styles.heroCard, { borderTopColor: route.color || Colors.primary }]}>
        <View style={styles.heroTop}>
          <View style={[styles.heroBadge, { backgroundColor: route.color || Colors.primary }]}>
            <Text style={styles.heroBadgeText}>{route.number}</Text>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{route.name}</Text>
            <View style={styles.heroRoute}>
              <Text style={styles.heroEndpoint} numberOfLines={1}>{route.from}</Text>
              <Feather name="arrow-right" size={14} color={Colors.dark.textMuted} />
              <Text style={styles.heroEndpoint} numberOfLines={1}>{route.to}</Text>
            </View>
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Feather name="map-pin" size={16} color={Colors.dark.textMuted} />
            <Text style={styles.heroStatValue}>{route.totalStops}</Text>
            <Text style={styles.heroStatLabel}>Stops</Text>
          </View>
          {route.lastBusTime && (
            <View style={styles.heroStat}>
              <Feather name="moon" size={16} color={Colors.warning} />
              <Text style={styles.heroStatValue}>{route.lastBusTime}</Text>
              <Text style={styles.heroStatLabel}>Last Bus</Text>
            </View>
          )}
          <View style={styles.heroStat}>
            <Feather name="radio" size={16} color={Colors.success} />
            <Text style={[styles.heroStatValue, { color: Colors.success }]}>{routeBuses?.length ?? 0}</Text>
            <Text style={styles.heroStatLabel}>Live</Text>
          </View>
        </View>
      </View>

      {/* Live buses section */}
      {routeBuses && routeBuses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <View style={styles.liveIndicator} />
            {"  "}Live Buses on Route
          </Text>
          {routeBuses.map((bus) => {
            const total = bus.totalStops ?? 1;
            const covered = bus.stopsCovered ?? 0;
            const remaining = bus.stopsRemaining ?? 0;
            const pct = total > 1 ? covered / (total - 1) : 0;
            return (
              <View key={bus.id} style={styles.liveBusCard}>
                <View style={styles.liveBusHeader}>
                  <View style={styles.liveBusLeft}>
                    <View style={[styles.liveBusDot, { backgroundColor: Colors.success }]} />
                    <Text style={styles.liveBusNext} numberOfLines={1}>→ {bus.nextStop}</Text>
                  </View>
                  <View style={styles.liveBusRight}>
                    <Text style={styles.liveBusSpeed}>{Number(bus.speed).toFixed(0)} km/h</Text>
                    <CrowdBadge level={bus.crowdLevel} />
                    {bus.isLastBus && <LastBusBadge />}
                  </View>
                </View>
                <View style={styles.liveProgressLabels}>
                  <Text style={styles.liveProgressText}>
                    <Text style={{ color: Colors.success, fontFamily: "Inter_700Bold" }}>{covered}</Text> covered
                  </Text>
                  <Text style={styles.liveProgressMid}>Stop {Math.min(covered + 1, total)} / {total}</Text>
                  <Text style={styles.liveProgressText}>
                    <Text style={{ color: Colors.primary, fontFamily: "Inter_700Bold" }}>{remaining}</Text> remaining
                  </Text>
                </View>
                <View style={styles.liveProgressTrack}>
                  <View style={[styles.liveProgressFill, { width: `${pct * 100}%` as any, backgroundColor: route.color || Colors.primary }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Frequency chart */}
      {freq && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Bus Frequency</Text>
            <View style={styles.dayToggle}>
              <Pressable
                style={[styles.dayToggleBtn, dayType === "weekday" && styles.dayToggleBtnActive]}
                onPress={() => { setDayType("weekday"); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.dayToggleBtnText, dayType === "weekday" && styles.dayToggleBtnTextActive]}>Weekday</Text>
              </Pressable>
              <Pressable
                style={[styles.dayToggleBtn, dayType === "weekend" && styles.dayToggleBtnActive]}
                onPress={() => { setDayType("weekend"); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.dayToggleBtnText, dayType === "weekend" && styles.dayToggleBtnTextActive]}>Weekend</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.freqCard}>
            {DAY_LABELS.map((k) => (
              <FrequencyBar key={k} label={k} value={(freq as any)[k] || 0} max={maxFreq} />
            ))}
          </View>
        </View>
      )}

      {/* Stops timeline */}
      {route.stops && route.stops.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Stops ({route.stops.length})</Text>
          {route.stops.map((stop, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === route.stops.length - 1;
            return (
              <TouchableOpacity
                key={stop.id}
                style={styles.stopRow}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({ pathname: "/stop/[id]", params: { id: stop.id } });
                }}
              >
                <View style={styles.stopTimeline}>
                  <View style={[
                    styles.stopDot,
                    (isFirst || isLast) ? styles.stopDotEndpoint : styles.stopDotMid,
                    { borderColor: route.color || Colors.primary }
                  ]} />
                  {!isLast && <View style={[styles.stopLine, { backgroundColor: route.color ? `${route.color}44` : "#e2e8f0" }]} />}
                </View>
                <View style={styles.stopInfo}>
                  <Text style={[styles.stopName, (isFirst || isLast) && styles.stopNameEndpoint]}>
                    {stop.name}
                  </Text>
                  {(isFirst || isLast) && (
                    <Text style={styles.stopTag}>{isFirst ? "First Stop" : "Last Stop"}</Text>
                  )}
                </View>
                <Feather name="chevron-right" size={16} color={Colors.dark.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted },
  heroCard: {
    margin: 20,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderTopWidth: 4,
    overflow: "hidden",
    padding: 20,
  },
  heroTop: { flexDirection: "row", gap: 16, marginBottom: 20 },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadgeText: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  heroInfo: { flex: 1, justifyContent: "center" },
  heroName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0f172a", marginBottom: 6 },
  heroRoute: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroEndpoint: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94a3b8", flex: 1 },
  heroStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 16,
    gap: 24,
  },
  heroStat: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroStatValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0f172a" },
  heroStatLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748b" },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0f172a",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  liveBusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  liveBusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  liveBusLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  liveBusDot: { width: 8, height: 8, borderRadius: 4 },
  liveBusNext: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#0f172a", flex: 1 },
  liveBusRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveBusSpeed: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  liveProgressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  liveProgressText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#64748b" },
  liveProgressMid: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#0f172a" },
  liveProgressTrack: {
    height: 5,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  liveProgressFill: { height: 5, borderRadius: 3 },
  freqCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dayToggle: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 100,
    padding: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dayToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  dayToggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  dayToggleBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textMuted,
  },
  dayToggleBtnTextActive: { color: "#fff" },
  stopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 0,
    gap: 12,
  },
  stopTimeline: {
    width: 16,
    alignItems: "center",
    paddingTop: 4,
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: "#ffffff",
  },
  stopDotEndpoint: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
  stopDotMid: {},
  stopLine: {
    width: 2,
    height: 32,
    marginTop: 2,
  },
  stopInfo: { flex: 1, paddingVertical: 4 },
  stopName: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#94a3b8",
    lineHeight: 20,
  },
  stopNameEndpoint: {
    fontFamily: "Inter_600SemiBold",
    color: "#0f172a",
  },
  stopTag: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
    marginTop: 2,
  },
});
