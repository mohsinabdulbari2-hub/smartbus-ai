import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CrowdBadge, LastBusBadge } from "@/components/CrowdBadge";
import Colors from "@/constants/colors";
import { api, EtaEntry } from "@/lib/api";

function EtaCard({ eta, index }: { eta: EtaEntry; index: number }) {
  const isNext = index === 0;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.etaCard,
        isNext && styles.etaCardNext,
        pressed && { opacity: 0.85 },
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: "/route/[id]", params: { id: eta.routeId } });
      }}
    >
      {isNext && <View style={styles.nextBar} />}

      <View style={styles.etaRow}>
        <View style={[styles.routeBadge, { backgroundColor: eta.routeColor || Colors.primary }]}>
          <Text style={styles.routeNumber}>{eta.routeNumber}</Text>
        </View>
        <View style={styles.etaInfo}>
          <Text style={styles.routeName} numberOfLines={1}>{eta.routeName}</Text>
          <View style={styles.badgeRow}>
            <CrowdBadge level={eta.crowdLevel} />
            {eta.isLastBus && <LastBusBadge />}
          </View>
        </View>
        <View style={styles.etaTimeBox}>
          {isNext ? (
            <>
              <Text style={styles.etaMinutes}>{eta.etaMinutes}</Text>
              <Text style={styles.etaLabel}>min away</Text>
            </>
          ) : (
            <>
              <Text style={styles.etaMinutesAlt}>{eta.etaMinutes}</Text>
              <Text style={styles.etaLabel}>min</Text>
            </>
          )}
        </View>
      </View>

      {isNext && (
        <View style={styles.nextFooter}>
          <Feather name="clock" size={12} color={Colors.primary} />
          <Text style={styles.nextFooterText}>Arriving next — {eta.etaMinutes === 0 ? "At stop" : `${eta.etaMinutes} min`}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function StopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const { data: etas, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["stop-eta", id],
    queryFn: () => api.getStopEta(id!),
    enabled: !!id,
    refetchInterval: 10000,
  });

  const { data: crowd } = useQuery({
    queryKey: ["stop-crowd", id],
    queryFn: () => api.getStopCrowd(id!),
    enabled: !!id,
    refetchInterval: 15000,
  });

  const { data: stops } = useQuery({
    queryKey: ["stops"],
    queryFn: api.getStops,
  });

  const stop = stops?.find((s) => s.id === id);

  useEffect(() => {
    if (stop) navigation.setOptions({ title: stop.name });
  }, [stop]);

  const crowdColor =
    crowd?.level === "High" ? Colors.danger
    : crowd?.level === "Medium" ? Colors.warning
    : Colors.success;

  return (
    <View style={[styles.container, { backgroundColor: Colors.dark.background }]}>
      {/* Stop info hero */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.stopIcon}>
            <Feather name="map-pin" size={24} color={Colors.primary} />
          </View>
          <View style={styles.stopInfo}>
            <Text style={styles.stopName} numberOfLines={2}>
              {stop?.name ?? `Stop ${id}`}
            </Text>
            {stop?.routeIds && (
              <Text style={styles.routeCount}>{stop.routeIds.length} routes serve this stop</Text>
            )}
          </View>
        </View>

        {/* Crowd info */}
        {crowd && (
          <View style={[styles.crowdCard, { borderColor: crowdColor + "40" }]}>
            <View style={styles.crowdLeft}>
              <Feather name="users" size={16} color={crowdColor} />
              <Text style={styles.crowdLabel}>Current Crowd</Text>
            </View>
            <View style={styles.crowdRight}>
              <CrowdBadge level={crowd.level} />
              <Text style={styles.crowdPassengers}>~{crowd.estimatedPassengers} passengers</Text>
            </View>
          </View>
        )}
      </View>

      {/* Arrivals header */}
      <View style={styles.arrivalsHeader}>
        <Text style={styles.arrivalsTitle}>Upcoming Arrivals</Text>
        <Pressable onPress={() => { Haptics.selectionAsync(); refetch(); }} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={14} color={Colors.primary} />
          <Text style={styles.refreshText}>{isRefetching ? "Updating..." : "Refresh"}</Text>
        </Pressable>
      </View>

      <FlatList
        data={etas}
        keyExtractor={(e, i) => `${e.busId}-${i}`}
        renderItem={({ item, index }) => <EtaCard eta={item} index={index} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="clock" size={48} color={Colors.dark.textMuted} />
            <Text style={styles.emptyTitle}>
              {isLoading ? "Checking arrivals..." : "No buses expected soon"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    backgroundColor: "#111827",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  heroTop: { flexDirection: "row", gap: 16, marginBottom: 16, alignItems: "center" },
  stopIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(249,115,22,0.1)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  stopInfo: { flex: 1 },
  stopName: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#f1f5f9", marginBottom: 4 },
  routeCount: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#475569" },
  crowdCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a2235",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  crowdLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  crowdLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#94a3b8" },
  crowdRight: { alignItems: "flex-end", gap: 4 },
  crowdPassengers: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569" },
  arrivalsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  arrivalsTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  refreshText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary },
  list: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  etaCard: {
    backgroundColor: "#1a2235",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    overflow: "hidden",
  },
  etaCardNext: {
    borderColor: "rgba(249,115,22,0.4)",
    shadowColor: "#f97316",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  nextBar: { height: 2, backgroundColor: Colors.primary },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  routeBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  routeNumber: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  etaInfo: { flex: 1 },
  routeName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#f1f5f9", marginBottom: 6 },
  badgeRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  etaTimeBox: { alignItems: "flex-end" },
  etaMinutes: { fontSize: 36, fontFamily: "Inter_700Bold", color: Colors.primary, lineHeight: 40 },
  etaMinutesAlt: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#f1f5f9", lineHeight: 32 },
  etaLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569" },
  nextFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(249,115,22,0.06)",
    borderTopWidth: 1,
    borderTopColor: "rgba(249,115,22,0.15)",
  },
  nextFooterText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 16 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted },
});
