import { useParams } from "wouter";
import { useGetRoute, useGetRouteFrequency, useLiveBusesPolling } from "@/hooks/use-smartbus";
import { Loader2, ArrowLeft, Map, Clock, AlertTriangle, Bus } from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";
import { useState } from "react";
import { CrowdBadge } from "@/components/ui/badges";

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dayType, setDayType] = useState<"weekday" | "weekend">("weekday");
  
  const { data: route, isLoading: routeLoading } = useGetRoute(id || "");
  const { data: frequency, isLoading: freqLoading } = useGetRouteFrequency(id || "", { query: { enabled: !!id } });
  
  // Get live buses for this specific route
  const { data: liveBuses } = useLiveBusesPolling();
  const routeBuses = liveBuses?.filter(b => b.routeId === id) || [];

  if (routeLoading || freqLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-t-4 border-primary animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="p-8 text-center h-full flex flex-col items-center justify-center">
        <h2 className="text-3xl font-display font-bold mb-4">Route not found</h2>
        <Link href="/routes" className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90">Back to Routes</Link>
      </div>
    );
  }

  // Transform frequency data for Recharts
  const chartData = frequency ? [
    { name: 'Morning', buses: frequency.morning },
    { name: 'Afternoon', buses: frequency.afternoon },
    { name: 'Evening', buses: frequency.evening },
    { name: 'Night', buses: frequency.night },
  ] : [];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Colored Hero Banner */}
      <div 
        className="relative z-20 shrink-0 pb-6 pt-6 px-4 md:px-8 overflow-hidden shadow-lg"
        style={{ background: `linear-gradient(135deg, ${route.color || '#f97316'} 0%, rgba(15,23,42,0.95) 100%)` }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4=')] opacity-10 mix-blend-overlay"></div>
        
        <div className="max-w-4xl mx-auto w-full relative z-10 flex flex-col gap-6">
          <Link href="/routes" className="w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md flex items-center justify-center text-white transition-colors border border-white/10">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          
          <div className="flex items-start gap-5">
            <div className="font-display font-black text-6xl md:text-7xl text-white tracking-tighter drop-shadow-xl">
              {route.number}
            </div>
            <div className="pt-2">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-white leading-tight drop-shadow-md">{route.name}</h1>
              <div className="flex items-center gap-2 text-white/80 font-medium mt-2 text-sm md:text-base">
                <span>{route.from}</span>
                <ArrowLeft className="w-4 h-4 rotate-180" />
                <span>{route.to}</span>
              </div>
            </div>
          </div>
          
          {route.isLastBus && (
            <div className="bg-orange-500/20 border border-orange-500/50 backdrop-blur-md rounded-xl p-3 flex items-center gap-3 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <span className="text-orange-100 font-bold uppercase tracking-wider text-sm">Last bus of the day is currently active!</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8 space-y-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
          
          {/* Live Buses Horizontal Scroll */}
          {routeBuses.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                </div>
                <h2 className="font-bold text-lg">Live on Route ({routeBuses.length})</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x">
                {routeBuses.map(bus => (
                  <div key={bus.id} className="snap-start shrink-0 w-64 bg-card rounded-2xl p-4 border border-border/50 shadow-lg flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Bus className="w-4 h-4 text-primary" />
                        <span className="font-bold text-sm truncate">{bus.nextStop}</span>
                      </div>
                      <div className="text-xs font-bold text-muted-foreground">{Number(bus.speed).toFixed(1)}km/h</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <CrowdBadge level={bus.crowdLevel} />
                      <Link href={`/stops/${bus.nextStopId}`} className="text-xs text-accent font-bold hover:underline">
                        Track →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Frequency Insights */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-3xl p-6 md:p-8 shadow-xl border border-border"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/20 rounded-xl text-primary border border-primary/20">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-bold text-xl">Service Frequency</h2>
                  <p className="text-sm text-muted-foreground">Buses per hour by time of day</p>
                </div>
              </div>
              
              <div className="flex bg-secondary rounded-lg p-1">
                <button 
                  onClick={() => setDayType("weekday")}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${dayType === 'weekday' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
                >
                  Weekday
                </button>
                <button 
                  onClick={() => setDayType("weekend")}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${dayType === 'weekend' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
                >
                  Weekend
                </button>
              </div>
            </div>
            
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }} dy={10} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.5 }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontWeight: 'bold', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                  />
                  <Bar dataKey="buses" radius={[8, 8, 8, 8]} maxBarSize={60}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 1 ? "hsl(var(--primary))" : "hsl(var(--primary)/0.4)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Route Stops Timeline */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-3xl p-6 md:p-8 shadow-xl border border-border"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-accent/20 rounded-xl text-accent border border-accent/20">
                <Map className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-xl">Route Stops</h2>
                <p className="text-sm text-muted-foreground">{route.totalStops} stops in total</p>
              </div>
            </div>

            <div className="relative pl-6 space-y-6">
              {/* Vertical Dashed Line */}
              <div className="absolute left-[31px] top-4 bottom-4 w-[2px] bg-border border-dashed z-0" />
              
              {route.stops?.map((stop, index) => {
                const isFirst = index === 0;
                const isLast = index === (route.stops?.length || 0) - 1;
                
                return (
                  <div key={stop.id} className="relative flex items-center gap-6 group z-10">
                    <div className={`absolute -left-[5px] w-4 h-4 rounded-full border-[3px] border-card z-10 transition-transform group-hover:scale-125 ${
                      isFirst ? 'bg-primary w-5 h-5 -left-[7px]' : 
                      isLast ? 'bg-accent w-5 h-5 -left-[7px]' : 
                      'bg-muted-foreground'
                    }`} />
                    
                    <div className="flex-1 bg-secondary/30 hover:bg-secondary p-4 rounded-2xl transition-all cursor-pointer border border-border/30 hover:border-border hover:shadow-md">
                      <Link href={`/stops/${stop.id}`} className="block w-full">
                        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors text-lg">{stop.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 font-medium tracking-wide">STOP #{stop.id.slice(0,8)}</p>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
