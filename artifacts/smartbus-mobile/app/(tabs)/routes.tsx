import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useDeferredValue, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { RouteRowSkeleton } from "@/components/ui/Skeleton";
import { BUS_TYPE_CONFIG, getBusTypeGradient } from "@/components/CrowdBadge";
import Colors from "@/constants/colors";
import { Radius, Spacing, Type } from "@/constants/theme";
import { api, type Route, type BusType } from "@/lib/api";
import { fuzzyMatch } from "@/lib/fuzzy";

const FILTERS: { key: BusType | "All"; label: string; icon: string }[] = [
  { key: "All",         label: "All routes",  icon: "grid" },
  { key: "Vajra",       label: "Vajra AC",    icon: "wind" },
  { key: "Volvo",       label: "Volvo",       icon: "star" },
  { key: "Ordinary",    label: "Ordinary",    icon: "truck" },
  { key: "Airport",     label: "Airport",     icon: "send" },
  { key: "MetroFeeder", label: "Metro",       icon: "map" },
  { key: "Night",       label: "Night Owl",   icon: "moon" },
];

export default function RoutesScreen() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BusType | "All">("All");
  const deferredQuery = useDeferredValue(query);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["routes"],
    queryFn: api.getRoutes,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const hasFilters = filter !== "All" || query.trim().length > 0;
  const clearFilters = () => { Haptics.selectionAsync(); setQuery(""); setFilter("All"); };
  const routes = data ?? [];

  const filtered = useMemo(() => {
    const q = deferredQuery.trim();
    let r = routes;
    if (filter !== "All") r = r.filter((x) => x.busType === filter);
    if (q) {
      const qLower = q.toLowerCase();
      r = r.filter((x) =>
        x.number.toLowerCase().includes(qLower) ||
        fuzzyMatch(q, x.name) || fuzzyMatch(q, x.from) || fuzzyMatch(q, x.to),
      );
    }
    return r.slice(0, 200);
  }, [routes, deferredQuery, filter]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: Spacing.lg }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} colors={[Colors.primary]} />
          }
          ListHeaderComponent={
            <Header query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} total={routes.length} filteredCount={filtered.length} hasFilters={hasFilters} clearFilters={clearFilters} />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 18, 260)).springify()}>
              <RouteCard route={item} />
            </Animated.View>
          )}
          ListEmptyComponent={
            isLoading ? (
              <View style={{ gap: 8 }}>
                {[0,1,2,3,4].map((i) => <RouteRowSkeleton key={i} />)}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Feather name="map" size={26} color={Colors.dark.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>
                  {hasFilters ? "No matching routes" : "No routes loaded yet"}
                </Text>
                <Text style={styles.emptySub}>
                  {hasFilters ? "Try a shorter term or a major area name." : "Pull down to refresh"}
                </Text>
                {hasFilters && (
                  <Pressable onPress={clearFilters} style={styles.clearBtn}>
                    <Feather name="refresh-cw" size={13} color={Colors.primary} />
                    <Text style={styles.clearBtnText}>Clear filters</Text>
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

function Header({ query, setQuery, filter, setFilter, total, filteredCount, hasFilters, clearFilters }: {
  query: string; setQuery: (q: string) => void;
  filter: BusType | "All"; setFilter: (f: BusType | "All") => void;
  total: number; filteredCount: number; hasFilters: boolean; clearFilters: () => void;
}) {
  return (
    <View style={{ paddingTop: 8, paddingBottom: 16 }}>
      {/* Page header */}
      <Animated.View entering={FadeInUp.duration(400)} style={styles.pageHeader}>
        <View>
          <Text style={styles.eyebrow}>BMTC NETWORK</Text>
          <Text style={styles.title}>All Routes</Text>
          <Text style={styles.subtitle}>{total.toLocaleString()} routes across Bengaluru</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{total.toLocaleString()}</Text>
        </View>
      </Animated.View>

      {/* Search bar */}
      <Animated.View entering={FadeInUp.delay(60).duration(400)} style={styles.searchBar}>
        <Feather name="search" size={16} color={Colors.dark.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Route number, name or stop…"
          placeholderTextColor={Colors.dark.textFaint}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => { Haptics.selectionAsync(); setQuery(""); }} style={styles.clearX}>
            <Feather name="x" size={13} color={Colors.dark.textMuted} />
          </Pressable>
        )}
      </Animated.View>

      {/* Filter chips */}
      <Animated.View entering={FadeInUp.delay(100).duration(400)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }}
                style={[styles.chip, active && styles.chipActive]}
              >
                {active ? (
                  <LinearGradient colors={["#2563eb", "#1d4ed8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipGradient}>
                    <Feather name={f.icon as any} size={12} color="#fff" />
                    <Text style={styles.chipTextActive}>{f.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.chipInner}>
                    <Feather name={f.icon as any} size={12} color={Colors.dark.textMuted} />
                    <Text style={styles.chipText}>{f.label}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* Result count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {filteredCount.toLocaleString()} {hasFilters ? "matching" : "routes"}{filteredCount < total && ` of ${total.toLocaleString()}`}
        </Text>
        {hasFilters && (
          <Pressable onPress={clearFilters} style={styles.clearLink}>
            <Text style={styles.clearLinkText}>Clear</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function RouteCard({ route }: { route: Route }) {
  const config = BUS_TYPE_CONFIG[route.busType] || BUS_TYPE_CONFIG.Ordinary;
  const gradient = getBusTypeGradient(route.busType);

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); router.push(`/route/${route.id}` as any); }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.82 }]}
    >
      {/* Route number badge */}
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
        <Text style={styles.badgeText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.55}>{route.number}</Text>
      </LinearGradient>

      {/* Info */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
        <View style={styles.pathRow}>
          <Feather name="circle" size={6} color={Colors.primary} />
          <Text style={styles.pathStop} numberOfLines={1}>{route.from}</Text>
        </View>
        <View style={styles.pathRow}>
          <Feather name="map-pin" size={9} color="#a78bfa" />
          <Text style={styles.pathStop} numberOfLines={1}>{route.to}</Text>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>{config.icon} {config.label}</Text>
          </View>
          <View style={styles.metaChip}>
            <Feather name="map-pin" size={10} color={Colors.dark.textMuted} />
            <Text style={styles.metaText}>{route.totalStops} stops</Text>
          </View>
          {route.distance ? (
            <View style={styles.metaChip}>
              <Feather name="navigation-2" size={10} color={Colors.dark.textMuted} />
              <Text style={styles.metaText}>{route.distance} km</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Feather name="chevron-right" size={16} color={Colors.dark.textMuted} style={{ marginLeft: 4 }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0F172A" },

  pageHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  eyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.primary, letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.dark.text, lineHeight: 30 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.dark.textMuted, marginTop: 3 },
  headerBadge: { backgroundColor: "rgba(37,99,235,0.15)", borderWidth: 1, borderColor: "rgba(37,99,235,0.3)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  headerBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.primary },

  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: Colors.dark.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  searchInput: { flex: 1, color: Colors.dark.text, fontSize: 14, fontFamily: "Inter_500Medium", padding: 0 },
  clearX: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.dark.cardBorderStrong, alignItems: "center", justifyContent: "center" },

  chip: { borderRadius: Radius.pill, overflow: "hidden", borderWidth: 1, borderColor: Colors.dark.cardBorder },
  chipActive: { borderColor: "transparent" },
  chipGradient: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9 },
  chipInner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: Colors.dark.surface },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.dark.textSecondary },
  chipTextActive: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },

  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  countText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted },
  clearLink: { paddingHorizontal: 10, paddingVertical: 4 },
  clearLinkText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },

  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.dark.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.dark.cardBorder, padding: 14, marginBottom: 10 },
  badge: { width: 62, height: 62, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, flexShrink: 0 },
  badgeText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center", lineHeight: 17 },
  routeName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.dark.text },
  pathRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pathStop: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.dark.textMuted, flex: 1 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 4 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.dark.background, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  metaText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted },

  emptyState: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.cardBorder, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.dark.text, textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.dark.textMuted, textAlign: "center", maxWidth: 260 },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: "rgba(37,99,235,0.12)", borderRadius: Radius.pill, borderWidth: 1, borderColor: "rgba(37,99,235,0.35)" },
  clearBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
});
