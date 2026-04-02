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
};

// Keep for backwards compatibility — overridden dynamically via ThemeContext
export const colors = lightColors;

export const gradients = {
  primary: ["#7B5CE7", "#A695F5"] as const,
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
  lg: 16,
  xl: 24,
  pill: 999,
};

export const fonts = {
  regular: { fontFamily: "DMSans_400Regular" },
  medium: { fontFamily: "DMSans_500Medium" },
  display: { fontFamily: "DMSans_500Medium" },
  displayLight: { fontFamily: "DMSans_400Regular" },
};

export type AppColors = typeof lightColors;
