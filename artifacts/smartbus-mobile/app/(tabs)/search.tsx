import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { CrowdRow } from "@/components/ui/CrowdRow";
import { getBusTypeGradient } from "@/components/CrowdBadge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import Colors from "@/constants/colors";
import { Radius, Shadow, Spacing, Type } from "@/constants/theme";
import { api, type Route, type SearchResult } from "@/lib/api";
import { fuzzyScore } from "@/lib/fuzzy";

const POPULAR_SEARCHES = [
  { from: "Majestic", to: "Electronic City",  icon: "zap" as const },
  { from: "Whitefield", to: "Marathahalli",   icon: "map-pin" as const },
  { from: "Banashankari", to: "Hebbal",        icon: "compass" as const },
  { from: "Indiranagar", to: "Koramangala",   icon: "activity" as const },
];

export default function SearchScreen() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [listeningField, setListeningField] = useState<"from" | "to" | null>(null);
  const listeningFieldRef = useRef<"from" | "to" | null>(null);
  useEffect(() => { listeningFieldRef.current = listeningField; }, [listeningField]);

  const micPulse = useSharedValue(1);
  useEffect(() => {
    micPulse.value = listeningField
      ? withTiming(1.2, { duration: 600 })
      : withTiming(1, { duration: 200 });
  }, [listeningField]);
  const micPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: micPulse.value }] }));

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    if (listeningFieldRef.current === "from") setSource(transcript);
    else if (listeningFieldRef.current === "to") setDestination(transcript);
  });
  useSpeechRecognitionEvent("end", () => setListeningField(null));
  useSpeechRecognitionEvent("error", (event) => {
    setListeningField(null);
    if (event.error && event.error !== "no-speech" && event.error !== "aborted")
      Alert.alert("Voice search", "Could not capture voice. Please try again.");
  });

  const startListening = async (field: "from" | "to") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (listeningField) { ExpoSpeechRecognitionModule.stop(); setListeningField(null); return; }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert("Microphone permission needed", "Please allow microphone access to use voice search."); return; }
      setListeningField(field);
      ExpoSpeechRecognitionModule.start({ lang: "en-IN", interimResults: false, maxAlternatives: 1, continuous: false, requiresOnDeviceRecognition: false, addsPunctuation: false, androidIntentOptions: { EXTRA_LANGUAGE_MODEL: "free_form" } });
    } catch { setListeningField(null); Alert.alert("Voice search unavailable", "Speech recognition is not available on this device."); }
  };

  const swapRotate = useSharedValue(0);
  const swapStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${swapRotate.value}deg` }] }));

  const search = useMutation({ mutationFn: ({ s, d }: { s: string; d: string }) => api.searchRoutes(s, d) });

  const { data: allRoutes } = useQuery({ queryKey: ["routes"], queryFn: api.getRoutes, staleTime: 5 * 60_000, placeholderData: (prev) => prev });

  const suggestedRoutes = useMemo<Route[]>(() => {
    if (!allRoutes || (!source.trim() && !destination.trim())) return [];
    return allRoutes
      .map((r) => ({ route: r, score: (source.trim() ? Math.max(fuzzyScore(source, r.from), fuzzyScore(source, r.to)) : 0) + (destination.trim() ? Math.max(fuzzyScore(destination, r.from), fuzzyScore(destination, r.to)) : 0) }))
      .filter((x) => x.score > 20).sort((a, b) => b.score - a.score).slice(0, 4).map((x) => x.route);
  }, [allRoutes, source, destination]);

  const onSearch = () => {
    if (!source.trim() || !destination.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    search.mutate({ s: source.trim(), d: destination.trim() });
  };

  const onSwap = () => {
    Haptics.selectionAsync();
    swapRotate.value = withSpring(swapRotate.value + 180, { damping: 14, stiffness: 200 });
    setSource(destination); setDestination(source);
  };

  const onPopular = (from: string, to: string) => {
    Haptics.selectionAsync(); setSource(from); setDestination(to);
    search.mutate({ s: from, d: to });
  };

  const allResults = search.data ?? [];
  const { topResults, otherResults } = useMemo(() => {
    const seen = new Set<string>();
    const picks: Array<{ result: SearchResult; tag: { emoji: string; label: string; color: string } }> = [];
    const recommended = allResults.find((r) => r.isRecommended);
    const fastest = allResults.find((r) => r.isFastest && r.routeId !== recommended?.routeId);
    const leastCrowded = allResults.find((r) => r.isLeastCrowded && r.routeId !== recommended?.routeId && r.routeId !== fastest?.routeId);
    if (recommended) { picks.push({ result: recommended, tag: { emoji: "⭐", label: "Recommended", color: Colors.success } }); seen.add(recommended.routeId); }
    if (fastest) { picks.push({ result: fastest, tag: { emoji: "⚡", label: "Fastest", color: Colors.primary } }); seen.add(fastest.routeId); }
    if (leastCrowded) { picks.push({ result: leastCrowded, tag: { emoji: "✦", label: "Comfortable", color: Colors.secondary } }); seen.add(leastCrowded.routeId); }
    for (const r of allResults) { if (picks.length >= 3) break; if (!seen.has(r.routeId)) { picks.push({ result: r, tag: { emoji: "🚌", label: "Option", color: Colors.dark.textSecondary } }); seen.add(r.routeId); } }
    return { topResults: picks, otherResults: allResults.filter((r) => !seen.has(r.routeId)) };
  }, [allResults]);

  const hasResults = search.data !== undefined;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#0F172A", "#0F172A"]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Header */}
            <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
              <View style={styles.headerIcon}>
                <Feather name="navigation" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>JOURNEY PLANNER</Text>
                <Text style={styles.title}>Find your bus</Text>
              </View>
            </Animated.View>

            {/* Search card */}
            <Animated.View entering={FadeInUp.delay(60).duration(400)}>
              <View style={styles.searchCard}>
                {/* FROM row */}
                <View style={styles.inputSection}>
                  <View style={styles.inputDot}>
                    <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>FROM</Text>
                    <TextInput
                      value={source}
                      onChangeText={setSource}
                      placeholder="Starting stop or area"
                      placeholderTextColor={Colors.dark.textFaint}
                      style={styles.input}
                      returnKeyType="next"
                    />
                  </View>
                  <Pressable onPress={() => startListening("from")} style={[styles.micBtn, listeningField === "from" && styles.micActive]} hitSlop={6}>
                    <Animated.View style={listeningField === "from" ? micPulseStyle : undefined}>
                      <Feather name="mic" size={17} color={listeningField === "from" ? "#fff" : Colors.primary} />
                    </Animated.View>
                  </Pressable>
                </View>

                {/* Connector */}
                <View style={styles.connector}>
                  <View style={styles.connectorLine} />
                  <Pressable onPress={onSwap} style={styles.swapBtn}>
                    <Animated.View style={swapStyle}>
                      <Feather name="repeat" size={15} color={Colors.primary} />
                    </Animated.View>
                  </Pressable>
                  <View style={styles.connectorLine} />
                </View>

                {/* TO row */}
                <View style={styles.inputSection}>
                  <View style={styles.inputDot}>
                    <View style={[styles.dot, { backgroundColor: "#a78bfa" }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>TO</Text>
                    <TextInput
                      value={destination}
                      onChangeText={setDestination}
                      placeholder="Destination stop or area"
                      placeholderTextColor={Colors.dark.textFaint}
                      style={styles.input}
                      returnKeyType="search"
                      onSubmitEditing={onSearch}
                    />
                  </View>
                  <Pressable onPress={() => startListening("to")} style={[styles.micBtn, listeningField === "to" && styles.micActive]} hitSlop={6}>
                    <Animated.View style={listeningField === "to" ? micPulseStyle : undefined}>
                      <Feather name="mic" size={17} color={listeningField === "to" ? "#fff" : "#a78bfa"} />
                    </Animated.View>
                  </Pressable>
                </View>

                {listeningField && (
                  <Animated.View entering={FadeIn} style={styles.listeningBar}>
                    <View style={styles.listeningDot} />
                    <Text style={styles.listeningText}>
                      Listening for {listeningField === "from" ? "starting" : "destination"} stop…
                    </Text>
                  </Animated.View>
                )}

                {/* Search button */}
                <Pressable
                  onPress={onSearch}
                  disabled={!source.trim() || !destination.trim() || search.isPending}
                  style={({ pressed }) => [styles.searchBtn, (!source.trim() || !destination.trim()) && styles.searchBtnDisabled, pressed && { opacity: 0.85 }]}
                >
                  <LinearGradient colors={["#2563eb", "#1d4ed8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.searchBtnGradient}>
                    {search.isPending
                      ? <Text style={styles.searchBtnText}>Searching…</Text>
                      : <>
                          <Feather name="search" size={17} color="#fff" />
                          <Text style={styles.searchBtnText}>Find My Bus</Text>
                        </>}
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>

            {/* Popular journeys */}
            {!hasResults && !search.isPending && (
              <Animated.View entering={FadeInUp.delay(140).duration(400)} style={{ marginTop: 28 }}>
                <Text style={styles.sectionLabel}>Popular journeys</Text>
                <View style={styles.popularGrid}>
                  {POPULAR_SEARCHES.map((p, i) => (
                    <Pressable
                      key={`${p.from}-${p.to}`}
                      onPress={() => onPopular(p.from, p.to)}
                      style={({ pressed }) => [styles.popularCard, pressed && { opacity: 0.75 }]}
                    >
                      <View style={styles.popularIconBox}>
                        <Feather name={p.icon} size={14} color={Colors.primary} />
                      </View>
                      <Text style={styles.popularFrom} numberOfLines={1}>{p.from}</Text>
                      <View style={styles.popularArrow}>
                        <Feather name="arrow-down" size={10} color={Colors.dark.textMuted} />
                      </View>
                      <Text style={styles.popularTo} numberOfLines={1}>{p.to}</Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Loading */}
            {search.isPending && (
              <View style={{ gap: 12, marginTop: 28 }}>
                <CardSkeleton /><CardSkeleton />
              </View>
            )}

            {/* Error */}
            {search.isError && (
              <Animated.View entering={FadeIn} style={styles.errorCard}>
                <Feather name="alert-circle" size={18} color={Colors.danger} />
                <Text style={styles.errorText}>Search failed. Check your spelling or try a major landmark.</Text>
              </Animated.View>
            )}

            {/* Top results */}
            {topResults.length > 0 && (
              <View style={{ marginTop: 28 }}>
                <Text style={styles.sectionLabel}>Top picks for you</Text>
                {topResults.map((entry, i) => (
                  <Animated.View key={entry.result.routeId + i} entering={FadeInDown.delay(i * 70).springify()}>
                    <ResultCard result={entry.result} tag={entry.tag} highlight={i === 0} />
                  </Animated.View>
                ))}
                {otherResults.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 20 }]}>More options ({otherResults.length})</Text>
                    {otherResults.map((r, i) => (
                      <Animated.View key={r.routeId + i} entering={FadeInDown.delay(i * 35).springify()}>
                        <ResultCard result={r} />
                      </Animated.View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* No results */}
            {search.data && search.data.length === 0 && (
              <Animated.View entering={FadeIn} style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Feather name="search" size={26} color={Colors.dark.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No direct routes found</Text>
                <Text style={styles.emptySub}>Try a nearby major landmark, or pick one of these.</Text>
                {suggestedRoutes.length > 0 && (
                  <View style={{ alignSelf: "stretch", marginTop: 20, gap: 8 }}>
                    <Text style={styles.sectionLabel}>Similar routes</Text>
                    {suggestedRoutes.map((r) => (
                      <Pressable key={`sg-${r.id}`} onPress={() => { Haptics.selectionAsync(); router.push(`/route/${r.id}` as any); }} style={styles.suggestionRow}>
                        <View style={styles.suggestionBadge}><Text style={styles.suggestionBadgeText} numberOfLines={1}>{r.number}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionName} numberOfLines={1}>{r.name}</Text>
                          <Text style={styles.suggestionPath} numberOfLines={1}>{r.from} → {r.to}</Text>
                        </View>
                        <Feather name="chevron-right" size={15} color={Colors.dark.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ResultCard({ result, tag, highlight }: { result: SearchResult; tag?: { emoji: string; label: string; color: string }; highlight?: boolean }) {
  const gradient = getBusTypeGradient(result.busType as any ?? "Vajra");
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); router.push(`/route/${result.routeId}` as any); }}
      style={({ pressed }) => [styles.resultCard, highlight && styles.resultCardHighlight, pressed && { opacity: 0.88 }]}
    >
      {tag && (
        <View style={[styles.tagStrip, { backgroundColor: tag.color + "18", borderBottomColor: tag.color + "30" }]}>
          <Text style={{ fontSize: 13 }}>{tag.emoji}</Text>
          <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
        </View>
      )}
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resultBadge}>
            <Text style={styles.resultBadgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{result.routeNumber}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.resultName} numberOfLines={1}>{result.routeName}</Text>
            <Text style={styles.resultPath} numberOfLines={1}>{result.sourceStop} → {result.destinationStop}</Text>
          </View>
          <View style={styles.etaBox}>
            <Text style={styles.etaValue}>{result.etaMinutes}</Text>
            <Text style={styles.etaUnit}>min</Text>
          </View>
        </View>
        <CrowdRow level={result.crowdLevel} />
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Feather name="map-pin" size={12} color={Colors.dark.textMuted} />
            <Text style={styles.metaText}>{result.stopCount} stops</Text>
          </View>
          {result.frequency > 0 && (
            <View style={styles.metaChip}>
              <Feather name="clock" size={12} color={Colors.dark.textMuted} />
              <Text style={styles.metaText}>Every {result.frequency} min</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0F172A" },

  header: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 12, marginBottom: 22 },
  headerIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(37,99,235,0.15)", borderWidth: 1, borderColor: "rgba(37,99,235,0.3)", alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.primary, letterSpacing: 2, marginBottom: 3 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.dark.text, lineHeight: 26 },

  searchCard: { backgroundColor: Colors.dark.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.dark.cardBorder, overflow: "hidden" },
  inputSection: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  inputDot: { width: 28, alignItems: "center" },
  dot: { width: 11, height: 11, borderRadius: 6 },
  inputLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.dark.textMuted, letterSpacing: 1.5, marginBottom: 3 },
  input: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.dark.text, padding: 0, minHeight: 28 },
  micBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(37,99,235,0.12)", borderWidth: 1, borderColor: "rgba(37,99,235,0.3)", alignItems: "center", justifyContent: "center" },
  micActive: { backgroundColor: Colors.danger, borderColor: Colors.danger },

  connector: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 8 },
  connectorLine: { flex: 1, height: 1, backgroundColor: Colors.dark.cardBorder },
  swapBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(37,99,235,0.12)", borderWidth: 1, borderColor: "rgba(37,99,235,0.3)", alignItems: "center", justifyContent: "center" },

  listeningBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 4, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.25)" },
  listeningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  listeningText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.danger, flex: 1 },

  searchBtn: { margin: 12, borderRadius: 14, overflow: "hidden" },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  searchBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },

  sectionLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.dark.textSecondary, letterSpacing: 0.5, marginBottom: 12 },

  popularGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  popularCard: { width: "47%", backgroundColor: Colors.dark.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.dark.cardBorder, padding: 14, gap: 6 },
  popularIconBox: { width: 30, height: 30, borderRadius: 10, backgroundColor: "rgba(37,99,235,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  popularFrom: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.dark.text },
  popularArrow: { paddingVertical: 2 },
  popularTo: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted },

  errorCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", marginTop: 16 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#f87171" },

  resultCard: { backgroundColor: Colors.dark.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.dark.cardBorder, marginBottom: 12, overflow: "hidden" },
  resultCardHighlight: { borderColor: "rgba(34,197,94,0.4)" },
  tagStrip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1 },
  tagText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  resultBadge: { width: 58, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  resultBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  resultName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.dark.text },
  resultPath: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.dark.textMuted, marginTop: 2 },
  etaBox: { alignItems: "flex-end", minWidth: 40 },
  etaValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.primary, lineHeight: 26 },
  etaUnit: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted },
  metaRow: { flexDirection: "row", gap: 10 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.dark.background, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  metaText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.dark.textMuted },

  emptyState: { alignItems: "center", paddingTop: 32, gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.cardBorder, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.dark.text },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.dark.textMuted, textAlign: "center", maxWidth: 280 },
  suggestionRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: Colors.dark.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  suggestionBadge: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 52, alignItems: "center" },
  suggestionBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  suggestionName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.dark.text },
  suggestionPath: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.dark.textMuted, marginTop: 2 },
});
