import { useGetRoutes } from "@/hooks/use-smartbus";
import { Link } from "wouter";
import { Loader2, Route as RouteIcon, MapPin, Bus } from "lucide-react";
import { motion } from "framer-motion";

export default function RoutesPage() {
  const { data: routes, isLoading } = useGetRoutes();

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto w-full">
      <div className="bg-card border-b border-border/50 p-6 md:p-8 shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <RouteIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">All Routes</h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">Browse {routes?.length || 0} active bus routes</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-50/50">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routes?.map((route, i) => (
              <motion.div 
                key={route.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/routes/${route.id}`}>
                  <div className="bg-card p-5 rounded-2xl shadow-lg shadow-black/5 border border-border/50 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer h-full flex flex-col">
                    <div className="flex items-center gap-4 mb-4">
                      <div 
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md shrink-0"
                        style={{ backgroundColor: route.color || 'var(--color-primary)' }}
                      >
                        {route.number}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground leading-tight">
                          {route.name}
                        </h3>
                      </div>
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground font-medium">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-primary" />
                        {route.totalStops} Stops
                      </div>
                      <div className="flex items-center gap-1.5 bg-secondary px-3 py-1 rounded-full text-foreground">
                        View Details
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
  );
}
