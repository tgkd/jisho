import * as Clipboard from "expo-clipboard";
import { Stack } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SearchBarCommands } from "react-native-screens";
import { isJapanese } from "wanakana";

import { ThemedText } from "@/components/ThemedText";
import { getAiExplanation } from "@/services/request";
import { useTextStream } from "@/hooks/useFetch";
import { Card } from "@/components/ui/Card";
import Markdown from "react-native-markdown-display";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";

export default function ExploreScreen() {
  const iconC = useThemeColor({}, "tint");
  const inputC = useThemeColor({}, "text");
  const inputBg = useThemeColor({}, "secondaryBackground");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState("");
  const searchBarRef = useRef<TextInput>(null);

  const str = useTextStream(getAiExplanation(), (chunk) => {
    setResults((t) => t + chunk);
  });

  const handleSearch = async () => {
    searchBarRef.current?.blur();
    const text = search.trim();

    if (text.length === 0) {
      setResults("");
      return;
    }

    try {
      await str.fetchData(search);
    } catch (error) {
      console.error("Search failed:", error);
      setResults("");
    }
  };

  const handleChange = (text: string) => {
    setSearch(text);
  };

  const checkClipboardContent = async () => {
    try {
      if (!Clipboard.isPasteButtonAvailable) {
        return;
      }
      const text = await Clipboard.getStringAsync();

      if (text && isJapanese(text)) {
        searchBarRef.current?.setNativeProps({
          text,
        });
        handleChange(text);
      }
    } catch (error) {
      console.error("Error accessing clipboard:", error);
    }
  };

  const onFocus = () => {
    checkClipboardContent();
  };

  const disabled = !search.trim().length;
  const loading = str.isLoading;

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        contentInsetAdjustmentBehavior="automatic"
      >
        <TextInput
          ref={searchBarRef}
          style={[styles.textArea, { backgroundColor: inputBg, color: inputC }]}
          placeholder="Search"
          value={search}
          onChangeText={handleChange}
          onFocus={onFocus}
          multiline
          clearButtonMode="while-editing"
          numberOfLines={4}
        />
        {results.length ? (
          <Card>
            <Markdown
              style={{
                body: { color: inputC },
              }}
            >
              {results}
            </Markdown>
          </Card>
        ) : (
          <ThemedText type="secondary" textAlign="center">
            {"Ask a question or paste some text to get started"}
          </ThemedText>
        )}
      </ScrollView>
      <KeyboardAvoidingView
        style={styles.footer}
        behavior="position"
        keyboardVerticalOffset={80}
      >
        {disabled ? null : (
          <HapticTab onPress={handleSearch} disabled={loading}>
            <IconSymbol
              color={loading ? Colors.light.disabled : iconC}
              name="arrow.up.circle.fill"
              size={52}
            />
          </HapticTab>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingTop: 24,
    paddingBottom: 48,
    paddingHorizontal: 16,
  },
  textArea: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
    fontSize: 16,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
});
