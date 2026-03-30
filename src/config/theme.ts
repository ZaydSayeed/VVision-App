// Vela Vision Brand Design Tokens
// Source: VelaVision_BrandGuidelines.pdf

export const colors = {
  // Page & surfaces
  bg: "#F5F0E8",          // Soft sand — default page background
  surface: "#FAF8F4",     // Warm white — cards, modals
  darkSurface: "#2B2340", // Deep plum — dark cards / dark mode

  // Brand
  violet: "#6B5AE0",      // Primary — CTAs, logo, headings
  violetHover: "#4F40B8", // Hover state on violet
  lavender: "#A695F5",    // Accent — tags, labels, eyebrow text

  // Violet tint scale
  violet50: "#EEEBFB",
  violet100: "#D4CEFF",
  violet300: "#A695F5",
  violet500: "#6B5AE0",
  violet700: "#4F40B8",
  violet800: "#3D3560",
  violet900: "#2B2340",

  // Text
  text: "#2B2340",        // Deep plum — body text on light bg
  subtext: "#3D3560",     // Mid plum — subheadings, dark surfaces
  muted: "#8B7FA8",       // Muted violet — captions, meta

  // Borders & dividers
  border: "#E8E0D4",      // Sand mid
};

export const gradients = {
  primary: ["#6B5AE0", "#A695F5"] as const,  // Violet → lavender
  dark: ["#2B2340", "#3D3560"] as const,     // Deep plum
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
  // Body & UI — DM Sans
  regular: { fontFamily: "DMSans_400Regular" },
  medium: { fontFamily: "DMSans_500Medium" },
  // Display & Headlines — Cormorant Garamond
  display: { fontFamily: "CormorantGaramond_400Regular" },
  displayLight: { fontFamily: "CormorantGaramond_300Light" },
};
