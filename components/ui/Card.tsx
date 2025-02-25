import { StyleSheet, View, ViewProps } from "react-native";
import { ThemedView, ThemedViewProps } from "../ThemedView";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

export type CardProps = ThemedViewProps & {
  variant?: "grouped" | "plain";
};

export function Card({
  style,
  variant = "plain",
  children,
  ...props
}: CardProps) {
  const colorScheme = useColorScheme() ?? "light";
  const backgroundColor =
    variant === "grouped"
      ? Colors[colorScheme].groupedBackground
      : Colors[colorScheme].secondaryBackground; // Changed to use secondaryBackground (white in light mode)

  return (
    <ThemedView style={[styles.card, { backgroundColor }, style]} {...props}>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    padding: 16,
  },
});
