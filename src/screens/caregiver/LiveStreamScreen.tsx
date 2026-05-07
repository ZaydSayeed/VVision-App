import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";

interface Props {
  patientId: string;
  patientName: string;
  roomUrl: string;
  token: string;
  onEnd: () => void;
}

export function LiveStreamScreen({ patientName, onEnd }: Props) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: spacing.xl },
    name: { color: "#fff", fontSize: 20, ...fonts.medium },
    sub: { color: "rgba(255,255,255,0.5)", fontSize: 14, ...fonts.regular },
    endBtn: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: "#EF4444",
      alignItems: "center", justifyContent: "center",
      marginTop: spacing.xl,
    },
    label: { color: "rgba(255,255,255,0.6)", fontSize: 12, ...fonts.regular, marginTop: 8 },
  }), []);

  return (
    <View style={styles.root}>
      <Ionicons name="videocam-outline" size={48} color="rgba(255,255,255,0.3)" />
      <Text style={styles.name}>{patientName}</Text>
      <Text style={styles.sub}>Live stream coming soon</Text>
      <TouchableOpacity style={styles.endBtn} onPress={onEnd}>
        <Ionicons name="call" size={26} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.label}>End</Text>
    </View>
  );
}
