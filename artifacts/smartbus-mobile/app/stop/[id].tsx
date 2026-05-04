import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CrowdBadge, LastBusBadge } from "@/components/CrowdBadge";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CrowdMeter } from "@/components/ui/CrowdMeter";
import { PulseDot } from "@/components/ui/PulseDot";
import { CardSkeleton } from "@/components/ui/Skeleton";
import Colors from "@/constants/colors";
import { Radius, Shadow, Spacing, Type } from "@/constants/theme";
import { api, EtaEntry } from "@/lib/api";

function EtaCard({ eta, index }: { eta: EtaEntry; index: number }) {
  const isNext = index === 0;
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Card
        onPress={() => router.push({ pathname: "/route/[id]", params: { id: eta.routeId } })}
        glow={isNext ? Colors.primaryGlow : undefined}
        style={{ marginBottom: 10 }}
      >
        {isNext && (
          <LinearGradient
            colors={Colors.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 3 }}
          />
        )}
        <View style={{ padding: 14, gap: isNext ? 12 : 0 }}>
          <View style={styles.etaRow}>
            <LinearGradient
              colors={isNext ? Colors.gradients.primary : ["#475569", "#334155"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.etaBadge}
            >
              <Text style={styles.etaBadgeText} numberOfLines={1}>{eta.routeNumber}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.etaName} numberOfLines={1}>{eta.routeName}</Text>
              <View style={{ flexDirection: "row", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                <CrowdBadge level={eta.crowdLevel} />
                {eta.isLastBus && <LastBusBadge />}
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.etaMin, isNext && { color: Colors.primary, fontSize: 36 }]}>
                {eta.etaMinutes}
              </Text>
              <Text style={styles.etaUnit}>{isNext ? "min away" : "min"}</Text>
            </View>
          </View>

          {isNext && (
            <View style={styles.nextBanner}>
              <PulseDot color={Colors.primary} size={8} />
              <Text style={styles.nextBannerText}>
                Arriving next — {eta.etaMinutes === 0 ? "At stop" : `${eta.etaMinutes} min`}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </Animated.View>
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
    navigation.setOptions({ headerShown: false });
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFillObject} />

      <Pressable
        onPress={() => { Haptics.selectionAsync(); router.back(); }}
        style={[styles.backBtn, { top: insets.top + 12 }]}
      >
        <Feather name="arrow-left" size={20} color={Colors.dark.text} />
      </Pressable>

      <FlatList
        data={etas ?? []}
        keyExtractor={(e, i) => `${e.busId}-${i}`}
        renderItem={({ item, index }) => <EtaCard eta={item} index={index} />}
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 16 }}>
            <Card>
              <View style={{ padding: 18, gap: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={styles.stopIcon}>
                    <Feather name="map-pin" size={22} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eyebrow}>BUS STOP</Text>
                    <Text style={styles.stopName} numberOfLines={2}>
                      {stop?.name ?? "Loading…"}
                    </Text>
                    {stop?.routeIds && (
                      <Text style={styles.routeCount}>
                        {stop.routeIds.length} routes serve this stop
                      </Text>
                    )}
                  </View>
                </View>

                {crowd && (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={styles.crowdLabel}>Current crowd</Text>
                      <Badge
                        variant="neutral"
                        icon="users"
                        label={`~${crowd.estimatedPassengers} people`}
                        size="sm"
                      />
                    </View>
                    <CrowdMeter level={crowd.level} />
                    {crowd.reason && (
                      <Text style={styles.crowdReason}>{crowd.reason}</Text>
                    )}
                  </View>
                )}
              </View>
            </Card>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <PulseDot color={Colors.success} size={9} />
                <Text style={styles.sectionTitle}>Upcoming arrivals</Text>
              </View>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); refetch(); }}
                style={styles.refreshBtn}
              >
                <Feather name={isRefetching ? "loader" : "refresh-cw"} size={13} color={Colors.primary} />
                <Text style={styles.refreshText}>{isRefetching ? "Updating" : "Refresh"}</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 12 }}>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="clock" size={36} color={Colors.dark.textMuted} />
              <Text style={styles.emptyText}>No buses expected soon</Text>
              <Text style={styles.emptySub}>Pull to refresh or check back in a few minutes</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark.background },

  backBtn: {
    position: "absolute",
    left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(30,41,59,0.85)",
    borderWidth: 1, borderColor: Colors.dark.cardBorder,
    alignItems: "center", justifyContent: "center",
    zIndex: 10,
    ...Shadow.card,
  },

  eyebrow: { ...Type.micro, color: Colors.primary, letterSpacing: 1.5 },
  stopName: { ...Type.heading, color: Colors.dark.text, marginTop: 2 },
  routeCount: { ...Type.caption, color: Colors.dark.textMuted, marginTop: 4 },

  stopIcon: {
    width: 52, height: 52, borderRadius: Radius.lg,
    backgroundColor: "rgba(37,99,235,0.15)",
    borderWidth: 1, borderColor: "rgba(37,99,235,0.3)",
    alignItems: "center", justifyContent: "center",
  },

  crowdLabel: { ...Type.caption, color: Colors.dark.textMuted },
  crowdReason: { ...Type.caption, color: Colors.dark.textFaint, fontStyle: "italic" },

  sectionTitle: { ...Type.heading, color: Colors.dark.text },
  refreshBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.dark.cardBorder,
  },
  refreshText: { ...Type.caption, color: Colors.primary, fontFamily: "Inter_700Bold" },

  etaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  etaBadge: {
    minWidth: 54, height: 48,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
    alignItems: "center", justifyContent: "center",
  },
  etaBadgeText: { ...Type.subtitle, color: "#fff" },
  etaName: { ...Type.subtitle, color: Colors.dark.text },
  etaMin: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.dark.text, lineHeight: 32 },
  etaUnit: { ...Type.caption, color: Colors.dark.textMuted },

  nextBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "rgba(37,99,235,0.12)",
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: "rgba(37,99,235,0.25)",
  },
  nextBannerText: { ...Type.caption, color: Colors.primary, fontFamily: "Inter_700Bold" },

  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyText: { ...Type.subtitle, color: Colors.dark.text, marginTop: 12 },
  emptySub: { ...Type.caption, color: Colors.dark.textMuted },
});
