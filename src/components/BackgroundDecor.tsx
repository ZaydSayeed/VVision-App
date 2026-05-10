import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";

// Soft pastel blobs that drift behind UI content for visual warmth.
// pointerEvents=none lets all interactions pass through.
export function BackgroundDecor() {
  const { colors, isDark } = useTheme();
  if (isDark) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.host}
    >
      <View style={[styles.blob, styles.blobTopRight, { backgroundColor: colors.violet300 }]} />
      <View style={[styles.blob, styles.blobMidLeft, { backgroundColor: colors.coral }]} />
      <View style={[styles.blob, styles.blobBottomRight, { backgroundColor: colors.amber }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 0,
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.06,
  },
  blobTopRight: {
    width: 320,
    height: 320,
    top: -140,
    right: -120,
  },
  blobMidLeft: {
    width: 280,
    height: 280,
    top: "42%",
    left: -150,
    opacity: 0.05,
  },
  blobBottomRight: {
    width: 240,
    height: 240,
    bottom: 60,
    right: -100,
    opacity: 0.05,
  },
});
