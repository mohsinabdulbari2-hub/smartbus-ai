import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { api, Route } from "@/lib/api";

function RouteCard({ route }: { route: Route }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: "/route/[id]", params: { id: route.id } });
      }}
    >
      {/* Gradient top half with route number */}
      <View style={[styles.cardTop, { backgroundColor: route.color || Colors.primary }]}>
        <Text style={styles.cardRouteNumber}>{route.number}</Text>
        <View style={styles.stopsChip}>
          <Feather name="map-pin" size={10} color="rgba(255,255,255,0.8)" />
          <Text style={styles.stopsChipText}>{route.totalStops} Stops</Text>
        </View>
      </View>
      {/* Bottom info */}
      <View style={styles.cardBottom}>
        <Text style={styles.cardName} numberOfLines={1}>{route.name}</Text>
        <View style={styles.cardRoute}>
          <Text style={styles.cardFrom} numberOfLines={1}>{route.from}</Text>
          <Feather name="arrow-right" size={12} color={Colors.dark.textMuted} />
          <Text style={styles.cardTo} numberOfLines={1}>{route.to}</Text>
        </View>
        {route.lastBusTime && (
          <View style={styles.lastBusRow}>
            <Feather name="moon" size={11} color={Colors.warning} />
            <Text style={styles.lastBusText}>Last bus: {route.lastBusTime}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const { data: routes, isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: api.getRoutes,
  });

  const filtered = routes?.filter(
    (r) =>
      r.number.toLowerCase().includes(query.toLowerCase()) ||
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      r.from.toLowerCase().includes(query.toLowerCase()) ||
      r.to.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors.dark.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Routes Directory</Text>
            <Text style={styles.headerSub}>
              {routes?.length ?? 0} active routes • Bengaluru 🚌
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={Colors.dark.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search route number or name..."
            placeholderTextColor={Colors.dark.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <Feather name="x" size={16} color={Colors.dark.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => <RouteCard route={item} />}
        contentContainerStyle={[styles.list, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="map" size={48} color={Colors.dark.textMuted} />
            <Text style={styles.emptyText}>
              {isLoading ? "Loading routes..." : "No routes found"}
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
    backgroundColor: "#111827",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#f1f5f9", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#475569", marginTop: 2 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1a2235",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: "#f1f5f9" },
  list: { padding: 16, gap: 12 },
  row: { gap: 12, justifyContent: "space-between" },
  card: {
    flex: 1,
    backgroundColor: "#1a2235",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1e293b",
    maxWidth: "48.5%",
  },
  cardTop: {
    padding: 16,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardRouteNumber: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -1 },
  stopsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stopsChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.9)" },
  cardBottom: { padding: 12 },
  cardName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#f1f5f9", marginBottom: 4 },
  cardRoute: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardFrom: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94a3b8", flex: 1 },
  cardTo: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94a3b8", flex: 1 },
  lastBusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  lastBusText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.warning },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: "#475569" },
});
