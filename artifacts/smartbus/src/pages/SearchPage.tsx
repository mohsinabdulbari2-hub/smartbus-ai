import { useState } from "react";
import { useSearchRoutes } from "@/hooks/use-smartbus";
import { ArrowDown, Search, Bus, Clock, MapPin, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { CrowdBadge, LastBusBadge } from "@/components/ui/badges";
import { Link } from "wouter";
import { formatMinutes } from "@/lib/utils";

export default function SearchPage() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [triggerSearch, setTriggerSearch] = useState(false);

  // In a real app, we'd debounce this or search on submit. Using TanStack Query's enabled flag.
  const { data: results, isLoading, isError } = useSearchRoutes(
    { source, destination },
    { query: { enabled: triggerSearch && source.length > 2 && destination.length > 2 } }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (source && destination) {
      setTriggerSearch(true);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto w-full">
      {/* Header & Search Form */}
      <div className="bg-card border-b border-border/50 p-6 md:p-8 shadow-sm z-10 relative">
        <h1 className="font-display text-3xl font-bold text-foreground mb-6">Plan Journey</h1>
        
        <form onSubmit={handleSearch} className="relative">
          <div className="absolute left-[19px] top-8 bottom-8 w-[2px] bg-border z-0"></div>
          
          <div className="space-y-4 relative z-10">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary ring-4 ring-card"></div>
              <input 
                type="text" 
                placeholder="Where from?" 
                value={source}
                onChange={e => { setSource(e.target.value); setTriggerSearch(false); }}
                className="w-full pl-12 pr-4 py-3.5 bg-background border-2 border-transparent hover:border-border focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl transition-all outline-none font-medium placeholder:font-normal shadow-sm"
              />
            </div>
            
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-accent ring-4 ring-card"></div>
              <input 
                type="text" 
                placeholder="Where to?" 
                value={destination}
                onChange={e => { setDestination(e.target.value); setTriggerSearch(false); }}
                className="w-full pl-12 pr-4 py-3.5 bg-background border-2 border-transparent hover:border-border focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl transition-all outline-none font-medium placeholder:font-normal shadow-sm"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={!source || !destination || isLoading}
            className="mt-6 w-full py-4 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-2xl font-bold text-lg shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {isLoading ? "Searching..." : "Find Routes"}
          </button>
        </form>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-50/50">
        {!triggerSearch && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
            <MapPin className="w-16 h-16 mb-4" />
            <p className="text-lg">Enter source and destination to begin</p>
          </div>
        )}

        {isError && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-center border border-destructive/20">
            Failed to search routes. Please try again.
          </div>
        )}

        {results && results.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-xl font-bold text-foreground">No direct routes found</h3>
            <p className="text-muted-foreground mt-2">Try different nearby stops</p>
          </div>
        )}

        <div className="space-y-4">
          {results?.map((route, i) => (
            <motion.div 
              key={route.routeId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/routes/${route.routeId}`}>
                <div className="bg-card p-5 rounded-2xl shadow-lg shadow-black/5 border border-border/50 hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
                        style={{ backgroundColor: route.routeColor || 'var(--color-primary)' }}
                      >
                        {route.routeNumber}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {route.routeName}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> 
                          Every {route.frequency} mins
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-primary">
                        {formatMinutes(route.etaMinutes)}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">ETA</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <CrowdBadge level={route.crowdLevel} />
                      {route.isLastBus && <LastBusBadge />}
                    </div>
                    <div className="bg-secondary text-secondary-foreground p-2 rounded-full group-hover:bg-primary group-hover:text-white transition-colors">
                      <ArrowDown className="w-4 h-4 -rotate-90" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
