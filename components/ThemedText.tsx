import { useMemo } from "react";
import { StyleSheet, type TextProps } from "react-native";
import { UITextView as Text } from "react-native-uitextview";

import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  textAlign?: "auto" | "left" | "right" | "center" | "justify";
  size?: "lg" | "md" | "sm" | "xs";
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
  lightColor,
  darkColor,
  type = "default",
  selectable = true,
  textAlign,
  size,
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
        return {
          dark: darkColor || Colors.dark.text,
          light: lightColor || Colors.light.text,
        };
    }
  }, [type]);

  const color = useThemeColor(colorType, "text");
  const linkColor = useThemeColor(colorType, "link");
  const selectionHighlightColor = useThemeColor(
    {
      light: "rgba(0, 122, 255, 0.3)", // iOS blue with opacity
      dark: "rgba(64, 156, 255, 0.3)", // Lighter blue for dark mode
    },
    "text"
  );

  const sizeStyle = useMemo(() => {
    switch (size) {
      case "md":
        return styles.md;
      case "sm":
        return styles.sm;
      case "xs":
        return styles.xs;
      default:
        return styles.default;
    }
  }, [size]);

  return (
    <Text
      uiTextView
      style={[
        { color },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link" ? [styles.link, { color: linkColor }] : undefined,
        textAlign ? { textAlign } : undefined,
        size ? sizeStyle : undefined,
        style,
      ]}
      selectable={selectable}
      selectionColor={selectionHighlightColor}
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
  },
  md: {
    fontSize: 15,
    lineHeight: 20,
  },
  sm: {
    fontSize: 13,
    lineHeight: 18,
  },
  xs: {
    fontSize: 11,
    lineHeight: 16,
  },
});
