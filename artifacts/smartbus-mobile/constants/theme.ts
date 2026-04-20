// SmartBus AI — Design tokens

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,
};

export const Type = {
  display: { fontSize: 34, fontFamily: "Inter_700Bold", letterSpacing: -0.8 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  heading: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: 16, fontFamily: "Inter_500Medium" },
  caption: { fontSize: 14, fontFamily: "Inter_500Medium" },
  micro: { fontSize: 11, fontFamily: "Inter_700Bold" },
};

// Minimum tappable size for accessibility (WCAG / Apple HIG: 44–48pt)
export const MinTouch = 48;

export const Shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  }),
  pressed: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
};
