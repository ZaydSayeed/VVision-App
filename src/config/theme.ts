// Vela Vision Brand Design Tokens

export const lightColors = {
  bg: "#FFFFFF",
  surface: "#F7F5FF",
  darkSurface: "#2B2340",
  violet: "#7B5CE7",
  violetHover: "#5A40D0",
  lavender: "#A695F5",
  violet50: "#F0EEFF",
  violet100: "#D8D0FF",
  violet300: "#A695F5",
  violet500: "#7B5CE7",
  violet700: "#5A40D0",
  violet800: "#3D3560",
  violet900: "#2B2340",
  text: "#1E1B3A",
  subtext: "#3D3560",
  muted: "#9590B0",
  border: "#E8E4F5",
  // Patient-facing warm palette
  warm: "#FDF8F3",
  warmSurface: "#F5EFE6",
  sage: "#5C8E7A",
  sageSoft: "#EAF4EF",
  amber: "#E8934A",
  amberSoft: "#FEF3E8",
  coral: "#D95F5F",
  coralSoft: "#FDEAEA",
};

export const darkColors = {
  bg: "#0F0D18",
  surface: "#1A1630",
  darkSurface: "#0F0D18",
  violet: "#9B8BFF",
  violetHover: "#8B7BEF",
  lavender: "#C4B8FF",
  violet50: "#2A2448",
  violet100: "#3D3560",
  violet300: "#C4B8FF",
  violet500: "#9B8BFF",
  violet700: "#8B7BEF",
  violet800: "#6B5AE0",
  violet900: "#4F40B8",
  text: "#F5F0E8",
  subtext: "#D4CCEE",
  muted: "#9B90B8",
  border: "#2E2A4A",
  // Patient-facing warm palette (muted for dark mode)
  warm: "#13111F",
  warmSurface: "#1E1B30",
  sage: "#4A7A67",
  sageSoft: "#1A2E28",
  amber: "#C47A3A",
  amberSoft: "#2A1F10",
  coral: "#B84A4A",
  coralSoft: "#2A1414",
};

// Keep for backwards compatibility — overridden dynamically via ThemeContext
export const colors = lightColors;

export const gradients = {
  primary: ["#7B5CE7", "#A695F5"] as const,
  dark: ["#2B2340", "#3D3560"] as const,
  coral: ["#D95F5F", "#E87878"] as const,
  sage: ["#5C8E7A", "#7AB5A0"] as const,
  amber: ["#E8934A", "#F0AD72"] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 32,
  pill: 999,
};

export const fonts = {
  regular: { fontFamily: "DMSans_400Regular" },
  medium: { fontFamily: "DMSans_500Medium" },
  display: { fontFamily: "DMSans_500Medium" },
  displayLight: { fontFamily: "DMSans_400Regular" },
};

export const typography = {
  // Size tokens
  hero: 34,
  title: 22,
  subtitle: 18,
  body: 15,
  small: 13,
  caption: 11,
  // Full style objects — use these for consistent text rendering
  heroStyle: { fontSize: 34, lineHeight: 40 },
  titleStyle: { fontSize: 22, lineHeight: 28 },
  subtitleStyle: { fontSize: 18, lineHeight: 24 },
  bodyStyle: { fontSize: 15, lineHeight: 22 },
  smallStyle: { fontSize: 13, lineHeight: 18 },
  captionStyle: { fontSize: 11, lineHeight: 16, letterSpacing: 0.3 },
  labelStyle: { fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" as const },
};

export const shadow = {
  // Subtle — list items, inline cards
  sm: {
    shadowColor: "#7B5CE7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  // Standard — main content cards
  md: {
    shadowColor: "#7B5CE7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  // Prominent — floating elements, modals
  lg: {
    shadowColor: "#7B5CE7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 6,
  },
  // FAB / primary action buttons — keep contrasty
  fab: {
    shadowColor: "#7B5CE7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  // Legacy alias
  card: {
    shadowColor: "#7B5CE7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
};

export type AppColors = typeof lightColors;
