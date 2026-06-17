import React, { useMemo } from "react";
import { View, Text, Modal, Pressable, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";

interface AddChooserSheetProps {
  visible: boolean;
  onClose: () => void;
  onChooseTask: () => void;
  onChooseMed: () => void;
}

/** Bottom sheet asking the patient whether to add a routine task or a medication. */
export function AddChooserSheet({ visible, onClose, onChooseTask, onChooseMed }: AddChooserSheetProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    chooserOverlay: { flex: 1, backgroundColor: "rgba(30,27,58,0.45)", justifyContent: "flex-end" },
    chooserSheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
      padding: spacing.xxl, gap: spacing.md,
    },
    chooserHandle: {
      width: 40, height: 4, borderRadius: radius.pill,
      backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg,
    },
    chooserTitle: { fontSize: 20, color: colors.text, ...fonts.medium, marginBottom: spacing.sm },
    chooserBtn: {
      flexDirection: "row", alignItems: "center", gap: spacing.lg,
      backgroundColor: colors.surface, borderRadius: radius.lg,
      paddingVertical: spacing.lg, paddingHorizontal: spacing.lg,
    },
    chooserBtnIcon: {
      width: 48, height: 48, borderRadius: 24,
      alignItems: "center", justifyContent: "center",
    },
    chooserBtnLabel: { fontSize: 18, color: colors.text, ...fonts.medium },
    chooserBtnSub: { fontSize: 14, color: colors.muted, ...fonts.regular },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.chooserOverlay} onPress={onClose}>
        <Pressable style={styles.chooserSheet} onPress={() => {}}>
          <View style={styles.chooserHandle} />
          <Text style={styles.chooserTitle}>What would you like to add?</Text>
          <TouchableOpacity
            style={styles.chooserBtn}
            onPress={onChooseTask}
            activeOpacity={0.85}
          >
            <View style={[styles.chooserBtnIcon, { backgroundColor: colors.sageSoft }]}>
              <Ionicons name="calendar-clear" size={22} color={colors.sage} />
            </View>
            <View>
              <Text style={styles.chooserBtnLabel}>A routine task</Text>
              <Text style={styles.chooserBtnSub}>Something you do every day</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chooserBtn}
            onPress={onChooseMed}
            activeOpacity={0.85}
          >
            <View style={[styles.chooserBtnIcon, { backgroundColor: colors.amberSoft }]}>
              <Ionicons name="medkit" size={22} color={colors.amber} />
            </View>
            <View>
              <Text style={styles.chooserBtnLabel}>A medication</Text>
              <Text style={styles.chooserBtnSub}>Track your daily medicines</Text>
            </View>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
