import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface State {
  hasError: boolean;
  message: string;
}

export class NativeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message:
        error instanceof Error
          ? error.message
          : "An unexpected client error occurred.",
    };
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.root}>
        <Text style={styles.eyebrow}>ASTERIAL RECOVERY</Text>
        <Text style={styles.title}>Something interrupted this view</Text>
        <Text style={styles.body}>{this.state.message}</Text>
        <Pressable
          onPress={() => this.setState({ hasError: false, message: "" })}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Reload View</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#09090B",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  eyebrow: {
    color: "#71717A",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 8,
    color: "#FAFAFA",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    marginTop: 10,
    color: "#A1A1AA",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  btn: {
    marginTop: 20,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  btnText: {
    color: "#09090B",
    fontSize: 13.5,
    fontWeight: "800",
  },
});
