import { PropsWithChildren, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

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
  const opened = useSharedValue(0);
  const theme = useColorScheme() ?? "light";
  const bg = useThemeColor({}, "secondaryBackground");

  const onPress = () => {
    opened.value = withTiming(opened.value === 0 ? 1 : 0);
  };

  const contentStyle = useAnimatedStyle(() => {
    return {
      height: opened.value ? "auto" : 0,
      opacity: opened.value,
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${opened.value * 90}deg` }],
    };
  });

  return (
    <View>
      <TouchableOpacity
        style={[styles.heading, { backgroundColor: bg }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.headName}>
          <Animated.View style={iconStyle}>
            <IconSymbol
              name="chevron.right"
              size={16}
              weight="medium"
              color={theme === "light" ? Colors.light.icon : Colors.dark.icon}
            />
          </Animated.View>

          <ThemedText size="sm">{title}</ThemedText>
        </View>
        {rightButton}
      </TouchableOpacity>
      <Animated.View style={contentStyle}>
        <ThemedView style={[styles.content, { backgroundColor: bg }]}>
          {children}
        </ThemedView>
      </Animated.View>
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
