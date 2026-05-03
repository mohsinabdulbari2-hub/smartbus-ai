import { useLiveBusesPolling, useGetStops, useGetRoutes, useFleetTotal } from "@/hooks/use-smartbus";
import { useGeolocation } from "@/hooks/use-geolocation";
import { LiveMap, type LiveMapMode } from "@/components/map/LiveMap";
import { Activity, Search, Route as RouteIcon, MapPin } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const NEARBY_RADIUS_KM = 5;
const MODE_STORAGE_KEY = "smartbus.busMode";

export default function HomePage() {
  // Persist the user's mode choice across reloads so they don't keep flipping
  // back to Nearby every visit.
  const [mode, setMode] = useState<LiveMapMode>(() => {
    // Wrap in try/catch — Safari private mode and some enterprise policies
    // throw SecurityError on localStorage access, which would crash render.
    try {
      if (typeof localStorage === "undefined") return "nearby";
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      return saved === "all" ? "all" : "nearby";
    } catch {
      return "nearby";
    }
  });
  useEffect(() => {
    try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  const geo = useGeolocation();
  const { data: stops, isLoading: stopsLoading } = useGetStops();
  const { data: routes } = useGetRoutes();
  const fleetTotal = useFleetTotal();

  // In Nearby mode, ask the server to filter by radius (it falls back to the
  // 20 nearest if nothing's inside the 5km ring). In All mode, omit lat/lng
  // and let the response come back capped at 100 by the server.
  const liveParams =
    mode === "nearby"
      ? { lat: geo.lat, lng: geo.lng, radius: NEARBY_RADIUS_KM }
      : undefined;
  const { data: buses, isLoading: busesLoading } = useLiveBusesPolling(liveParams);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Floating Status Bar (Top Right) */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-4 left-4 right-4 md:left-auto md:right-6 md:top-6 z-40 flex flex-wrap items-center justify-between md:justify-end gap-2 md:gap-4"
      >
        <div className="bg-card/70 backdrop-blur-xl px-3 md:px-5 py-2.5 md:py-3 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-border/50 flex items-center gap-2 md:gap-3">
          <div className="relative flex h-3 w-3 md:h-3.5 md:w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 md:h-3.5 md:w-3.5 bg-success shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
          </div>
          <span className="font-bold text-xs md:text-sm tracking-wide whitespace-nowrap">
            {busesLoading
              ? "Connecting..."
              : `${buses?.length || 0} Live`}
          </span>
        </div>

        {/* Nearby / All toggle — segmented pill, blends with existing chips. */}
        <div
          role="tablist"
          aria-label="Bus visibility"
          className="bg-card/70 backdrop-blur-xl rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-border/50 p-1 flex items-center text-xs font-bold"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "nearby"}
            onClick={() => setMode("nearby")}
            className={`px-3 py-1.5 rounded-full transition-colors ${
              mode === "nearby"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Nearby
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "all"}
            onClick={() => setMode("all")}
            className={`px-3 py-1.5 rounded-full transition-colors ${
              mode === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Buses
          </button>
        </div>

        <Link 
          href="/search"
          className="md:hidden bg-primary text-primary-foreground p-3 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] flex items-center justify-center border border-primary/50"
        >
          <Search className="w-5 h-5" />
        </Link>
      </motion.div>

      {/* Floating Stats Card (Left Desktop) */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="hidden md:flex flex-col gap-3 absolute top-6 left-6 z-40 w-64"
      >
        <div className="bg-card/70 backdrop-blur-xl p-5 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-border/50">
          <div className="flex items-center gap-2 mb-4 text-muted-foreground font-medium text-sm">
            <span>📍 Bengaluru 🚌</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <RouteIcon className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase">Routes</span>
              </div>
              <div className="text-3xl font-display font-black">{routes?.length?.toLocaleString() ?? "—"}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <MapPin className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold uppercase">Stops</span>
              </div>
              <div className="text-3xl font-display font-black">{stops?.length || 0}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Map */}
      <div className="flex-1 relative z-10 bg-background">
        <LiveMap
          buses={buses}
          stops={stops}
          mode={mode}
          userLat={geo.lat}
          userLng={geo.lng}
          fleetTotal={fleetTotal}
          nearbyRadiusKm={NEARBY_RADIUS_KM}
        />
        
        {/* Loading overlay */}
        {(busesLoading || stopsLoading) && !buses && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-md flex items-center justify-center z-50">
            <div className="bg-card p-8 rounded-3xl shadow-2xl border border-border/50 flex flex-col items-center">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-t-2 border-accent animate-spin-reverse"></div>
                <Activity className="absolute inset-0 m-auto w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display font-bold text-2xl tracking-tight">Connecting to Fleet</h3>
              <p className="text-muted-foreground mt-2">Acquiring live GPS feeds...</p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Search Prompt (Bottom) */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="absolute bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] md:w-full max-w-md"
      >
        <Link href="/search">
          <div className="bg-card/80 backdrop-blur-2xl p-4 md:p-5 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] border border-border/50 flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:border-primary/50 transition-all group">
            <div className="bg-primary/20 p-3.5 rounded-2xl group-hover:bg-primary/30 transition-colors">
              <Search className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">Where to?</h3>
              <p className="text-sm text-muted-foreground font-medium">Find routes, stops, and live ETAs</p>
            </div>
          </div>
        </Link>
      </motion.div>
    </div>
  );
}
