import { useParams } from "wouter";
import { useGetRoute, useGetRouteFrequency } from "@/hooks/use-smartbus";
import { Loader2, ArrowLeft, Map, Clock } from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { motion } from "framer-motion";

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  const { data: route, isLoading: routeLoading } = useGetRoute(id || "");
  const { data: frequency, isLoading: freqLoading } = useGetRouteFrequency(id || "", { query: { enabled: !!id } });

  if (routeLoading || freqLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold">Route not found</h2>
        <Link href="/routes" className="text-primary mt-4 inline-block hover:underline">Back to Routes</Link>
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
    <div className="h-full flex flex-col bg-gray-50/50">
      {/* Sticky Header */}
      <div className="bg-card border-b border-border/50 sticky top-0 z-20 shadow-sm">
        <div className="p-4 md:p-6 max-w-4xl mx-auto w-full flex items-center gap-4">
          <Link href="/search" className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg"
            style={{ backgroundColor: route.color || 'var(--color-primary)' }}
          >
            {route.number}
          </div>
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight">{route.name}</h1>
            <p className="text-muted-foreground text-sm font-medium">
              {route.from} → {route.to}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6">
        
        {/* Frequency Insights */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-3xl p-6 shadow-xl shadow-black/5 border border-border/50"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Clock className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-lg">Bus Frequency</h2>
            <span className="ml-auto text-xs font-bold px-3 py-1 bg-secondary rounded-full">Buses/Hour</span>
          </div>
          
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="buses" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Route Stops Timeline */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-3xl p-6 shadow-xl shadow-black/5 border border-border/50"
        >
          <div className="flex items-center gap-2 mb-8">
            <div className="p-2 bg-accent/10 rounded-xl text-accent">
              <Map className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-lg">Route Stops</h2>
            <span className="ml-auto text-muted-foreground text-sm font-medium">{route.totalStops} Stops</span>
          </div>

          <div className="relative pl-4 space-y-8">
            <div className="absolute left-[23px] top-4 bottom-4 w-1 bg-secondary rounded-full" />
            
            {route.stops?.map((stop, index) => (
              <div key={stop.id} className="relative flex items-center gap-6 group">
                <div className="absolute -left-2 w-5 h-5 rounded-full bg-background border-4 border-primary z-10 group-hover:scale-125 transition-transform" />
                <div className="flex-1 bg-secondary/30 hover:bg-secondary/80 p-4 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-border/50">
                  <Link href={`/stops/${stop.id}`} className="block w-full">
                    <h3 className="font-bold text-foreground">{stop.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">Stop ID: {stop.id}</p>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
