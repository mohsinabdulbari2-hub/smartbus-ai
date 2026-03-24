import { useLiveBusesPolling, useGetStops } from "@/hooks/use-smartbus";
import { LiveMap } from "@/components/map/LiveMap";
import { Activity, Search, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function HomePage() {
  const { data: buses, isLoading: busesLoading } = useLiveBusesPolling();
  const { data: stops, isLoading: stopsLoading } = useGetStops();

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Floating Status Bar */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-4 left-4 right-4 md:left-auto md:right-8 md:top-8 z-40 flex items-center justify-between md:justify-end gap-4"
      >
        <div className="bg-card/90 backdrop-blur-md px-4 py-2.5 rounded-full shadow-lg border border-border/50 flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
          </div>
          <span className="font-semibold text-sm">
            {busesLoading ? "Connecting..." : `${buses?.length || 0} Buses Live`}
          </span>
        </div>

        <Link 
          href="/search"
          className="md:hidden bg-primary text-primary-foreground p-3 rounded-full shadow-lg shadow-primary/30 flex items-center justify-center"
        >
          <Search className="w-5 h-5" />
        </Link>
      </motion.div>

      {/* Main Map */}
      <div className="flex-1 relative z-10">
        <LiveMap buses={buses} stops={stops} />
        
        {/* Loading overlay if extremely slow initially */}
        {(busesLoading || stopsLoading) && !buses && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-2xl shadow-xl border border-border/50 flex flex-col items-center">
              <Activity className="w-10 h-10 text-accent animate-pulse mb-4" />
              <h3 className="font-display font-bold text-xl">Connecting to Fleet...</h3>
              <p className="text-muted-foreground text-sm mt-2">Acquiring live GPS feeds</p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Search Prompt (Desktop) */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="hidden md:block absolute bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-md"
      >
        <Link href="/search">
          <div className="bg-card/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-border/50 flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-transform hover:shadow-primary/10">
            <div className="bg-secondary p-3 rounded-xl">
              <Search className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Where to?</h3>
              <p className="text-sm text-muted-foreground">Find routes and live ETAs</p>
            </div>
          </div>
        </Link>
      </motion.div>
    </div>
  );
}
