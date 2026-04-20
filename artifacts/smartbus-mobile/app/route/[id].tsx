import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CrowdBadge, LastBusBadge, BUS_TYPE_CONFIG, getBusTypeGradient } from "@/components/CrowdBadge";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AnimatedProgress } from "@/components/ui/AnimatedProgress";
import { PulseDot } from "@/components/ui/PulseDot";
import { RouteMiniMap } from "@/components/ui/RouteMiniMap";
import { CardSkeleton } from "@/components/ui/Skeleton";
import Colors from "@/constants/colors";
import { Radius, Shadow, Spacing, Type } from "@/constants/theme";
import { api, FrequencyData } from "@/lib/api";

const DAY_LABELS = ["morning", "afternoon", "evening", "night"] as const;
const DAY_LABELS_DISPLAY: Record<string, string> = {
  morning: "6–10am",
  afternoon: "11–3pm",
  evening: "4–8pm",
  night: "9pm+",
};

function FrequencyBar({ label, value, max, idx }: { label: string; value: number; max: number; idx: number }) {
  const pct = max > 0 ? value / max : 0;
  const gradient: [string, string] =
    pct > 0.7 ? Colors.gradients.success
    : pct > 0.4 ? [Colors.accent, Colors.primary]
    : Colors.gradients.warning;
  return (
    <Animated.View entering={FadeInDown.delay(idx * 80).springify()} style={freqStyles.row}>
      <Text style={freqStyles.label}>{DAY_LABELS_DISPLAY[label]}</Text>
      <View style={{ flex: 1 }}>
        <AnimatedProgress value={pct} gradient={gradient} height={8} />
      </View>
      <Text style={freqStyles.value}>{value}/hr</Text>
    </Animated.View>
  );
}

const freqStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  label: { ...Type.caption, color: Colors.dark.textMuted, width: 56 },
  value: { ...Type.caption, color: Colors.dark.text, width: 50, textAlign: "right", fontFamily: "Inter_700Bold" },
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
    queryFn: () => api.getRouteFrequency(id!, dayType),
    enabled: !!id,
  });

  const { data: liveBuses } = useQuery({
    queryKey: ["live-buses"],
    queryFn: api.getLiveBuses,
    refetchInterval: 8000,
  });

  const routeBuses = liveBuses?.filter((b) => b.routeId === id) ?? [];

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, []);

  if (isLoading || !route) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFillObject} />
        <View style={{ flex: 1, paddingTop: insets.top + 20, paddingHorizontal: Spacing.lg, gap: 14 }}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      </View>
    );
  }

  const config = BUS_TYPE_CONFIG[route.busType] || BUS_TYPE_CONFIG.Ordinary;
  const gradient = getBusTypeGradient(route.busType);
  const maxFreq = freq ? Math.max(...DAY_LABELS.map((k) => (freq as any)[k] || 0), 1) : 1;
  const firstBus = routeBuses[0];
  const busPositionIdx = firstBus ? firstBus.stopsCovered : undefined;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFillObject} />

      {/* Floating back button */}
      <Pressable
        onPress={() => { Haptics.selectionAsync(); router.back(); }}
        style={[styles.backBtn, { top: insets.top + 12 }]}
      >
        <Feather name="arrow-left" size={20} color={Colors.dark.text} />
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: Spacing.lg,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <Animated.View entering={FadeIn.duration(400)}>
          <Card glow={`${config.color}55`}>
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroAccent}
            />
            <View style={{ padding: 18, gap: 14 }}>
              <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                <LinearGradient
                  colors={gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroBadge}
                >
                  <Text style={styles.heroBadgeText} numberOfLines={1}>{route.number}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroName} numberOfLines={2}>{route.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <Text style={styles.heroEndpoint} numberOfLines={1}>{route.from}</Text>
                    <Feather name="arrow-right" size={12} color={Colors.dark.textMuted} />
                    <Text style={styles.heroEndpoint} numberOfLines={1}>{route.to}</Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Badge variant="primary" emoji={config.icon} label={config.label} size="sm" />
                <Badge variant="neutral" icon="map-pin" label={`${route.totalStops} stops`} size="sm" />
                {route.distance ? <Badge variant="neutral" icon="navigation-2" label={`${route.distance} km`} size="sm" /> : null}
                {route.lastBusTime ? <Badge variant="warning" icon="moon" label={`Last ${route.lastBusTime}`} size="sm" /> : null}
              </View>

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {routeBuses.length > 0 && <PulseDot color={Colors.success} size={8} />}
                    <Text style={[styles.heroStatValue, routeBuses.length > 0 && { color: Colors.success }]}>
                      {routeBuses.length}
                    </Text>
                  </View>
                  <Text style={styles.heroStatLabel}>LIVE</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{route.totalStops}</Text>
                  <Text style={styles.heroStatLabel}>STOPS</Text>
                </View>
                {route.distance && (
                  <>
                    <View style={styles.heroStatDivider} />
                    <View style={styles.heroStat}>
                      <Text style={styles.heroStatValue}>{route.distance}</Text>
                      <Text style={styles.heroStatLabel}>KM</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Mini map */}
        {route.stops?.length > 1 && (
          <Animated.View entering={FadeInDown.delay(80)}>
            <Card>
              <View style={{ padding: 14, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={styles.cardTitle}>Route preview</Text>
                  <Badge variant="primary" icon="map" label="Live position" size="sm" />
                </View>
                <RouteMiniMap
                  stops={route.stops}
                  busPositionIdx={busPositionIdx}
                  height={150}
                  color={config.color}
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={styles.miniMapEnd}>
                    <View style={[styles.miniMapDot, { backgroundColor: Colors.primary }]} />
                    <Text style={styles.miniMapLabel} numberOfLines={1}>{route.from}</Text>
                  </View>
                  <View style={[styles.miniMapEnd, { justifyContent: "flex-end" }]}>
                    <Text style={[styles.miniMapLabel, { textAlign: "right" }]} numberOfLines={1}>{route.to}</Text>
                    <View style={[styles.miniMapDot, { backgroundColor: Colors.secondary }]} />
                  </View>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Live buses */}
        {routeBuses.length > 0 && (
          <Animated.View entering={FadeInDown.delay(140)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <PulseDot color={Colors.success} size={9} />
              <Text style={styles.sectionTitle}>Live buses on route</Text>
            </View>
            {routeBuses.map((bus, idx) => {
              const total = bus.totalStops ?? 1;
              const covered = bus.stopsCovered ?? 0;
              const remaining = bus.stopsRemaining ?? 0;
              const pct = total > 1 ? covered / (total - 1) : 0;
              return (
                <Animated.View key={bus.id} entering={FadeInDown.delay(idx * 80)}>
                  <Card style={{ marginBottom: 10 }}>
                    <View style={{ padding: 14, gap: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={styles.busIcon}>
                          <Feather name="navigation" size={14} color={Colors.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.busNext} numberOfLines={1}>→ {bus.nextStop}</Text>
                          <Text style={styles.busFrom} numberOfLines={1}>From {bus.currentStop}</Text>
                        </View>
                        <View style={styles.speedPill}>
                          <Feather name="zap" size={10} color={Colors.warning} />
                          <Text style={styles.speedText}>{Math.round(bus.speed)}</Text>
                        </View>
                      </View>

                      <View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                          <Text style={styles.busProgressText}>
                            <Text style={{ color: Colors.success, fontFamily: "Inter_700Bold" }}>{covered}</Text> covered
                          </Text>
                          <Text style={[styles.busProgressText, { color: Colors.dark.text, fontFamily: "Inter_700Bold" }]}>
                            Stop {Math.min(covered + 1, total)} / {total}
                          </Text>
                          <Text style={styles.busProgressText}>
                            <Text style={{ color: Colors.primary, fontFamily: "Inter_700Bold" }}>{remaining}</Text> left
                          </Text>
                        </View>
                        <AnimatedProgress value={pct} gradient={gradient} height={5} />
                      </View>

                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        <CrowdBadge level={bus.crowdLevel} />
                        {bus.isLastBus && <LastBusBadge />}
                      </View>
                    </View>
                  </Card>
                </Animated.View>
              );
            })}
          </Animated.View>
        )}

        {/* Frequency */}
        {freq && (
          <Animated.View entering={FadeInDown.delay(200)}>
            <Card>
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <Text style={styles.cardTitle}>Bus frequency</Text>
                  <View style={styles.dayToggle}>
                    {(["weekday", "weekend"] as const).map((k) => {
                      const active = dayType === k;
                      return (
                        <Pressable
                          key={k}
                          onPress={() => { Haptics.selectionAsync(); setDayType(k); }}
                          style={[styles.dayToggleBtn, active && styles.dayToggleBtnActive]}
                        >
                          <Text style={[styles.dayToggleText, active && styles.dayToggleTextActive]}>
                            {k === "weekday" ? "Weekday" : "Weekend"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                {DAY_LABELS.map((k, i) => (
                  <FrequencyBar key={k} label={k} value={(freq as any)[k] || 0} max={maxFreq} idx={i} />
                ))}
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Stops timeline */}
        {route.stops && route.stops.length > 0 && (
          <Animated.View entering={FadeInDown.delay(280)}>
            <Card>
              <View style={{ padding: 16 }}>
                <Text style={[styles.cardTitle, { marginBottom: 14 }]}>
                  All stops ({route.stops.length})
                </Text>
                {route.stops.map((stop, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === route.stops.length - 1;
                  const isPast = busPositionIdx != null && idx <= busPositionIdx;
                  const dotColor = isFirst ? Colors.primary
                    : isLast ? Colors.secondary
                    : isPast ? Colors.success
                    : Colors.dark.cardBorderStrong;
                  return (
                    <Pressable
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
                          { borderColor: dotColor, backgroundColor: isPast || isFirst || isLast ? dotColor : "transparent" },
                          (isFirst || isLast) && { width: 14, height: 14, borderRadius: 7 },
                        ]} />
                        {!isLast && <View style={[
                          styles.stopLine,
                          { backgroundColor: isPast ? Colors.success : Colors.dark.cardBorderStrong },
                        ]} />}
                      </View>
                      <View style={styles.stopInfo}>
                        <Text style={[
                          styles.stopName,
                          (isFirst || isLast) && { color: Colors.dark.text, fontFamily: "Inter_700Bold" },
                        ]} numberOfLines={1}>
                          {stop.name}
                        </Text>
                        {(isFirst || isLast) && (
                          <Text style={[styles.stopTag, { color: isFirst ? Colors.primary : Colors.secondary }]}>
                            {isFirst ? "FIRST STOP" : "LAST STOP"}
                          </Text>
                        )}
                      </View>
                      <Feather name="chevron-right" size={16} color={Colors.dark.textMuted} />
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </Animated.View>
        )}
      </ScrollView>
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

  heroAccent: { height: 3, width: "100%" },
  heroBadge: {
    minWidth: 64, height: 56,
    paddingHorizontal: 8,
    borderRadius: Radius.lg,
    alignItems: "center", justifyContent: "center",
  },
  heroBadgeText: { ...Type.title, color: "#fff" },
  heroName: { ...Type.heading, color: Colors.dark.text },
  heroEndpoint: { ...Type.caption, color: Colors.dark.textMuted, flex: 1 },

  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.cardBorder,
  },
  heroStat: { flex: 1, alignItems: "center", gap: 4 },
  heroStatValue: { ...Type.title, color: Colors.dark.text },
  heroStatLabel: { ...Type.micro, color: Colors.dark.textMuted, letterSpacing: 1 },
  heroStatDivider: { width: 1, height: 32, backgroundColor: Colors.dark.cardBorder },

  cardTitle: { ...Type.heading, color: Colors.dark.text },
  sectionTitle: { ...Type.heading, color: Colors.dark.text },

  miniMapEnd: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  miniMapLabel: { ...Type.caption, color: Colors.dark.textMuted, flexShrink: 1 },
  miniMapDot: { width: 8, height: 8, borderRadius: 4 },

  busIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.successSoft,
    alignItems: "center", justifyContent: "center",
  },
  busNext: { ...Type.subtitle, color: Colors.dark.text },
  busFrom: { ...Type.caption, color: Colors.dark.textMuted, marginTop: 2 },
  speedPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: Colors.warningSoft,
    borderRadius: Radius.pill,
  },
  speedText: { ...Type.caption, color: Colors.warning, fontFamily: "Inter_700Bold" },
  busProgressText: { ...Type.caption, color: Colors.dark.textMuted },

  dayToggle: {
    flexDirection: "row",
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.pill,
    padding: 3,
    borderWidth: 1, borderColor: Colors.dark.cardBorder,
  },
  dayToggleBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.pill },
  dayToggleBtnActive: { backgroundColor: Colors.primary },
  dayToggleText: { ...Type.caption, color: Colors.dark.textMuted },
  dayToggleTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },

  stopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stopTimeline: { width: 16, alignItems: "center", paddingTop: 4 },
  stopDot: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2,
  },
  stopLine: { width: 2, height: 28, marginTop: 2 },
  stopInfo: { flex: 1, paddingVertical: 2, paddingBottom: 8 },
  stopName: { ...Type.body, color: Colors.dark.textMuted },
  stopTag: { ...Type.micro, letterSpacing: 1, marginTop: 2 },
});
