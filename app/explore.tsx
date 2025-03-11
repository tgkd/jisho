import { memo, useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useTextStream } from "@/hooks/useFetch";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getAiExplanation } from "@/services/request";

const ICON_SIZE = 36;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const markdownStyles = useMdStyles();
  const [results, setResults] = useState("");
  const stream = useTextStream(getAiExplanation(), (chunk) => {
    setResults((t) => t + chunk);
  });

  const handleSubmit = useCallback(
    async (query: string) => {
      const text = query.trim();

      if (text.length === 0) {
        setResults("");
        return;
      }

      try {
        await stream.fetchData(query);
      } catch (error) {
        console.error("Search failed:", error);
        setResults("");
      }
    },
    [stream]
  );

  return (
    <ThemedView
      lightColor={Colors.light.secondaryBackground}
      darkColor={Colors.dark.background}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {results.length ? (
          <Markdown style={markdownStyles}>{results}</Markdown>
        ) : (
          <ThemedText type="secondary" textAlign="center">
            {"Ask a question or paste some text to get started"}
          </ThemedText>
        )}
      </ScrollView>

      <FooterView handleSubmit={handleSubmit} loading={stream.isLoading} />
    </ThemedView>
  );
}

const FooterView = memo(
  ({
    handleSubmit,
    loading,
  }: {
    handleSubmit: (value: string) => Promise<void>;
    loading: boolean;
  }) => {
    const insets = useSafeAreaInsets();
    const iconC = useThemeColor({}, "tint");
    const inputC = useThemeColor({}, "text");
    const inputBg = useThemeColor({}, "background");
    const inputRef = useRef<TextInput>(null);
    const [value, setValue] = useState("");

    const handlePress = () => {
      handleSubmit(value);
      inputRef.current?.blur();
    };

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={88}
      >
        <ThemedView
          style={styles.footer}
          lightColor={Colors.light.secondaryBackground}
          darkColor={Colors.dark.secondaryBackground}
        >
          <View style={styles.footerContainer}>
            <TextInput
              onChangeText={setValue}
              ref={inputRef}
              value={value}
              style={[
                styles.textArea,
                { color: inputC, backgroundColor: inputBg },
              ]}
              placeholder="Ask something..."
              multiline
              numberOfLines={4}
            />
            <View style={styles.buttons}>
              <HapticTab onPress={handlePress} disabled={loading}>
                <IconSymbol
                  color={loading ? Colors.light.disabled : iconC}
                  name="arrow.up.circle.fill"
                  size={ICON_SIZE}
                />
              </HapticTab>
            </View>
          </View>
        </ThemedView>
      </KeyboardAvoidingView>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingTop: 24,
    paddingBottom: 96,
    paddingHorizontal: 16,
  },
  textArea: {
    flexGrow: 1,
    padding: 10,
    borderRadius: 12,
    fontSize: 16,
    maxHeight: 200,
  },
  footer: {
    paddingBottom: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  footerContainer: {
    flexDirection: "column",
    alignItems: "stretch",
    padding: 12,
    gap: 8,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
});

function useMdStyles() {
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
