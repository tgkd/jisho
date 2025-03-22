import { StyleSheet, Text } from "react-native";

import { HapticTab } from "../HapticTab";
import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText, ThemedTextProps } from "../ThemedText";

export function Pill({
  text,
  onPress,
  isActive = false,
  textProps = {
    type: "default",
    size: "sm",
  },
}: {
  onPress: () => void;
  text: string;
  isActive?: boolean;
  textProps?: ThemedTextProps;
}) {
  const backgroundColor = useThemeColor(
    {
      light: isActive
        ? Colors.light.accentLight
        : Colors.light.secondaryBackground,
      dark: isActive
        ? Colors.dark.accentLight
        : Colors.dark.secondaryBackground,
    },
    "secondaryBackground"
  );
  const borderColor = useThemeColor(
    {
      light: isActive
        ? Colors.light.accentLight
        : Colors.light.textSecondary,
      dark: isActive ? Colors.dark.accentLight : Colors.dark.textSecondary,
    },
    "accent"
  );

  return (
    <HapticTab
      onPress={onPress}
      style={[styles.pill, { backgroundColor, borderColor }]}
    >
      <ThemedText {...textProps}>{text}</ThemedText>
    </HapticTab>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 32,
    borderRadius: 18,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.textSecondary,
  },
});
