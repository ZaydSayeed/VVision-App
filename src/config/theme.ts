// Vela Vision Brand Design Tokens

export const lightColors = {
  bg: "#F5F0E8",
  surface: "#FAF8F4",
  darkSurface: "#2B2340",
  violet: "#6B5AE0",
  violetHover: "#4F40B8",
  lavender: "#A695F5",
  violet50: "#EEEBFB",
  violet100: "#D4CEFF",
  violet300: "#A695F5",
  violet500: "#6B5AE0",
  violet700: "#4F40B8",
  violet800: "#3D3560",
  violet900: "#2B2340",
  text: "#2B2340",
  subtext: "#3D3560",
  muted: "#8B7FA8",
  border: "#E8E0D4",
};

export const darkColors = {
  bg: "#1C1825",
  surface: "#241E33",
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
  border: "#3D3560",
};

// Keep for backwards compatibility — overridden dynamically via ThemeContext
export const colors = lightColors;

export const gradients = {
  primary: ["#6B5AE0", "#A695F5"] as const,
  dark: ["#2B2340", "#3D3560"] as const,
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
  sm: 8,
  md: 12,
  pill: 999,
};

export const fonts = {
  regular: { fontFamily: "DMSans_400Regular" },
  medium: { fontFamily: "DMSans_500Medium" },
  display: { fontFamily: "CormorantGaramond_400Regular" },
  displayLight: { fontFamily: "CormorantGaramond_300Light" },
};

export type AppColors = typeof lightColors;
