import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

interface FloatingHeartProps {
  delay: number;
  startX: number;
  color: string;
  size: number;
}

function FloatingHeart({ delay, startX, color, size }: FloatingHeartProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -120,
            duration: 6000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.35,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.delay(2800),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, translateY, opacity]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: startX,
        bottom: 0,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Ionicons name="heart" size={size} color={color} />
    </Animated.View>
  );
}

export function AmbientHearts() {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.host}
    >
      <FloatingHeart delay={0} startX={12} color={colors.coral} size={14} />
      <FloatingHeart delay={2000} startX={28} color={colors.violet300} size={11} />
      <FloatingHeart delay={4000} startX={6} color={colors.coral} size={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 4,
    bottom: 110,
    width: 48,
    height: 160,
    zIndex: 1,
  },
});
