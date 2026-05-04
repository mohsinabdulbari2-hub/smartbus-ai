import { cn, getCrowdColor } from "@/lib/utils";
import { LiveBusCrowdLevel } from "@workspace/api-client-react";
import { AlertTriangle, Users, Clock, Activity } from "lucide-react";

interface CrowdBadgeProps {
  level: LiveBusCrowdLevel | string;
  className?: string;
  showIcon?: boolean;
}

export function CrowdBadge({ level, className, showIcon = true }: CrowdBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-md",
      getCrowdColor(level),
      className
    )}>
      {showIcon && (
        <Users className={cn("w-3.5 h-3.5", level === "High" && "animate-pulse")} />
      )}
      {level} Crowd
    </span>
  );
}

export function LastBusBadge({ className }: { className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/50 shadow-[0_0_15px_rgba(249,115,22,0.3)] animate-pulse",
      className
    )}>
      <AlertTriangle className="w-3.5 h-3.5" />
      Last Bus!
    </span>
  );
}

export function FrequencyBadge({ frequency, className }: { frequency: number | string, className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/15 text-accent border border-accent/30",
      className
    )}>
      <Clock className="w-3.5 h-3.5" />
      Every {frequency}min
    </span>
  );
}

export function SpeedBadge({ speed, className }: { speed: number | string, className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground border border-border/50",
      className
    )}>
      <Activity className="w-3.5 h-3.5 opacity-70" />
      {speed} km/h
    </span>
  );
}
