import { useState } from "react";
import { useSearchRoutes } from "@/hooks/use-smartbus";
import { Search, MapPin, ArrowDownUp, ChevronRight, Loader2, Navigation2 } from "lucide-react";
import { motion } from "framer-motion";
import { CrowdBadge, LastBusBadge, FrequencyBadge } from "@/components/ui/badges";
import { Link } from "wouter";
import { formatMinutes } from "@/lib/utils";

const SUGGESTIONS = ["Majestic", "Hebbal", "Whitefield", "Electronic City", "Silk Board"];

export default function SearchPage() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [triggerSearch, setTriggerSearch] = useState(false);

  const { data: results, isLoading, isError } = useSearchRoutes(
    { source, destination },
    { query: { enabled: triggerSearch && source.length > 2 && destination.length > 2 } }
  );

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (source && destination) {
      setTriggerSearch(true);
    }
  };

  const swapLocations = () => {
    setSource(destination);
    setDestination(source);
    setTriggerSearch(false);
  };

  return (
    <div className="h-full flex flex-col w-full bg-background overflow-hidden">
      {/* Header & Search Form */}
      <div className="bg-card border-b border-border shadow-xl z-20 relative px-4 py-6 md:px-8 md:py-8 shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-50"></div>
        
        <div className="max-w-3xl mx-auto relative z-10">
          <h1 className="font-display text-3xl font-bold text-foreground mb-6">Plan Journey</h1>
          
          <form onSubmit={handleSearch} className="relative">
            {/* Connecting line */}
            <div className="absolute left-[23px] top-8 bottom-8 w-[2px] bg-border border-dashed z-0"></div>
            
            <div className="space-y-4 relative z-10">
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-4 border-card bg-primary ring-1 ring-border z-10 shadow-sm"></div>
                <input 
                  type="text" 
                  placeholder="Choose starting point..." 
                  value={source}
                  onChange={e => { setSource(e.target.value); setTriggerSearch(false); }}
                  className="w-full pl-14 pr-12 py-4 bg-secondary/50 border border-border/50 hover:border-border focus:bg-secondary focus:border-primary focus:ring-1 focus:ring-primary rounded-2xl transition-all outline-none font-medium placeholder:text-muted-foreground/70 shadow-inner"
                />
              </div>
              
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-sm border-4 border-card bg-accent ring-1 ring-border z-10 shadow-sm"></div>
                <input 
                  type="text" 
                  placeholder="Choose destination..." 
                  value={destination}
                  onChange={e => { setDestination(e.target.value); setTriggerSearch(false); }}
                  className="w-full pl-14 pr-4 py-4 bg-secondary/50 border border-border/50 hover:border-border focus:bg-secondary focus:border-accent focus:ring-1 focus:ring-accent rounded-2xl transition-all outline-none font-medium placeholder:text-muted-foreground/70 shadow-inner"
                />
              </div>
              
              {/* Swap Button */}
              <button 
                type="button"
                onClick={swapLocations}
                className="absolute right-4 top-[calc(50%-1rem)] -translate-y-1/2 bg-card border border-border text-muted-foreground hover:text-foreground p-2 rounded-full shadow-md z-20 transition-colors"
              >
                <ArrowDownUp className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Suggestions */}
            <div className="flex gap-2 overflow-x-auto pb-2 mt-4 hide-scrollbar scroll-smooth">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (!source) setSource(s);
                    else if (!destination) { setDestination(s); handleSearch(); }
                  }}
                  className="whitespace-nowrap px-4 py-1.5 rounded-full bg-secondary/50 text-muted-foreground text-sm font-medium border border-border/50 hover:bg-secondary hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>

            <button 
              type="submit"
              disabled={!source || !destination || isLoading}
              className="mt-6 w-full py-4 bg-gradient-to-r from-primary to-orange-400 text-white rounded-2xl font-bold text-lg shadow-[0_8px_20px_rgba(249,115,22,0.3)] hover:shadow-[0_12px_25px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
              {isLoading ? "Finding routes..." : "Search Routes"}
            </button>
          </form>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-auto p-4 md:p-8 bg-background relative z-10">
        <div className="max-w-3xl mx-auto h-full">
          {!triggerSearch && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <MapPin className="w-20 h-20 mb-6 drop-shadow-2xl" />
              <p className="text-xl font-medium">Where are we going?</p>
            </div>
          )}

          {isError && (
            <div className="bg-destructive/10 text-destructive p-5 rounded-2xl text-center border border-destructive/20 font-medium">
              Failed to search routes. Please try again later.
            </div>
          )}

          {results && results.length === 0 && (
            <div className="text-center py-16 bg-card rounded-3xl border border-border/50 border-dashed">
              <h3 className="text-2xl font-bold text-foreground">No direct routes found</h3>
              <p className="text-muted-foreground mt-2">Try adjusting your locations or checking nearby stops</p>
            </div>
          )}

          <div className="space-y-5 pb-20">
            {results?.map((route, i) => (
              <motion.div 
                key={`${route.routeId}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/routes/${route.routeId}`}>
                  <div className="bg-card p-5 md:p-6 rounded-3xl shadow-xl border border-border hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden flex flex-col h-full hover:-translate-y-1">
                    {/* Hover Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    
                    {/* Left Colored Accent Border */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1.5 opacity-80 group-hover:opacity-100 group-hover:w-2 transition-all"
                      style={{ backgroundColor: route.routeColor || 'var(--color-primary)' }}
                    />
                    
                    <div className="flex justify-between items-start mb-5 pl-2">
                      <div className="flex items-start gap-4">
                        <div 
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shrink-0"
                          style={{ backgroundColor: route.routeColor || 'var(--color-primary)' }}
                        >
                          {route.routeNumber}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {route.routeName}
                          </h3>
                          <p className="text-sm text-muted-foreground font-medium mt-1">
                            {route.sourceStop} → {route.destinationStop}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0 flex flex-col items-end">
                        <div className="text-3xl font-black text-primary drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]">
                          {route.etaMinutes}
                        </div>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">min</div>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between pl-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CrowdBadge level={route.crowdLevel} />
                        <FrequencyBadge frequency={route.frequency || 15} />
                        {route.isLastBus && <LastBusBadge />}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
