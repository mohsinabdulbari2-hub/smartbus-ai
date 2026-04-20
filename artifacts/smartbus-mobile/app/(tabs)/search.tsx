import { Feather, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CrowdBadge, LastBusBadge, TagBadge } from "@/components/CrowdBadge";
import Colors from "@/constants/colors";
import { api, SearchResult } from "@/lib/api";

const QUICK_STOPS = ["Majestic", "Hebbal", "Whitefield", "Electronic City", "Silk Board", "KR Puram"];
const FILTER_TABS = [
  { key: "all", label: "All", icon: "layers" },
  { key: "recommended", label: "Best", icon: "star" },
  { key: "fastest", label: "Fastest", icon: "zap" },
  { key: "low_crowd", label: "Less Crowded", icon: "users" },
] as const;

type FilterKey = typeof FILTER_TABS[number]["key"];

function RouteResultCard({ item, minEta }: { item: SearchResult; minEta: number }) {
  const etaDiff = item.etaMinutes - minEta;
  const crowdBarPct = item.crowdLevel === "High" ? 0.85 : item.crowdLevel === "Medium" ? 0.5 : 0.2;
  const crowdColor = item.crowdLevel === "High" ? Colors.danger : item.crowdLevel === "Medium" ? Colors.warning : Colors.success;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.resultCard,
        item.isRecommended && styles.resultCardRecommended,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: "/route/[id]", params: { id: item.routeId } });
      }}
    >
      {item.isRecommended && (
        <View style={styles.recommendedBar} />
      )}

      {/* Tags */}
      {item.tags.length > 0 && (
        <View style={styles.tagRow}>
          {item.tags.map((t) => <TagBadge key={t} tag={t} />)}
        </View>
      )}

      {/* Main row */}
      <View style={styles.resultMain}>
        <View style={[styles.resultBadge, { backgroundColor: item.routeColor || Colors.primary }]}>
          <Text style={styles.resultBadgeText}>{item.routeNumber}</Text>
        </View>
        <View style={styles.resultInfo}>
          <Text style={styles.resultName} numberOfLines={1}>{item.routeName}</Text>
          <View style={styles.resultRoute}>
            <Text style={styles.resultStop} numberOfLines={1}>{item.sourceStop}</Text>
            <Feather name="arrow-right" size={11} color={Colors.dark.textMuted} />
            <Text style={styles.resultStop} numberOfLines={1}>{item.destinationStop}</Text>
          </View>
          <View style={styles.resultMeta}>
            <Feather name="clock" size={11} color={Colors.dark.textMuted} />
            <Text style={styles.resultMetaText}>Every {item.frequency} min • {item.stopCount} stops</Text>
          </View>
        </View>
        <View style={styles.etaBox}>
          <Text style={styles.etaValue}>{item.etaMinutes}</Text>
          <Text style={styles.etaUnit}>min</Text>
          {etaDiff > 0 && <Text style={styles.etaDiff}>+{etaDiff}</Text>}
        </View>
      </View>

      {/* Bottom */}
      <View style={styles.resultBottom}>
        <View style={styles.resultBadges}>
          <CrowdBadge level={item.crowdLevel} />
          {item.isLastBus && <LastBusBadge />}
        </View>
        <View style={styles.crowdBarContainer}>
          <View style={[styles.crowdBarFill, { width: `${crowdBarPct * 100}%` as any, backgroundColor: crowdColor }]} />
        </View>
        <Feather name="chevron-right" size={16} color={Colors.dark.textMuted} />
      </View>

      {item.isRecommended && (
        <View style={styles.recommendedFooter}>
          <Ionicons name="star" size={12} color={Colors.primary} />
          <Text style={styles.recommendedFooterText}>Best match for your journey</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searched, setSearched] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ["search", from, to],
    queryFn: () => api.searchRoutes(from, to),
    enabled: searched && from.length > 2 && to.length > 2,
  });

  const handleSearch = () => {
    if (!from || !to) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSearched(true);
    setFilter("all");
    refetch();
  };

  const swap = () => {
    Haptics.selectionAsync();
    const tmp = from;
    setFrom(to);
    setTo(tmp);
    setSearched(false);
  };

  const applyQuick = (stop: string) => {
    Haptics.selectionAsync();
    if (!from) setFrom(stop);
    else if (!to) {
      setTo(stop);
      setTimeout(() => {
        setSearched(true);
      }, 100);
    } else setTo(stop);
  };

  const filtered = (() => {
    if (!results) return [];
    if (filter === "all") return results;
    if (filter === "recommended") return results.filter((r) => r.isRecommended || r.tags.includes("Recommended"));
    if (filter === "fastest") return results.filter((r) => r.isFastest || r.tags.includes("Fastest"));
    if (filter === "low_crowd") return results.filter((r) => r.crowdLevel === "Low" || r.tags.includes("Less Crowded"));
    return results;
  })();

  const minEta = results && results.length > 0 ? Math.min(...results.map((r) => r.etaMinutes)) : 0;

  return (
    <View style={[styles.container, { backgroundColor: Colors.dark.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Plan Journey</Text>

        {/* Input card */}
        <View style={styles.inputCard}>
          <View style={styles.inputLine}>
            <View style={styles.inputGradientLine} />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputDot, { backgroundColor: Colors.primary }]} />
            <TextInput
              style={styles.input}
              placeholder="From — starting point"
              placeholderTextColor={Colors.dark.textMuted}
              value={from}
              onChangeText={(t) => { setFrom(t); setSearched(false); }}
              returnKeyType="next"
            />
            {from.length > 0 && (
              <Pressable onPress={() => setFrom("")}>
                <Feather name="x" size={16} color={Colors.dark.textMuted} />
              </Pressable>
            )}
          </View>

          <View style={styles.inputDivider} />

          <View style={styles.inputRow}>
            <View style={[styles.inputDot, styles.inputDotDest, { backgroundColor: Colors.accent }]} />
            <TextInput
              style={styles.input}
              placeholder="To — destination"
              placeholderTextColor={Colors.dark.textMuted}
              value={to}
              onChangeText={(t) => { setTo(t); setSearched(false); }}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {to.length > 0 && (
              <Pressable onPress={() => setTo("")}>
                <Feather name="x" size={16} color={Colors.dark.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Swap button */}
          <Pressable style={styles.swapBtn} onPress={swap}>
            <Feather name="arrow-up" size={8} color={Colors.dark.textMuted} />
            <Feather name="arrow-down" size={8} color={Colors.dark.textMuted} />
          </Pressable>
        </View>

        {/* Quick stops */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
          {QUICK_STOPS.map((s) => (
            <TouchableOpacity key={s} onPress={() => applyQuick(s)} style={styles.quickChip}>
              <Text style={styles.quickChipText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search button */}
        <Pressable
          style={({ pressed }) => [styles.searchBtn, (!from || !to) && styles.searchBtnDisabled, pressed && { opacity: 0.85 }]}
          onPress={handleSearch}
          disabled={!from || !to || isLoading}
        >
          <Feather name="navigation" size={18} color="#fff" />
          <Text style={styles.searchBtnText}>
            {isLoading ? "Finding routes..." : "Search Routes"}
          </Text>
        </Pressable>
      </View>

      {/* Results */}
      <View style={styles.results}>
        {!searched && (
          <View style={styles.emptyState}>
            <Feather name="map-pin" size={48} color={Colors.dark.textMuted} />
            <Text style={styles.emptyTitle}>Where are we going?</Text>
            <Text style={styles.emptySubtitle}>Enter stops above to see route options</Text>
          </View>
        )}

        {results && results.length > 0 && (
          <>
            {/* Comparison summary */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: Colors.primary }]}>{minEta}</Text>
                <Text style={styles.summaryLabel}>Min ETA</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{results.length}</Text>
                <Text style={styles.summaryLabel}>Routes Found</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: Colors.accent }]}>
                  {Math.max(...results.map((r) => r.etaMinutes)) - minEta}
                </Text>
                <Text style={styles.summaryLabel}>Min Saved</Text>
              </View>
            </View>

            {/* Filter tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {FILTER_TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => { setFilter(tab.key); Haptics.selectionAsync(); }}
                  style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
                >
                  <Feather
                    name={tab.icon as any}
                    size={13}
                    color={filter === tab.key ? "#fff" : Colors.dark.textMuted}
                  />
                  <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {searched && results && results.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="alert-circle" size={48} color={Colors.dark.textMuted} />
            <Text style={styles.emptyTitle}>No routes found</Text>
            <Text style={styles.emptySubtitle}>Try nearby stops like Majestic or Hebbal</Text>
          </View>
        )}

        <FlatList
          data={filtered}
          keyExtractor={(item, i) => `${item.routeId}-${i}`}
          renderItem={({ item }) => <RouteResultCard item={item} minEta={minEta} />}
          contentContainerStyle={[styles.resultList, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#0f172a",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  inputCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 4,
    position: "relative",
    marginBottom: 12,
  },
  inputLine: {
    position: "absolute",
    left: 22,
    top: 24,
    bottom: 24,
    width: 2,
    overflow: "hidden",
  },
  inputGradientLine: {
    flex: 1,
    backgroundColor: "#e2e8f0",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  inputDotDest: {
    borderRadius: 3,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#0f172a",
  },
  inputDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 14,
  },
  swapBtn: {
    position: "absolute",
    right: 14,
    top: "50%",
    marginTop: -14,
    width: 28,
    height: 28,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  quickScroll: { marginBottom: 12 },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 8,
  },
  quickChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#94a3b8",
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  results: { flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 80,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#94a3b8", textAlign: "center" },
  summaryRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#0f172a" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748b", marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: "#e2e8f0" },
  filterScroll: { marginHorizontal: 20, marginBottom: 12 },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: "#ffffff",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  filterTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  filterTabTextActive: { color: "#fff" },
  resultList: { paddingHorizontal: 20, paddingTop: 4, gap: 12 },
  resultCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  resultCardRecommended: {
    borderColor: "rgba(37,99,235,0.4)",
    shadowColor: "#2563eb",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  recommendedBar: {
    height: 2,
    backgroundColor: Colors.primary,
  },
  tagRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    flexWrap: "wrap",
  },
  resultMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  resultBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  resultBadgeText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0f172a", marginBottom: 3 },
  resultRoute: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  resultStop: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8", maxWidth: 80 },
  resultMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  resultMetaText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748b" },
  etaBox: { alignItems: "flex-end" },
  etaValue: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.primary, lineHeight: 32 },
  etaUnit: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  etaDiff: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748b", marginTop: 2 },
  resultBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  resultBadges: { flexDirection: "row", gap: 6, alignItems: "center" },
  crowdBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
    overflow: "hidden",
  },
  crowdBarFill: { height: 4, borderRadius: 2 },
  recommendedFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(37,99,235,0.06)",
    borderTopWidth: 1,
    borderTopColor: "rgba(37,99,235,0.15)",
  },
  recommendedFooterText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },
});
