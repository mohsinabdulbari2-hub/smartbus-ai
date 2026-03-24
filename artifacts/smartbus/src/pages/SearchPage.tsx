import { useState, useMemo } from "react";
import { useSearchRoutes } from "@/hooks/use-smartbus";
import {
  Search, MapPin, ArrowDownUp, ChevronRight, Loader2,
  Navigation2, Star, Zap, Users, AlertTriangle, Shuffle, Clock, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CrowdBadge, LastBusBadge } from "@/components/ui/badges";
import { Link } from "wouter";

const SUGGESTIONS = ["Majestic", "Hebbal", "Whitefield", "Electronic City", "Silk Board"];

type FilterTab = "all" | "recommended" | "fastest" | "least_crowded";

const TAB_CONFIG: { key: FilterTab; label: string; icon: typeof Star }[] = [
  { key: "all", label: "All Routes", icon: Shuffle },
  { key: "recommended", label: "Best", icon: Star },
  { key: "fastest", label: "Fastest", icon: Zap },
  { key: "least_crowded", label: "Less Crowded", icon: Users },
];

function TagBadge({ tag }: { tag: string }) {
  const config: Record<string, { color: string; icon: typeof Star }> = {
    "Recommended": { color: "#f97316", icon: Star },
    "Fastest": { color: "#3b82f6", icon: Zap },
    "Less Crowded": { color: "#22c55e", icon: Users },
    "Alternative": { color: "#6366f1", icon: Shuffle },
  };
  const c = config[tag] || config["Alternative"];
  const Icon = c.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ backgroundColor: c.color + "22", color: c.color, border: `1px solid ${c.color}44` }}
    >
      <Icon className="w-3 h-3" />
      {tag}
    </span>
  );
}

function ComparisonBar({ results }: { results: any[] }) {
  if (!results || results.length < 2) return null;
  const fastest = results.reduce((a, b) => a.etaMinutes < b.etaMinutes ? a : b);
  const leastCrowded = results.reduce((a, b) => {
    const order = { Low: 0, Medium: 1, High: 2 };
    return (order[a.crowdLevel as keyof typeof order] ?? 1) <= (order[b.crowdLevel as keyof typeof order] ?? 1) ? a : b;
  });
  const etaDiff = results.length > 1
    ? Math.max(...results.map(r => r.etaMinutes)) - fastest.etaMinutes
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 p-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-foreground">
          {results.length} routes found
        </span>
        <span className="text-xs text-muted-foreground">• tap a route to see details</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 bg-secondary/50 rounded-xl">
          <div className="text-lg font-black text-primary">{fastest.etaMinutes}</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Min ETA</div>
          <div className="text-[10px] text-muted-foreground truncate">{fastest.routeNumber}</div>
        </div>
        <div className="text-center p-2 bg-secondary/50 rounded-xl">
          <div className="text-lg font-black" style={{ color: leastCrowded.crowdLevel === 'Low' ? '#22c55e' : leastCrowded.crowdLevel === 'Medium' ? '#f59e0b' : '#ef4444' }}>
            {leastCrowded.crowdLevel}
          </div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Best Crowd</div>
          <div className="text-[10px] text-muted-foreground truncate">{leastCrowded.routeNumber}</div>
        </div>
        <div className="text-center p-2 bg-secondary/50 rounded-xl">
          <div className="text-lg font-black text-accent">{etaDiff}</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Min Saved</div>
          <div className="text-[10px] text-muted-foreground">vs slowest</div>
        </div>
      </div>
    </motion.div>
  );
}

export default function SearchPage() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [triggerSearch, setTriggerSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const { data: results, isLoading, isError } = useSearchRoutes(
    { source, destination },
    { query: { enabled: triggerSearch && source.length > 2 && destination.length > 2 } }
  );

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (source && destination) {
      setTriggerSearch(true);
      setActiveTab("all");
    }
  };

  const swapLocations = () => {
    setSource(destination);
    setDestination(source);
    setTriggerSearch(false);
  };

  const filteredResults = useMemo(() => {
    if (!results) return [];
    if (activeTab === "all") return results;
    if (activeTab === "recommended") return results.filter((r: any) => r.isRecommended || r.tags?.includes("Recommended"));
    if (activeTab === "fastest") return results.filter((r: any) => r.isFastest || r.tags?.includes("Fastest"));
    if (activeTab === "least_crowded") return results.filter((r: any) => r.isLeastCrowded || r.tags?.includes("Less Crowded") || r.crowdLevel === "Low");
    return results;
  }, [results, activeTab]);

  const minEta = results && results.length > 0 ? Math.min(...(results as any[]).map((r: any) => r.etaMinutes)) : null;

  return (
    <div className="h-full flex flex-col w-full bg-background overflow-hidden">
      {/* Search Header */}
      <div className="bg-card border-b border-border shadow-xl z-20 relative px-4 py-6 md:px-8 md:py-8 shrink-0">
        <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(ellipse at top right, rgba(249,115,22,0.08) 0%, transparent 70%)" }}></div>
        <div className="max-w-3xl mx-auto relative z-10">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-5">Plan Journey</h1>

          <form onSubmit={handleSearch} className="relative">
            <div className="absolute left-[22px] top-5 bottom-5 w-[2px] z-0" style={{ background: "linear-gradient(to bottom, #f97316, #3b82f6)" }}></div>

            <div className="space-y-3 relative z-10">
              <div className="relative">
                <div className="absolute left-[17px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-[3px] border-primary bg-background z-10 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
                <input
                  type="text"
                  placeholder="From — choose starting point"
                  value={source}
                  onChange={e => { setSource(e.target.value); setTriggerSearch(false); }}
                  className="w-full pl-14 pr-14 py-4 bg-secondary/50 border border-border/50 hover:border-border focus:bg-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all outline-none font-medium placeholder:text-muted-foreground/60"
                />
                {source && (
                  <button type="button" onClick={() => setSource("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xl font-light">×</button>
                )}
              </div>

              <div className="relative">
                <div className="absolute left-[17px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-sm border-[3px] border-accent bg-background z-10 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                <input
                  type="text"
                  placeholder="To — choose destination"
                  value={destination}
                  onChange={e => { setDestination(e.target.value); setTriggerSearch(false); }}
                  className="w-full pl-14 pr-14 py-4 bg-secondary/50 border border-border/50 hover:border-border focus:bg-secondary focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-2xl transition-all outline-none font-medium placeholder:text-muted-foreground/60"
                />
                {destination && (
                  <button type="button" onClick={() => setDestination("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xl font-light">×</button>
                )}
              </div>
            </div>

            {/* Swap Button */}
            <button
              type="button"
              onClick={swapLocations}
              title="Swap"
              className="absolute right-4 top-[calc(50%-20px)] -translate-y-1/2 bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary p-2 rounded-full shadow-md z-20 transition-all"
            >
              <ArrowDownUp className="w-4 h-4" />
            </button>

            {/* Quick Suggestions */}
            <div className="flex gap-2 overflow-x-auto pb-1 mt-4 hide-scrollbar">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (!source) setSource(s);
                    else if (!destination) { setDestination(s); setTimeout(() => handleSearch(), 50); }
                    else setDestination(s);
                  }}
                  className="whitespace-nowrap px-3.5 py-1.5 rounded-full bg-secondary/60 text-muted-foreground text-xs font-semibold border border-border/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!source || !destination || isLoading}
              className="mt-4 w-full py-4 text-white rounded-2xl font-bold text-base shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", boxShadow: "0 8px 24px rgba(249,115,22,0.3)" }}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
              {isLoading ? "Finding routes..." : "Search Routes"}
            </button>
          </form>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto bg-background relative z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 md:px-8 md:py-6 h-full flex flex-col">
          {!triggerSearch && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground opacity-50 gap-3">
              <MapPin className="w-20 h-20 drop-shadow-xl" />
              <p className="text-xl font-medium">Where are we going?</p>
              <p className="text-sm">Enter stops above to see route options</p>
            </div>
          )}

          {isError && (
            <div className="p-5 rounded-2xl border border-destructive/20 text-destructive text-center font-medium"
              style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
              Failed to search routes. Please try again.
            </div>
          )}

          {results && results.length === 0 && (
            <div className="text-center py-16 bg-card rounded-3xl border border-dashed border-border/50">
              <AlertTriangle className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-2xl font-bold">No direct routes found</h3>
              <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
                Try nearby stops like <span className="text-primary font-semibold">Majestic</span> or <span className="text-primary font-semibold">Hebbal</span>
              </p>
            </div>
          )}

          {results && results.length > 0 && (
            <>
              {/* Comparison Summary */}
              <ComparisonBar results={results as any[]} />

              {/* Filter Tabs */}
              <div className="flex gap-2 mb-5 overflow-x-auto hide-scrollbar">
                {TAB_CONFIG.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className="flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all shrink-0"
                      style={isActive
                        ? { backgroundColor: "#f97316", color: "white", boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }
                        : { backgroundColor: "var(--color-secondary)", color: "var(--color-muted-foreground)" }
                      }
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Route Cards */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 pb-20"
                >
                  {filteredResults.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="font-medium">No routes match this filter</p>
                      <button onClick={() => setActiveTab("all")} className="mt-2 text-primary text-sm font-bold hover:underline">
                        View all routes
                      </button>
                    </div>
                  )}

                  {(filteredResults as any[]).map((route: any, i: number) => {
                    const isRecommended = route.isRecommended;
                    const etaDiffFromFastest = route.etaMinutes - (minEta ?? route.etaMinutes);
                    const crowdColors: Record<string, string> = { Low: "#22c55e", Medium: "#f59e0b", High: "#ef4444" };
                    const crowdColor = crowdColors[route.crowdLevel] || "#6b7280";

                    return (
                      <motion.div
                        key={`${route.routeId}-${i}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                      >
                        <Link href={`/routes/${route.routeId}`}>
                          <div className={`relative overflow-hidden rounded-3xl border transition-all cursor-pointer group hover:-translate-y-1 ${
                            isRecommended
                              ? "border-primary/60 bg-card shadow-[0_0_0_1px_rgba(249,115,22,0.15),0_8px_32px_rgba(249,115,22,0.12)]"
                              : "border-border bg-card shadow-xl hover:border-primary/30"
                          }`}>

                            {/* Recommended glow bar */}
                            {isRecommended && (
                              <div className="absolute top-0 left-0 right-0 h-0.5"
                                style={{ background: "linear-gradient(90deg, #f97316, #fb923c, #f97316)" }} />
                            )}

                            {/* Left route color accent */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover:w-2"
                              style={{ backgroundColor: route.routeColor || "#f97316" }}
                            />

                            <div className="pl-5 pr-5 pt-5 pb-4">
                              {/* Tags row */}
                              {route.tags && route.tags.length > 0 && (
                                <div className="flex gap-2 mb-3 flex-wrap">
                                  {(route.tags as string[]).map((tag: string) => (
                                    <TagBadge key={tag} tag={tag} />
                                  ))}
                                </div>
                              )}

                              {/* Main content */}
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                  <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shrink-0"
                                    style={{ backgroundColor: route.routeColor || "#f97316" }}
                                  >
                                    {route.routeNumber}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                      {route.routeName}
                                    </h3>
                                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground font-medium">
                                      <span className="truncate max-w-[100px]">{route.sourceStop}</span>
                                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate max-w-[100px]">{route.destinationStop}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                                      <Clock className="w-3 h-3" />
                                      <span>Every {route.frequency} min</span>
                                      <span className="text-border">•</span>
                                      <span>{route.stopCount} stops</span>
                                    </div>
                                  </div>
                                </div>

                                {/* ETA block */}
                                <div className="text-right shrink-0">
                                  <div className="text-3xl font-black text-primary leading-none">
                                    {route.etaMinutes}
                                  </div>
                                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">min</div>
                                  {etaDiffFromFastest > 0 && (
                                    <div className="text-[10px] text-muted-foreground mt-1">
                                      +{etaDiffFromFastest} min
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Bottom row */}
                              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <CrowdBadge level={route.crowdLevel} />
                                  {route.isLastBus && <LastBusBadge />}
                                </div>

                                {/* Crowd bar */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: route.crowdLevel === "High" ? "90%" : route.crowdLevel === "Medium" ? "55%" : "25%",
                                        backgroundColor: crowdColor,
                                      }}
                                    />
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                              </div>
                            </div>

                            {/* "Recommended" highlight strip for first card */}
                            {isRecommended && (
                              <div className="px-5 py-2 flex items-center gap-2 border-t border-primary/20"
                                style={{ background: "rgba(249,115,22,0.06)" }}>
                                <Star className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs font-bold text-primary">Best match for your journey</span>
                              </div>
                            )}
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
