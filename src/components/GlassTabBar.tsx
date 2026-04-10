import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

const SIZE = 50;

interface Props {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
}

export function GlassTabIcon({ name, focused, color }: Props) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [focused]);

  return (
    <View style={styles.wrap}>
      {focused && (
        <View
          style={[
            styles.ring,
            {
              backgroundColor: colors.violet + "22",
              borderColor: colors.violet,
            },
          ]}
        />
      )}
      <Ionicons name={name} size={20} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
  },
});
