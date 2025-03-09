import { Stack, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

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
  addToHistory,
  DictionaryEntry,
  ExampleSentence,
  getDictionaryEntry,
  isBookmarked,
  removeBookmark,
  WordMeaning,
} from "@/services/database";
import { deduplicateEn, formatEn, formatJp } from "@/services/parse";
import { AiExample, getAiExamples } from "@/services/request";
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
  const aiex = useFetch<AiExample[]>(getAiExamples(entry?.word.word));

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

        <Card variant="grouped" style={styles.meaningsSection}>
          {details.map((m, idx) => (
            <View key={idx} style={styles.row}>
              <IconSymbol name="circle.fill" size={8} color={markColor} />
              <ThemedText key={idx}>{m}</ThemedText>
            </View>
          ))}
        </Card>

        {entry.examples.length ? (
          <>
            <ThemedText type="title" style={styles.sectionTitle}>
              {"Example Sentences"}
            </ThemedText>
            <Card variant="grouped" style={styles.examplesSection}>
              {entry.examples.map((e, idx) => (
                <View key={idx} style={styles.exampleItem}>
                  <HighlightText
                    text={e.japaneseText}
                    highlight={entry.word.word}
                  />
                  <ThemedText size="sm" type="secondary">
                    {e.englishText}
                  </ThemedText>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <Pressable
          style={styles.examplesLoading}
          disabled={aiex.isLoading}
          onPress={aiex.fetchData}
        >
          <ThemedText>{aiex.isLoading ? "Loading..." : "AI 🤖"}</ThemedText>
        </Pressable>

        {Array.isArray(aiex.response) ? (
          <>
            <ThemedText type="title" style={styles.sectionTitle}>
              {"AI Generated Examples"}
            </ThemedText>
            <Card variant="grouped" style={styles.examplesSection}>
              {aiex.response.map((e, idx) => (
                <View key={idx} style={styles.exampleItem}>
                  <ThemedText>{e.jp}</ThemedText>
                  <ThemedText size="sm" type="secondary">
                    {e.en}
                  </ThemedText>
                  {e.expl && (
                    <ThemedText
                      size="sm"
                      type="secondary"
                      style={styles.explanation}
                    >
                      {e.expl}
                    </ThemedText>
                  )}
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
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
  meaningsSection: {
    gap: 8,
    borderRadius: 10,
    padding: 16,
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
  examplesSection: {
    gap: 24,
    borderRadius: 10,
    padding: 16,
  },
  exampleItem: {
    gap: 4,
  },
  examplesLoading: {
    marginTop: 24,
    alignItems: "center",
    paddingVertical: 16,
  },
  explanation: {
    fontStyle: "italic",
    marginTop: 4,
  },
});
