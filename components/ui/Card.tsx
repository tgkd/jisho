import { StyleSheet, View, ViewProps } from "react-native";
import { ThemedView, ThemedViewProps } from "../ThemedView";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

export type CardProps = ThemedViewProps & {
  variant?: "grouped" | "plain";
  p?: number;
};

export function Card({
  style,
  variant = "plain",
  children,
  p = 16,
  ...props
}: CardProps) {
  const colorScheme = useColorScheme() ?? "light";
  const backgroundColor =
    variant === "grouped"
      ? Colors[colorScheme].groupedBackground
      : Colors[colorScheme].secondaryBackground;

  return (
    <ThemedView
      style={[styles.card, { backgroundColor, padding: p }, style]}
      {...props}
    >
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
  },
});
