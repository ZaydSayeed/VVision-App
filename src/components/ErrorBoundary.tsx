import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { captureError } from "../lib/observability";

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

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Single funnel for render crashes → the observability module (RPT-1).
    captureError(error, { source: "ErrorBoundary", componentStack: info.componentStack });
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
    backgroundColor: "#0F0D18",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: {
    fontSize: 22,
    color: "#FFFFFF",
    fontFamily: "DMSans_500Medium",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    fontFamily: "DMSans_400Regular",
    textAlign: "center",
    marginBottom: 32,
  },
  btn: {
    backgroundColor: "#7B5CE7",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "DMSans_500Medium",
  },
});
