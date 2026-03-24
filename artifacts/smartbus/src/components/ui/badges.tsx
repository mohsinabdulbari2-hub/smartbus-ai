import { cn } from "@/lib/utils";
import { LiveBusCrowdLevel } from "@workspace/api-client-react";
import { AlertTriangle, Users } from "lucide-react";

interface CrowdBadgeProps {
  level: LiveBusCrowdLevel | string;
  className?: string;
  showIcon?: boolean;
}

export function CrowdBadge({ level, className, showIcon = true }: CrowdBadgeProps) {
  const getStyles = () => {
    switch (level) {
      case "Low":
        return "bg-success/15 text-success border-success/30";
      case "Medium":
        return "bg-warning/20 text-warning-foreground border-warning/40";
      case "High":
        return "bg-destructive/15 text-destructive border-destructive/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
      getStyles(),
      className
    )}>
      {showIcon && <Users className="w-3.5 h-3.5" />}
      {level} Crowd
    </span>
  );
}

export function LastBusBadge({ className }: { className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-accent text-accent-foreground shadow-lg shadow-accent/20 animate-pulse",
      className
    )}>
      <AlertTriangle className="w-3.5 h-3.5" />
      Last Bus
    </span>
  );
}
