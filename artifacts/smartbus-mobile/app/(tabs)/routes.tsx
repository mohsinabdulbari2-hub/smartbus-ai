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

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RouteRowSkeleton } from "@/components/ui/Skeleton";
import { BUS_TYPE_CONFIG, getBusTypeGradient } from "@/components/CrowdBadge";
import Colors from "@/constants/colors";
import { Radius, Spacing, Type } from "@/constants/theme";
import { api, type Route, type BusType } from "@/lib/api";

const FILTERS: { key: BusType | "All"; label: string; emoji: string }[] = [
  { key: "All",         label: "All",      emoji: "🚍" },
  { key: "Vajra",       label: "Vajra",    emoji: "❄️" },
  { key: "Volvo",       label: "Volvo",    emoji: "🌟" },
  { key: "Ordinary",    label: "Ordinary", emoji: "🚌" },
  { key: "Airport",     label: "Airport",  emoji: "✈️" },
  { key: "MetroFeeder", label: "Metro",    emoji: "🚇" },
  { key: "Night",       label: "Night",    emoji: "🌙" },
];

export default function RoutesScreen() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BusType | "All">("All");
  const deferredQuery = useDeferredValue(query);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["routes"],
    queryFn: api.getRoutes,
  });

  const hasFilters = filter !== "All" || query.trim().length > 0;
  const clearFilters = () => {
    Haptics.selectionAsync();
    setQuery("");
    setFilter("All");
  };

  const routes = data ?? [];

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    let r = routes;
    if (filter !== "All") r = r.filter((x) => x.busType === filter);
    if (q) {
      r = r.filter((x) =>
        x.number.toLowerCase().includes(q) ||
        x.name.toLowerCase().includes(q) ||
        x.from.toLowerCase().includes(q) ||
        x.to.toLowerCase().includes(q),
      );
    }
    return r.slice(0, 200); // cap to keep list snappy
  }, [routes, deferredQuery, filter]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
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
              query={query}
              setQuery={setQuery}
              filter={filter}
              setFilter={setFilter}
              total={routes.length}
              filteredCount={filtered.length}
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index * 20, 280)).springify()}
            >
              <RouteCard route={item} />
            </Animated.View>
          )}
          ListEmptyComponent={
            isLoading ? (
              <View style={{ gap: 10 }}>
                <RouteRowSkeleton />
                <RouteRowSkeleton />
                <RouteRowSkeleton />
                <RouteRowSkeleton />
                <RouteRowSkeleton />
              </View>
            ) : (
              <View style={styles.empty}>
                <Feather name="map" size={36} color={Colors.dark.textMuted} />
                <Text style={styles.emptyText}>
                  {hasFilters ? "No routes match your search" : "No routes loaded yet"}
                </Text>
                <Text style={styles.emptySub}>
                  {hasFilters
                    ? "Even with typos we couldn't find a match. Try a shorter word or a major area name."
                    : "Pull down to refresh"}
                </Text>
                {hasFilters && (
                  <Pressable onPress={clearFilters} style={styles.emptyCta}>
                    <Feather name="refresh-cw" size={14} color={Colors.primary} />
                    <Text style={styles.emptyCtaText}>Clear filters</Text>
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
  query, setQuery, filter, setFilter, total, filteredCount,
}: {
  query: string; setQuery: (q: string) => void;
  filter: BusType | "All"; setFilter: (f: BusType | "All") => void;
  total: number; filteredCount: number;
}) {
  return (
    <View style={{ paddingTop: 8, paddingBottom: 14 }}>
      <Animated.View entering={FadeInUp.duration(450)}>
        <Text style={styles.eyebrow}>BMTC NETWORK</Text>
        <Text style={styles.title}>All routes</Text>
        <Text style={styles.subtitle}>
          {total.toLocaleString()} routes across Bengaluru
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(80)} style={styles.searchBar}>
        <Feather name="search" size={16} color={Colors.dark.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by number, name, or stop"
          placeholderTextColor={Colors.dark.textFaint}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setQuery(""); }}
            style={styles.clearBtn}
          >
            <Feather name="x" size={14} color={Colors.dark.textMuted} />
          </Pressable>
        )}
      </Animated.View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingRight: 16, marginTop: 6 }}
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

      <Text style={styles.resultCount}>
        Showing {filteredCount.toLocaleString()} of {total.toLocaleString()}
      </Text>
    </View>
  );
}

function RouteCard({ route }: { route: Route }) {
  const config = BUS_TYPE_CONFIG[route.busType] || BUS_TYPE_CONFIG.Ordinary;
  const gradient = getBusTypeGradient(route.busType);

  return (
    <Card
      onPress={() => router.push(`/route/${route.id}` as any)}
      style={{ marginBottom: 10 }}
    >
      <View style={styles.routeRow}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.routeBadge}
        >
          <Text style={styles.routeBadgeText} numberOfLines={1}>{route.number}</Text>
        </LinearGradient>

        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
          <Text style={styles.routePath} numberOfLines={1}>
            {route.from} → {route.to}
          </Text>
          <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
            <Badge variant="primary" emoji={config.icon} label={config.label} size="sm" />
            <Badge
              variant="neutral"
              icon="map-pin"
              label={`${route.totalStops} stops`}
              size="sm"
            />
            {route.distance ? (
              <Badge
                variant="neutral"
                icon="navigation-2"
                label={`${route.distance} km`}
                size="sm"
              />
            ) : null}
          </View>
        </View>

        <Feather name="chevron-right" size={18} color={Colors.dark.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark.background },

  eyebrow: { ...Type.micro, color: Colors.accent, letterSpacing: 1.5 },
  title: { ...Type.display, color: Colors.dark.text, marginTop: 2 },
  subtitle: { ...Type.caption, color: Colors.dark.textMuted, marginTop: 4 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    marginTop: 18,
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    padding: 0,
  },
  clearBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.dark.cardBorderStrong,
    alignItems: "center", justifyContent: "center",
  },

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
  },
  chipText: { ...Type.caption, color: Colors.dark.textSecondary },
  chipTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },

  resultCount: { ...Type.caption, color: Colors.dark.textMuted, marginTop: 12 },

  routeRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  routeBadge: {
    minWidth: 60, height: 50,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  routeBadgeText: { ...Type.heading, color: "#fff" },
  routeName: { ...Type.subtitle, color: Colors.dark.text },
  routePath: { ...Type.caption, color: Colors.dark.textMuted },

  empty: { alignItems: "center", paddingVertical: 60, gap: 8, paddingHorizontal: 20 },
  emptyText: { ...Type.subtitle, color: Colors.dark.text, marginTop: 12, textAlign: "center" },
  emptySub: { ...Type.caption, color: Colors.dark.textMuted, textAlign: "center" },
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
