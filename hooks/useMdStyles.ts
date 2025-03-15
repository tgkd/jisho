import { Platform, StyleSheet } from "react-native";
import { useThemeColor } from "./useThemeColor";

export function useMdStyles() {
  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const linkColor = useThemeColor({}, "link");
  const codeBackgroundColor = useThemeColor({}, "secondaryBackground");
  const borderColor = useThemeColor({}, "separator");

  return {
    // Core text styles
    body: {
      color: textColor,
      fontSize: 15,
      lineHeight: 20,
      fontFamily: Platform.OS === "ios" ? "-apple-system" : "System",
      fontWeight: "400",
    },
    // Headings with SF Pro Display-like styling
    heading1: {
      fontSize: 28,
      lineHeight: 34,
      marginTop: 24,
      marginBottom: 10,
      fontWeight: "700",
      letterSpacing: 0.37,
      color: textColor,
    },
    heading2: {
      fontSize: 24,
      lineHeight: 30,
      marginTop: 20,
      marginBottom: 8,
      fontWeight: "700",
      letterSpacing: 0.35,
      color: textColor,
    },
    heading3: {
      fontSize: 20,
      lineHeight: 24,
      marginTop: 16,
      marginBottom: 6,
      fontWeight: "600",
      letterSpacing: 0.33,
      color: textColor,
    },
    heading4: {
      fontSize: 18,
      lineHeight: 22,
      marginTop: 14,
      marginBottom: 6,
      fontWeight: "600",
      letterSpacing: 0.3,
      color: textColor,
    },
    heading5: {
      fontSize: 16,
      lineHeight: 20,
      marginTop: 10,
      marginBottom: 5,
      fontWeight: "600",
      color: textColor,
    },
    heading6: {
      fontSize: 14,
      lineHeight: 18,
      marginTop: 10,
      marginBottom: 5,
      fontWeight: "600",
      color: textColor,
    },
    // Paragraph spacing
    paragraph: {
      marginTop: 0,
      marginBottom: 10,
    },
    // Lists
    bullet_list: {
      marginBottom: 10,
    },
    ordered_list: {
      marginBottom: 10,
    },
    // List items styling
    list_item: {
      marginBottom: 3,
      flexDirection: "row",
    },
    bullet_list_icon: {
      fontSize: 15,
      lineHeight: 20,
      marginRight: 6,
    },
    bullet_list_content: {
      flex: 1,
    },
    ordered_list_icon: {
      fontSize: 15,
      lineHeight: 20,
      marginRight: 6,
      color: textSecondaryColor,
    },
    ordered_list_content: {
      flex: 1,
    },
    // Code blocks
    fence: {
      backgroundColor: codeBackgroundColor,
      borderRadius: 5,
      padding: 8,
      marginVertical: 10,
    },
    code_inline: {
      backgroundColor: codeBackgroundColor,
      borderRadius: 3,
      paddingHorizontal: 3,
      paddingVertical: 1,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 13,
    },
    code_block: {
      backgroundColor: codeBackgroundColor,
      borderRadius: 5,
      padding: 8,
      marginVertical: 10,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 13,
    },
    // Blockquote
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: borderColor,
      paddingLeft: 10,
      marginVertical: 10,
      fontStyle: "italic",
    },
    // Links
    link: {
      color: linkColor,
      textDecorationLine: "none",
    },
    // Tables
    table: {
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 5,
      marginVertical: 10,
      overflow: "hidden",
    },
    thead: {
      backgroundColor: codeBackgroundColor,
    },
    th: {
      padding: 6,
      fontWeight: "600",
    },
    td: {
      padding: 6,
      borderTopWidth: 1,
      borderColor: borderColor,
    },
    tr: {
      flexDirection: "row",
    },
    // Horizontal rule
    hr: {
      backgroundColor: borderColor,
      height: 1,
      marginVertical: 14,
    },
    // Text formatting
    strong: {
      fontWeight: "600",
    },
    em: {
      fontStyle: "italic",
    },
    s: {
      textDecorationLine: "line-through",
    },
    // Images
    image: {
      marginVertical: 10,
      borderRadius: 5,
    },
  } as StyleSheet.NamedStyles<any>;
}
