export const colors = {
  bgPrimary: "#0a0e1a",
  bgCard: "rgba(22, 28, 45, 0.85)",
  bgCardHover: "rgba(30, 38, 60, 0.85)",
  bgGlass: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.06)",
  borderFocus: "rgba(99,102,241,0.5)",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  accentBlue: "#38bdf8",
  accentIndigo: "#818cf8",
  accentGreen: "#34d399",
  accentRed: "#f87171",
  accentAmber: "#fbbf24",
  accentPurple: "#c084fc",
};

export const gradients = {
  primary: ["#38bdf8", "#818cf8"] as const,
  secondary: ["#818cf8", "#c084fc"] as const,
  danger: ["#f87171", "#fb923c"] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
};

export const fonts = {
  regular: { fontWeight: "400" as const },
  medium: { fontWeight: "500" as const },
  semibold: { fontWeight: "600" as const },
  bold: { fontWeight: "700" as const },
};
