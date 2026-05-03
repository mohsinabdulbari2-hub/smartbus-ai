import { useLiveBusesPolling, useGetStops, useGetRoutes } from "@/hooks/use-smartbus";
import { LiveMap } from "@/components/map/LiveMap";
import { Activity, Search, Route as RouteIcon, MapPin } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function HomePage() {
  const { data: buses, isLoading: busesLoading } = useLiveBusesPolling();
  const { data: stops, isLoading: stopsLoading } = useGetStops();
  const { data: routes } = useGetRoutes();

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Floating Status Bar (Top Right) */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-4 left-4 right-4 md:left-auto md:right-6 md:top-6 z-40 flex items-center justify-between md:justify-end gap-4"
      >
        <div className="bg-card/70 backdrop-blur-xl px-5 py-3 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-border/50 flex items-center gap-3">
          <div className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-success shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
          </div>
          <span className="font-bold text-sm tracking-wide">
            {busesLoading ? "Connecting..." : `${buses?.length || 0} Live Buses`}
          </span>
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
        <LiveMap buses={buses} stops={stops} />
        
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
