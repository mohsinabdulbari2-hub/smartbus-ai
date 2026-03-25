import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BUS_TYPE_CONFIG } from "@/components/CrowdBadge";
import Colors from "@/constants/colors";
import { api, Route } from "@/lib/api";

const TYPE_FILTERS = [
  { key: "All", label: "All Routes", icon: "🚌" },
  { key: "Ordinary", label: "Ordinary", icon: "🚌" },
  { key: "Vajra", label: "Vajra AC", icon: "❄️" },
  { key: "Volvo", label: "Volvo AC", icon: "⭐" },
  { key: "Airport", label: "Airport", icon: "✈️" },
  { key: "MetroFeeder", label: "Metro", icon: "🚇" },
  { key: "Night", label: "Night", icon: "🌙" },
];

function RouteCard({ route }: { route: Route }) {
  const typeConf = BUS_TYPE_CONFIG[route.busType] || BUS_TYPE_CONFIG.Ordinary;

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: "/route/[id]", params: { id: route.id } });
      }}
    >
      {/* Color header */}
      <View style={[s.cardHeader, { backgroundColor: route.color }]}>
        <Text style={s.cardNumber}>{route.number}</Text>
        <View style={s.headerRight}>
          <View style={s.stopsChip}>
            <Feather name="map-pin" size={9} color="rgba(255,255,255,0.85)" />
            <Text style={s.stopsChipText}>{route.totalStops}</Text>
          </View>
          {route.distance && (
            <View style={s.distChip}>
              <Text style={s.distChipText}>{route.distance}km</Text>
            </View>
          )}
        </View>
      </View>
      {/* Info */}
      <View style={s.cardBody}>
        <Text style={s.cardName} numberOfLines={2}>{route.name}</Text>
        <View style={s.cardRoute}>
          <Text style={s.cardEndpoint} numberOfLines={1}>{route.from}</Text>
          <Feather name="arrow-right" size={10} color={Colors.dark.textMuted} />
          <Text style={s.cardEndpoint} numberOfLines={1}>{route.to}</Text>
        </View>
        {/* Type + depot row */}
        <View style={s.cardMeta}>
          <View style={[s.typePill, { backgroundColor: typeConf.text + "18" }]}>
            <Text style={s.typePillIcon}>{typeConf.icon}</Text>
            <Text style={[s.typePillLabel, { color: typeConf.text }]}>{typeConf.label}</Text>
          </View>
          {route.depot && (
            <View style={s.depotPill}>
              <Feather name="home" size={9} color={Colors.dark.textMuted} />
              <Text style={s.depotText}>{route.depot}</Text>
            </View>
          )}
        </View>
        {route.lastBusTime && (
          <View style={s.lastBusRow}>
            <Feather name="moon" size={10} color={Colors.warning} />
            <Text style={s.lastBusText}>Last bus {route.lastBusTime}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const { data: routes, isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: api.getRoutes,
  });

  const filtered = useMemo(() => {
    if (!routes) return [];
    return routes.filter(r => {
      const matchType = typeFilter === "All" || r.busType === typeFilter;
      const q = query.toLowerCase();
      const matchQuery = !q ||
        r.number.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.from.toLowerCase().includes(q) ||
        r.to.toLowerCase().includes(q) ||
        (r.depot && r.depot.toLowerCase().includes(q));
      return matchType && matchQuery;
    });
  }, [routes, query, typeFilter]);

  const typeCounts = useMemo(() => {
    if (!routes) return {} as Record<string, number>;
    return routes.reduce((acc, r) => {
      acc[r.busType] = (acc[r.busType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [routes]);

  return (
    <View style={[s.container, { backgroundColor: Colors.dark.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>Routes Directory</Text>
            <Text style={s.headerSub}>{routes?.length ?? 0} routes · BMTC Bengaluru</Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={s.searchBar}>
          <Feather name="search" size={15} color={Colors.dark.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search route, stop, or depot..."
            placeholderTextColor={Colors.dark.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <Feather name="x" size={15} color={Colors.dark.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Bus type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TYPE_FILTERS.filter(t => t.key === "All" || (typeCounts[t.key] ?? 0) > 0).map(t => {
            const isActive = typeFilter === t.key;
            const cfg = t.key !== "All" ? BUS_TYPE_CONFIG[t.key] : null;
            return (
              <Pressable
                key={t.key}
                onPress={() => { setTypeFilter(t.key); Haptics.selectionAsync(); }}
                style={[s.filterTab, isActive && {
                  backgroundColor: cfg ? cfg.text + "22" : "rgba(249,115,22,0.15)",
                  borderColor: cfg ? cfg.text : Colors.primary,
                }]}
              >
                <Text style={s.filterIcon}>{t.icon}</Text>
                <Text style={[s.filterLabel, isActive && { color: cfg ? cfg.text : Colors.primary }]}>
                  {t.label}
                </Text>
                {t.key !== "All" && (typeCounts[t.key] ?? 0) > 0 && (
                  <Text style={[s.filterCount, { color: cfg ? cfg.text : Colors.primary }]}>
                    {typeCounts[t.key]}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Results count */}
      <View style={s.resultRow}>
        <Text style={s.resultText}>
          Showing {filtered.length} route{filtered.length !== 1 ? "s" : ""}
          {typeFilter !== "All" ? ` · ${typeFilter}` : ""}
        </Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        numColumns={2}
        columnWrapperStyle={s.row}
        renderItem={({ item }) => <RouteCard route={item} />}
        contentContainerStyle={[s.list, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>{typeFilter !== "All" ? BUS_TYPE_CONFIG[typeFilter]?.icon ?? "🚌" : "🚌"}</Text>
            <Text style={s.emptyText}>{isLoading ? "Loading routes..." : "No routes found"}</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: "#111827",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    gap: 10,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#f1f5f9", letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569", marginTop: 2 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1a2235",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#f1f5f9" },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#1a2235",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginRight: 8,
  },
  filterIcon: { fontSize: 12 },
  filterLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#475569" },
  filterCount: { fontSize: 11, fontFamily: "Inter_700Bold" },
  resultRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  resultText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569" },
  list: { padding: 14, gap: 10 },
  row: { gap: 10, justifyContent: "space-between" },
  card: {
    flex: 1,
    backgroundColor: "#1a2235",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1e293b",
    maxWidth: "48.5%",
  },
  cardHeader: {
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardNumber: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.5 },
  headerRight: { gap: 4, alignItems: "flex-end" },
  stopsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  stopsChipText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.9)" },
  distChip: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  distChipText: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  cardBody: { padding: 10, gap: 4 },
  cardName: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#f1f5f9" },
  cardRoute: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardEndpoint: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94a3b8", flex: 1 },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 100,
  },
  typePillIcon: { fontSize: 10 },
  typePillLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  depotPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  depotText: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.dark.textMuted },
  lastBusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  lastBusText: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.warning },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 14 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: "#475569" },
});
