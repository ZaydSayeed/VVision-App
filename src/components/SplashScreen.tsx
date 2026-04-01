import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
} from "react-native";
import { colors } from "../config/theme";

const { width, height } = Dimensions.get("window");

interface SplashScreenProps {
  appReady: boolean;
  onDone: () => void;
}

export function SplashScreen({ appReady, onDone }: SplashScreenProps) {
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(0.4)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(16)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Entrance animations
  useEffect(() => {
    // Icon bounces in at 200ms
    Animated.sequence([
      Animated.delay(200),
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Pulse loop starts after icon lands
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.06, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1.0, duration: 600, useNativeDriver: true }),
          Animated.delay(600),
        ])
      ).start();
    });

    // Wordmark slides up + fades in at 500ms
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(wordmarkOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(wordmarkY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    // Tagline fades in at 900ms
    Animated.sequence([
      Animated.delay(900),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // Fade out when app is ready
  useEffect(() => {
    if (!appReady) return;
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => onDone());
  }, [appReady]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { opacity: splashOpacity }]}
    >
      {/* Icon with pulse */}
      <Animated.View style={{ transform: [{ scale: Animated.multiply(iconScale, pulseScale) }] }}>
        <View style={styles.iconWrap}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.icon}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* Wordmark */}
      <Animated.View
        style={{
          opacity: wordmarkOpacity,
          transform: [{ translateY: wordmarkY }],
          alignItems: "center",
          marginTop: 24,
        }}
      >
        <Text style={styles.wordmark}>Vela Vision</Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Faces remembered. Connections preserved.
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: colors.violet,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  icon: {
    width: 96,
    height: 96,
  },
  wordmark: {
    fontSize: 36,
    color: colors.text,
    fontFamily: "serif",
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "sans-serif",
    marginTop: 10,
    letterSpacing: 0.3,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
