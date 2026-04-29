// Bus Overcrowding Prediction System — Premium Dark Design System

const PRIMARY = "#2563EB";
const SECONDARY = "#7C3AED";
const SUCCESS = "#22C55E";
const WARNING = "#F59E0B";
const DANGER = "#EF4444";

export const Colors = {
  primary: PRIMARY,
  primaryDeep: "#1D4ED8",
  primaryGlow: "rgba(37,99,235,0.35)",
  secondary: SECONDARY,
  secondaryGlow: "rgba(124,58,237,0.35)",
  accent: "#06B6D4",

  success: SUCCESS,
  successSoft: "rgba(34,197,94,0.15)",
  warning: WARNING,
  warningSoft: "rgba(245,158,11,0.15)",
  danger: DANGER,
  dangerSoft: "rgba(239,68,68,0.15)",

  // Dark premium palette (kept under `dark` key for backwards compat)
  dark: {
    background: "#0F172A",
    surface: "#1E293B",
    card: "#1E293B",
    cardElevated: "#27334A",
    cardBorder: "rgba(148,163,184,0.12)",
    cardBorderStrong: "rgba(148,163,184,0.2)",
    input: "#1E293B",
    text: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
    textFaint: "#64748B",
    tabBar: "rgba(15,23,42,0.85)",
    tabBarBorder: "rgba(148,163,184,0.12)",
    tabIconDefault: "#64748B",
    tabIconSelected: PRIMARY,
    tint: PRIMARY,
    glow: "rgba(37,99,235,0.18)",
  },

  gradients: {
    primary: [PRIMARY, "#3B82F6"] as [string, string],
    primaryDeep: [PRIMARY, SECONDARY] as [string, string],
    success: [SUCCESS, "#16A34A"] as [string, string],
    danger: [DANGER, "#DC2626"] as [string, string],
    warning: [WARNING, "#D97706"] as [string, string],
    cardSoft: ["rgba(37,99,235,0.08)", "rgba(124,58,237,0.05)"] as [string, string],
    night: ["#1E293B", "#0F172A"] as [string, string],
  },
};

export default Colors;
