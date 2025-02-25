import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { ThemedText } from "../ThemedText";
import { Colors } from "../../constants/Colors";

interface SegmentedControlProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  style?: object;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const colorScheme = useColorScheme() || "light";
  const isDark = colorScheme === "dark";

  const backgroundColor = isDark
    ? Colors.dark.secondaryBackground
    : Colors.light.secondaryBackground;

  const unselectedTextColor = isDark
    ? Colors.dark.textSecondary
    : Colors.light.textSecondary;

  const selectedBgColor = isDark ? Colors.dark.accent : Colors.light.accent;

  return (
    <View style={[styles.segmentedControl, { backgroundColor }, style]}>
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.segmentedControlOption,
              isSelected && { backgroundColor: selectedBgColor },
            ]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
          >
            <ThemedText
              style={[
                styles.segmentedControlText,
                {
                  color: isSelected ? "#fff" : unselectedTextColor,
                },
              ]}
            >
              {option.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentedControl: {
    flexDirection: "row",
    borderRadius: 8,
    overflow: "hidden",
    padding: 2,
  },
  segmentedControlOption: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  segmentedControlText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
