import { useMemo } from "react";
import { StyleSheet, type TextProps } from "react-native";
import { UITextView as Text } from "react-native-uitextview";

import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  textAlign?: "auto" | "left" | "right" | "center" | "justify";
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
        return {};
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

  return (
    <Text
      style={[
        { color },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link" ? [styles.link, { color: linkColor }] : undefined,
        textAlign ? { textAlign } : undefined,
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
});
