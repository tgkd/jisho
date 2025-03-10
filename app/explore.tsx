import * as Clipboard from "expo-clipboard";
import { Stack } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SearchBarCommands } from "react-native-screens";
import { isJapanese } from "wanakana";

import { ThemedText } from "@/components/ThemedText";
import { getAiExplanation } from "@/services/request";
import { useTextStream } from "@/hooks/useFetch";
import { Loader } from "@/components/Loader";
import { Card } from "@/components/ui/Card";

export default function ExploreScreen() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState("");
  const searchBarRef = useRef<SearchBarCommands>(null);

  const str = useTextStream(getAiExplanation(), (chunk) => {
    setResults((t) => t + chunk);
  });

  const handleSearch = async () => {
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
        searchBarRef.current?.setText(text);
        handleChange(text);
      }
    } catch (error) {
      console.error("Error accessing clipboard:", error);
    }
  };

  const onFocus = () => {
    checkClipboardContent();
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerLargeTitle: true,
          headerSearchBarOptions: {
            placeholder: "ama",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            autoCapitalize: "none",
            ref: searchBarRef,
            shouldShowHintSearchIcon: true,
            onFocus,
            onSearchButtonPress: handleSearch,
          },
        }}
      />
      <ScrollView
        style={styles.scrollContainer}
        contentInsetAdjustmentBehavior="automatic"
      >
        {str.isLoading ? (
          <View style={styles.loader}>
            <Loader />
          </View>
        ) : null}
        <Card>
          {!results.length && !str.isLoading ? (
            <ThemedText>{"Ask me anything!"}</ThemedText>
          ) : null}
          <ThemedText>{results}</ThemedText>
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  loader: {
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
});
