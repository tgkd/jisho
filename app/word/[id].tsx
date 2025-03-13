import { Stack, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { HighlightText } from "@/components/HighlightText";
import { Loader } from "@/components/Loader";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
  addBookmark,
  addExamplesList,
  addToHistory,
  DictionaryEntry,
  ExampleSentence,
  getDictionaryEntry,
  isBookmarked,
  removeBookmark,
  WordMeaning,
} from "@/services/database";
import { deduplicateEn, formatEn, formatJp } from "@/services/parse";
import { AiExample, getAiExamples, craeteWordPrompt } from "@/services/request";
import { useFetch } from "@/hooks/useFetch";

export default function WordDetailScreen() {
  const tintColor = useThemeColor({}, "tint");
  const markColor = useThemeColor({}, "text");
  const params = useLocalSearchParams();
  const title = typeof params.title === "string" ? params.title : "Details";
  const [entry, setEntry] = useState<{
    word: DictionaryEntry;
    meanings: WordMeaning[];
    examples: ExampleSentence[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const db = useSQLiteContext();

  const details = useMemo(
    () =>
      entry?.meanings
        ? deduplicateEn(entry.meanings.map((m) => formatEn(m.meaning, "none")))
        : [],
    [entry]
  );

  const initEntry = async () => {
    try {
      const result = await getDictionaryEntry(db, Number(params.id), true);

      if (result) {
        setEntry(result);
        const bookmarkStatus = await isBookmarked(db, result.word.id);
        setBookmarked(bookmarkStatus);
        await addToHistory(db, result.word);
      }
    } catch (error) {
      console.error("Failed to load dictionary entry:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initEntry();
  }, []);

  const handleToggleBookmark = async () => {
    if (!entry) {
      return;
    }

    try {
      if (bookmarked) {
        await removeBookmark(db, entry.word.id);
      } else {
        await addBookmark(db, entry.word.id);
      }
      setBookmarked((prev) => !prev);
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen
          options={{
            headerBackTitle: "Search",
            title,
          }}
        />
        <View style={styles.loadingContainer}>
          <Loader />
        </View>
      </ThemedView>
    );
  }

  if (!entry) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen
          options={{
            headerBackTitle: "Back",
            title,
          }}
        />
        <View style={styles.errorContainer}>
          <ThemedText>{"Word not found"}</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerBackTitle: "Search",
          title,
          headerRight: () => (
            <HapticTab onPress={handleToggleBookmark}>
              <IconSymbol
                name={bookmarked ? "bookmark.circle.fill" : "bookmark.circle"}
                size={32}
                color={tintColor}
              />
            </HapticTab>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={styles.headerSection}>
          <ThemedText type="title" style={styles.word}>
            {entry.word.word}
          </ThemedText>
          <ThemedText type="secondary">
            {formatJp(entry.word.reading, true)}
          </ThemedText>
        </ThemedView>

        <Card variant="grouped">
          {details.map((m, idx) => (
            <View key={idx} style={styles.row}>
              <IconSymbol name="circle.fill" size={8} color={markColor} />
              <ThemedText key={idx}>{m}</ThemedText>
            </View>
          ))}
        </Card>
        <ExamplesView entry={entry} />
      </ScrollView>
    </ThemedView>
  );
}

function ExamplesView({
  entry,
}: {
  entry: {
    word: DictionaryEntry;
    meanings: WordMeaning[];
    examples: ExampleSentence[];
  } | null;
}) {
  const db = useSQLiteContext();
  const aiex = useFetch<AiExample[]>(
    getAiExamples(craeteWordPrompt(entry)),
    (data) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (entry) {
        addExamplesList(entry.word.id, data, db);
      }
    }
  );

  const listItems = useMemo(() => {
    if (aiex.response) {
      return aiex.response.map((e) => ({
        jp: e.jp,
        en: e.en,
        reading: e.jp_reading,
      }));
    } else if (entry) {
      return entry.examples.map((e) => ({
        jp: e.japaneseText,
        en: e.englishText,
        reading: "",
      }));
    } else {
      return [];
    }
  }, [aiex.response, entry]);

  if (!entry) {
    return null;
  }

  return (
    <>
      <ThemedText type="title" style={styles.sectionTitle}>
        {"Examples"}
      </ThemedText>
      <Card variant="grouped">
        {listItems.map((e, idx) => (
          <View key={idx} style={styles.exampleItem}>
            <HighlightText text={e.jp} highlight={entry.word.word} />
            <ThemedText size="sm" type="secondary">
              {e.en}
            </ThemedText>
          </View>
        ))}
        {listItems.length === 0 ? (
          <ThemedText type="secondary">{"No examples found"}</ThemedText>
        ) : null}
      </Card>
      <Pressable
        style={styles.examplesLoading}
        disabled={aiex.isLoading}
        onPress={aiex.fetchData}
      >
        <ThemedText>{aiex.isLoading ? "Loading..." : "✨🤖✨"}</ThemedText>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerSection: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  word: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.41,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: "600",
  },
  exampleItem: {
    gap: 4,
  },
  examplesLoading: {
    alignItems: "center",
    paddingVertical: 16,
  },
});
