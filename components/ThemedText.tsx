import { Text, type TextProps, StyleSheet } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import { Colors } from "@/constants/Colors";
import { useMemo } from "react";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | "default"
    | "title"
    | "defaultSemiBold"
    | "subtitle"
    | "link"
    | "secondary";
};

export function ThemedText({
  style,
  lightColor = Colors.light.text,
  darkColor = Colors.dark.text,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const colorType = useMemo(() => {
    switch (type) {
      case "secondary":
        return {
          dark: Colors.dark.secondaryText,
          light: Colors.light.secondaryText,
        };

      default:
        return { dark: darkColor, light: lightColor };
    }
  }, [type, lightColor, darkColor]);

  const color = useThemeColor(colorType, "text");

  return (
    <Text
      style={[
        { color },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link" ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 17,
    lineHeight: 22,
  },
  defaultSemiBold: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 41,
    letterSpacing: 0.41,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
    letterSpacing: 0.35,
  },
  link: {
    fontSize: 17,
    lineHeight: 22,
    color: "#0a7ea4",
  },
});
