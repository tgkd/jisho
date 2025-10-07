import { Colors } from "@/constants/Colors";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "./ThemedText";

interface PremiumBadgeProps {
  size?: "sm" | "md";
}

export function PremiumBadge({ size = "sm" }: PremiumBadgeProps) {
  return (
    <View style={[styles.badge, size === "md" ? styles.badgeMd : styles.badgeSm]}>
      <ThemedText style={[styles.text, size === "md" ? styles.textMd : styles.textSm]}>
        PRO
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.light.tint,
  },
  badgeSm: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeMd: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  textSm: {
    fontSize: 10,
  },
  textMd: {
    fontSize: 12,
  },
});
