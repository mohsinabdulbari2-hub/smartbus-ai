import { useState } from "react";
import { useGetRoutes } from "@/hooks/use-smartbus";
import { Link } from "wouter";
import { Loader2, Route as RouteIcon, MapPin, Search, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function RoutesPage() {
  const { data: routes, isLoading } = useGetRoutes();
  const [filter, setFilter] = useState("");

  const filteredRoutes = routes?.filter(route => 
    route.number.toLowerCase().includes(filter.toLowerCase()) || 
    route.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col w-full">
      {/* Header area */}
      <div className="bg-card border-b border-border/80 p-6 md:p-8 shadow-sm z-20 sticky top-0 shrink-0">
        <div className="max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-primary/20 text-primary rounded-xl border border-primary/20 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
              <RouteIcon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Routes Directory</h1>
              <p className="text-muted-foreground text-sm font-medium mt-1">
                {routes?.length || 0} active routes • Bengaluru 🚌
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search route number or name..." 
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-secondary/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-2xl transition-all outline-none font-medium placeholder:text-muted-foreground/60"
            />
          </div>
        </div>
      </div>

      {/* Grid area */}
      <div className="flex-1 overflow-auto p-4 md:p-8 bg-background">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="font-medium text-lg">Loading routes...</p>
            </div>
          ) : filteredRoutes?.length === 0 ? (
            <div className="text-center py-20">
              <h3 className="text-2xl font-bold text-foreground">No routes found</h3>
              <p className="text-muted-foreground mt-2">Try a different search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-20">
              {filteredRoutes?.map((route, i) => (
                <motion.div 
                  key={route.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                >
                  <Link href={`/routes/${route.id}`}>
                    <div className="bg-card rounded-3xl shadow-lg shadow-black/20 border border-border/50 hover:border-primary/50 transition-all cursor-pointer h-full flex flex-col overflow-hidden group hover:-translate-y-1">
                      
                      {/* Top Half Gradient */}
                      <div 
                        className="p-6 pb-8 relative"
                        style={{ background: `linear-gradient(135deg, ${route.color || '#f97316'} 0%, rgba(30,41,59,0.95) 100%)` }}
                      >
                        {/* Decorative pattern overlay */}
                        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4=')]"></div>
                        
                        <div className="relative z-10 flex justify-between items-start">
                          <span className="font-display font-black text-5xl text-white drop-shadow-lg tracking-tighter">
                            {route.number}
                          </span>
                          <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-sm border border-white/10">
                            {route.totalStops} Stops
                          </div>
                        </div>
                      </div>
                      
                      {/* Bottom Half */}
                      <div className="p-6 flex-1 flex flex-col relative bg-card -mt-4 rounded-t-3xl border-t border-white/5">
                        {/* Colored Left Border Accent */}
                        <div 
                          className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full opacity-70 group-hover:opacity-100 transition-opacity"
                          style={{ backgroundColor: route.color || 'var(--color-primary)' }}
                        />
                        
                        <h3 className="font-bold text-lg text-foreground leading-tight mb-3 pl-3">
                          {route.name}
                        </h3>
                        
                        <div className="mt-auto pl-3 flex items-center gap-2 text-sm text-muted-foreground font-medium">
                          <span className="truncate">{route.from}</span>
                          <ArrowRight className="w-4 h-4 shrink-0 text-primary" />
                          <span className="truncate">{route.to}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
