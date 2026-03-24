import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Map, Search, Route as RouteIcon, Bus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { name: "Live Map", path: "/", icon: Map },
    { name: "Search", path: "/search", icon: Search },
    { name: "Routes", path: "/routes", icon: RouteIcon },
  ];

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden font-sans text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-card border-r border-border/50 relative z-50 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
        {/* Top Gradient Border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
        
        <div className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.4)] border border-primary/30">
              <Bus className="text-primary w-6 h-6" />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-foreground">
              Smart<span className="text-primary">Bus</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground ml-[52px] font-medium tracking-wide opacity-80">
            Bangalore Transit Intelligence
          </p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all duration-300 group relative overflow-hidden",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                )}
              >
                <item.icon className={cn("w-5 h-5 relative z-10", isActive ? "text-primary-foreground" : "group-hover:text-accent transition-colors")} />
                <span className="relative z-10">{item.name}</span>
                {isActive && <div className="absolute inset-0 bg-gradient-to-r from-primary to-orange-400 opacity-50"></div>}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 m-4 bg-secondary/50 rounded-xl border border-border/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
            </span>
            <span className="font-bold text-sm text-foreground">Live Updates</span>
          </div>
          <p className="text-xs text-muted-foreground ml-5">Refreshing every 3s</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-full">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-card/80 backdrop-blur-xl border-b border-border/50 absolute top-0 w-full z-40 shadow-sm">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Bus className="text-primary w-6 h-6 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
              <span className="font-display font-bold text-xl tracking-tight text-foreground">Smart<span className="text-primary">Bus</span></span>
            </div>
            <p className="text-[10px] text-muted-foreground ml-8 -mt-0.5">Bangalore Transit Intelligence</p>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-background w-full h-full pb-[72px] md:pb-0 pt-[60px] md:pt-0 relative">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden absolute bottom-0 w-full bg-card/70 backdrop-blur-2xl border-t border-border/50 pb-safe z-50 flex items-center justify-around px-2 py-2 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 relative",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-primary/10 rounded-xl blur-md -z-10"></div>
              )}
              <div className={cn(
                "flex items-center justify-center p-1.5 rounded-xl transition-all duration-300",
                isActive && "bg-primary/20 scale-110"
              )}>
                <item.icon className={cn("w-6 h-6", isActive && "text-primary drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]")} />
              </div>
              <span className="text-[10px] font-medium mt-1">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
