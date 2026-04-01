import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts, spacing } from "../config/theme";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error}</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, error: "" })}
          >
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  emoji: { fontSize: 48, marginBottom: spacing.lg },
  title: {
    fontSize: 22,
    color: colors.text,
    ...fonts.medium,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 14,
    color: colors.muted,
    ...fonts.regular,
    textAlign: "center",
    marginBottom: spacing.xxl,
  },
  btn: {
    backgroundColor: colors.violet,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: {
    color: "#FAF8F4",
    fontSize: 16,
    ...fonts.medium,
  },
});
