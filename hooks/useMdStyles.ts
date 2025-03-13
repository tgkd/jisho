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
      fontSize: 17,
      lineHeight: 22,
      fontFamily: Platform.OS === "ios" ? "-apple-system" : "System",
      fontWeight: "400",
    },
    // Headings with SF Pro Display-like styling
    heading1: {
      fontSize: 34,
      lineHeight: 41,
      marginTop: 30,
      marginBottom: 12,
      fontWeight: "700",
      letterSpacing: 0.37,
      color: textColor,
    },
    heading2: {
      fontSize: 28,
      lineHeight: 34,
      marginTop: 24,
      marginBottom: 10,
      fontWeight: "700",
      letterSpacing: 0.35,
      color: textColor,
    },
    heading3: {
      fontSize: 22,
      lineHeight: 28,
      marginTop: 20,
      marginBottom: 8,
      fontWeight: "600",
      letterSpacing: 0.33,
      color: textColor,
    },
    heading4: {
      fontSize: 20,
      lineHeight: 25,
      marginTop: 16,
      marginBottom: 8,
      fontWeight: "600",
      letterSpacing: 0.3,
      color: textColor,
    },
    heading5: {
      fontSize: 17,
      lineHeight: 22,
      marginTop: 12,
      marginBottom: 6,
      fontWeight: "600",
      color: textColor,
    },
    heading6: {
      fontSize: 15,
      lineHeight: 20,
      marginTop: 12,
      marginBottom: 6,
      fontWeight: "600",
      color: textColor,
    },
    // Paragraph spacing
    paragraph: {
      marginTop: 0,
      marginBottom: 12,
    },
    // Lists
    bullet_list: {
      marginBottom: 12,
    },
    ordered_list: {
      marginBottom: 12,
    },
    // List items styling
    list_item: {
      marginBottom: 4,
      flexDirection: "row",
    },
    bullet_list_icon: {
      fontSize: 17,
      lineHeight: 22,
      marginRight: 8,
    },
    bullet_list_content: {
      flex: 1,
    },
    ordered_list_icon: {
      fontSize: 17,
      lineHeight: 22,
      marginRight: 8,
      color: textSecondaryColor,
    },
    ordered_list_content: {
      flex: 1,
    },
    // Code blocks
    fence: {
      backgroundColor: codeBackgroundColor,
      borderRadius: 6,
      padding: 10,
      marginVertical: 12,
    },
    code_inline: {
      backgroundColor: codeBackgroundColor,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 15,
    },
    code_block: {
      backgroundColor: codeBackgroundColor,
      borderRadius: 6,
      padding: 10,
      marginVertical: 12,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 15,
    },
    // Blockquote
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: borderColor,
      paddingLeft: 12,
      marginVertical: 12,
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
      borderRadius: 6,
      marginVertical: 12,
      overflow: "hidden",
    },
    thead: {
      backgroundColor: codeBackgroundColor,
    },
    th: {
      padding: 8,
      fontWeight: "600",
    },
    td: {
      padding: 8,
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
      marginVertical: 16,
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
      marginVertical: 12,
      borderRadius: 6,
    },
  } as StyleSheet.NamedStyles<any>;
}
