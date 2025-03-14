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
    text: {
      color: textColor,
      fontSize: 15, // reduced from 17
      lineHeight: 20, // reduced from 22
      fontFamily: Platform.OS === "ios" ? "-apple-system" : "System",
      fontWeight: "400",
    },
    // Headings with SF Pro Display-like styling
    h1: {
      fontSize: 28, // reduced from 34
      lineHeight: 34, // reduced from 41
      marginTop: 24, // reduced from 30
      marginBottom: 10, // reduced from 12
      fontWeight: "700",
      letterSpacing: 0.35, // slightly reduced
      color: textColor,
    },
    h2: {
      fontSize: 24, // reduced from 28
      lineHeight: 30, // reduced from 34
      marginTop: 20, // reduced from 24
      marginBottom: 8, // reduced from 10
      fontWeight: "700",
      letterSpacing: 0.33, // slightly reduced
      color: textColor,
    },
    h3: {
      fontSize: 20, // reduced from 22
      lineHeight: 25, // reduced from 28
      marginTop: 18, // reduced from 20
      marginBottom: 6, // reduced from 8
      fontWeight: "600",
      letterSpacing: 0.31, // slightly reduced
      color: textColor,
    },
    h4: {
      fontSize: 17, // reduced from 20
      lineHeight: 22, // reduced from 25
      marginTop: 14, // reduced from 16
      marginBottom: 6, // reduced from 8
      fontWeight: "600",
      letterSpacing: 0.28, // slightly reduced
      color: textColor,
    },
    h5: {
      fontSize: 15, // reduced from 17
      lineHeight: 20, // reduced from 22
      marginTop: 10, // reduced from 12
      marginBottom: 5, // reduced from 6
      fontWeight: "600",
      color: textColor,
    },
    h6: {
      fontSize: 14, // reduced from 15
      lineHeight: 18, // reduced from 20
      marginTop: 10, // reduced from 12
      marginBottom: 5, // reduced from 6
      fontWeight: "600",
      color: textColor,
    },
    // Paragraph spacing
    paragraph: {
      marginTop: 0,
      marginBottom: 10, // reduced from 12
    },
    // Lists
    list: {
      marginBottom: 10, // reduced from 12
    },
    // List items styling
    li: {
      marginBottom: 3, // reduced from 4
      flexDirection: "row",
    },
    bullet_list_icon: {
      fontSize: 15, // reduced from 17
      lineHeight: 20, // reduced from 22
      marginRight: 6, // reduced from 8
    },
    bullet_list_content: {
      flex: 1,
    },
    ordered_list_icon: {
      fontSize: 15, // reduced from 17
      lineHeight: 20, // reduced from 22
      marginRight: 6, // reduced from 8
      color: textSecondaryColor,
    },
    ordered_list_content: {
      flex: 1,
    },
    // Code blocks
    code: {
      backgroundColor: codeBackgroundColor,
      borderRadius: 5, // reduced from 6
      padding: 8, // reduced from 10
      marginVertical: 10, // reduced from 12
    },
    codespan: {
      backgroundColor: codeBackgroundColor,
      borderRadius: 3, // reduced from 4
      paddingHorizontal: 3, // reduced from 4
      paddingVertical: 1, // reduced from 2
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 13, // reduced from 15
    },
    // Blockquote
    blockquote: {
      borderLeftWidth: 3, // reduced from 4
      borderLeftColor: borderColor,
      paddingLeft: 10, // reduced from 12
      marginVertical: 10, // reduced from 12
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
      borderRadius: 5, // reduced from 6
      marginVertical: 10, // reduced from 12
      overflow: "hidden",
    },
    thead: {
      backgroundColor: codeBackgroundColor,
    },
    th: {
      padding: 6, // reduced from 8
      fontWeight: "600",
    },
    tableCell: {
      padding: 6, // reduced from 8
      borderTopWidth: 1,
      borderColor: borderColor,
    },
    tableRow: {
      flexDirection: "row",
    },
    // Horizontal rule
    hr: {
      backgroundColor: borderColor,
      height: 1,
      marginVertical: 14, // reduced from 16
    },
    // Text formatting
    strong: {
      fontWeight: "600",
    },
    em: {
      fontStyle: "italic",
    },
    strikethrough: {
      textDecorationLine: "line-through",
    },
    // Images
    image: {
      marginVertical: 10, // reduced from 12
      borderRadius: 5, // reduced from 6
    },
  } as StyleSheet.NamedStyles<any>;
}
