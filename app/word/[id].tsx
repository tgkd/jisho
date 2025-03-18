import { Stack, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
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
  getAudioFile,
  getDictionaryEntry,
  getExamples,
  isBookmarked,
  removeBookmark,
  saveAudioFile,
  WordMeaning,
} from "@/services/database";
import { deduplicateEn, formatEn, formatJp } from "@/services/parse";
import {
  aiSoundQueryOptions,
  aiExamplesQueryOptions,
  craeteWordPrompt,
} from "@/services/request";
import { useAudioPlayer } from "expo-audio";
import { useQuery } from "@tanstack/react-query";

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

  const handleRefreshExamples = async () => {
    if (!entry) {
      return;
    }
    try {
      const newDbExamples = await getExamples(db, entry.word);
      setEntry((prev) => {
        if (prev) {
          return { ...prev, examples: newDbExamples };
        }
        return prev;
      });
    } catch (error) {}
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
        <ExamplesView entry={entry} refreshExamples={handleRefreshExamples} />
      </ScrollView>
    </ThemedView>
  );
}

function ExamplesView({
  entry,
  refreshExamples,
}: {
  entry: {
    word: DictionaryEntry;
    meanings: WordMeaning[];
    examples: ExampleSentence[];
  };
  refreshExamples: () => Promise<void>;
}) {
  const db = useSQLiteContext();
  const aiexQuery = useQuery(aiExamplesQueryOptions(craeteWordPrompt(entry)));
  const aiex = aiexQuery.data;

  const handleFetchExamples = async () => {
    const resp = await aiexQuery.refetch();
    if (resp.data) {
      await addExamplesList(entry.word.id, resp.data, db);
      await refreshExamples();
    }
  };

  return (
    <>
      <ThemedText type="title" style={styles.sectionTitle}>
        {"Examples"}
      </ThemedText>
      <Card variant="grouped">
        {entry.examples.map((e, idx) => (
          <ExampleRow
            key={idx}
            e={e}
            idx={idx}
            word={entry.word.word}
            wordId={entry.word.id}
          />
        ))}
        {entry.examples.length === 0 ? (
          <ThemedText type="secondary">{"No examples found"}</ThemedText>
        ) : null}
      </Card>
      <Pressable
        style={styles.examplesLoading}
        disabled={aiexQuery.isLoading}
        onPress={handleFetchExamples}
      >
        <ThemedText>{aiexQuery.isLoading ? "Loading..." : "✨🤖✨"}</ThemedText>
      </Pressable>
    </>
  );
}

function ExampleRow({
  e,
  idx,
  word,
  wordId,
}: {
  e: ExampleSentence;
  idx: number;
  word: string;
  wordId: number;
}) {
  const db = useSQLiteContext();
  const player = useAudioPlayer();
  const soundQuery = useQuery(aiSoundQueryOptions(e.japaneseText));

  const fallbackToSpeech = () => {
    Speech.speak(e.japaneseText, { language: "ja" });
  };

  const handlePlayText = async () => {
    try {
      const localAudio = await getAudioFile(db, wordId, e.id);

      if (localAudio) {
        player.replace(localAudio.filePath);
        player.play();
        return;
      }

      const res = await soundQuery.refetch();

      if (res.data) {
        player.replace(res.data);
        player.play();
        await saveAudioFile(db, wordId, e.id, res.data);
      } else {
        fallbackToSpeech();
      }
    } catch (error) {
      console.error("Failed to play text:", error);
      fallbackToSpeech();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePlayText}
      key={idx}
      style={styles.exampleItem}
    >
      <View style={styles.exampleRow}>
        <IconSymbol
          name={soundQuery.isFetching ? "progress.indicator" : "speaker.circle"}
          size={16}
          color="gray"
        />
        <HighlightText text={e.japaneseText} highlight={word} />
      </View>
      <ThemedText size="sm" type="secondary">
        {e.englishText}
      </ThemedText>
    </TouchableOpacity>
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
  exampleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "90%",
  },
});
