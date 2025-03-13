import { PropsWithChildren, useState } from "react";
import {
  LayoutAnimation,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useThemeColor } from "@/hooks/useThemeColor";

export function Collapsible({
  children,
  title,
  rightButton = null,
}: PropsWithChildren & { title: string; rightButton?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useColorScheme() ?? "light";
  const bg = useThemeColor({}, "secondaryBackground");

  const onPress = () => {
    setIsOpen((value) => !value);
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.heading, { backgroundColor: bg }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.headName}>
          <IconSymbol
            name="chevron.right"
            size={16}
            weight="medium"
            color={theme === "light" ? Colors.light.icon : Colors.dark.icon}
            style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
          />

          <ThemedText size="sm">{title}</ThemedText>
        </View>
        {rightButton}
      </TouchableOpacity>
      {isOpen && (
        <ThemedView style={[styles.content, { backgroundColor: bg }]}>
          {children}
        </ThemedView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
  },
  headName: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  content: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
  },
});
