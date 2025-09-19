import { useAudioPlayer } from "expo-audio";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { HapticButton, HapticTab } from "@/components/HapticTab";
import { HighlightText } from "@/components/HighlightText";
import { Loader } from "@/components/Loader";
import { NavHeader } from "@/components/NavHeader";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import {
  addBookmark,
  addExamplesList,
  addToHistory,
  DictionaryEntry,
  ExampleSentence,
  getAudioFile,
  getDictionaryEntry,
  getWordExamples,
  isBookmarked,
  removeBookmark,
  saveAudioFile,
  WordMeaning,
} from "@/services/database";
import {
  cleanupJpReadings,
  deduplicateEn,
  findKanji,
  formatEn,
  formatJp,
} from "@/services/parse";
import { createWordPrompt } from "@/services/request";
import { KanjiDetails, KanjiListView } from "@/components/KanjiList";

export default function WordDetailScreen() {
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
    const examples = await getWordExamples(db, entry.word);
    setEntry((prev) => (prev ? { ...prev, examples } : null));
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

  const handleSpeech = () => {
    if (entry) {
      Speech.speak(entry.word.word, { language: "ja" });
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Loader />
        </View>
      </ThemedView>
    );
  }

  if (!entry) {
    return (
      <ThemedView style={styles.container}>
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
          headerTitle: () => <NavHeader title={title} />,
          headerRight: () => (
            <HapticButton
              color="black"
              systemImage={bookmarked ? "bookmark.fill" : "bookmark"}
              onPress={handleToggleBookmark}
            />
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ThemedView style={styles.headerSection}>
          <HapticTab onPress={handleSpeech}>
            <ThemedText type="title" style={styles.word}>
              {entry.word.word}
            </ThemedText>
          </HapticTab>
          <ThemedText type="secondary">
            {formatJp(entry.word.reading, true)}
          </ThemedText>
        </ThemedView>

        <Card variant="grouped">
          {details.map((m, idx) => (
            <View key={idx} style={styles.row}>
              <IconSymbol name="circle.fill" size={6} color={markColor} />
              <ThemedText size="md">{m}</ThemedText>
            </View>
          ))}
        </Card>

        <WordKanjiSection word={entry.word.word} />

        <ExamplesView entry={entry} refreshExamples={handleRefreshExamples} />
      </ScrollView>
    </ThemedView>
  );
}

function WordKanjiSection({ word }: { word: string }) {
  const kanjiChars = findKanji(word);

  if (kanjiChars.length === 0) {
    return null;
  }

  return (
    <>
      <ThemedText type="title" style={styles.sectionTitle}>
        {"Kanji"}
      </ThemedText>
      <Card variant="grouped">
        {kanjiChars.map((char, idx) => (
          <KanjiDetails key={idx} character={char} />
        ))}
      </Card>
    </>
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
  const ai = useUnifiedAI();
  const aiAvailable = ai.isAvailable;
  const generating = ai.isGenerating;
  const [selectedExample, setSelectedExample] = useState<string[] | null>(null);

  const handleFetchExamples = async () => {
    try {
      const prompt = createWordPrompt(entry);
      if (!prompt) return;

      const examples = await ai.generateExamples(prompt);
      if (examples.length > 0) {
        await addExamplesList(entry.word.id, examples, db);
        await refreshExamples();
      }
    } catch (error) {
      console.error("Failed to generate examples:", error);
    }
  };

  return (
    <>
      <ThemedText type="title" style={styles.sectionTitle}>
        {"Examples"}
      </ThemedText>
      <Card variant="grouped" gap={4}>
        {entry.examples.map((e, idx) => (
          <ExampleRow
            key={idx}
            e={e}
            idx={idx}
            word={entry.word.word}
            wordId={entry.word.id}
            onKanjiPress={setSelectedExample}
          />
        ))}
        {entry.examples.length === 0 ? (
          <ThemedText type="secondary">{"No examples found"}</ThemedText>
        ) : null}
      </Card>
      {aiAvailable && (
        <Pressable
          style={styles.examplesLoading}
          disabled={generating}
          onPress={handleFetchExamples}
        >
          <ThemedText>{generating ? "Loading..." : "✨🤖✨"}</ThemedText>
        </Pressable>
      )}
      <KanjiListView
        kanjiChars={selectedExample}
        handleClose={() => setSelectedExample(null)}
      />
    </>
  );
}

function ExampleRow({
  e,
  idx,
  word,
  wordId,
  onKanjiPress,
}: {
  e: ExampleSentence;
  idx: number;
  word: string;
  wordId: number;
  onKanjiPress?: (kanjiChars: string[]) => void;
}) {
  const tintColor = useThemeColor({}, "tint");
  const db = useSQLiteContext();
  const player = useAudioPlayer();
  const ai = useUnifiedAI();
  const audioAvailable = ai.getProviderCapabilities().audio;
  const [loading, setLoading] = useState(false);

  const fallbackToSpeech = () => {
    Speech.speak(e.japaneseText, { language: "ja" });
  };

  const handlePlayText = async () => {
    if (!audioAvailable) {
      fallbackToSpeech();
      return;
    }

    try {
      setLoading(true);
      const localAudio = await getAudioFile(db, wordId, e.id);

      if (localAudio) {
        player.replace(localAudio.filePath);
        player.play();
        return;
      }

      const audioPath = await ai.generateAudio(
        cleanupJpReadings(e.japaneseText)
      );

      if (audioPath) {
        player.replace(audioPath);
        player.play();
        await saveAudioFile(db, wordId, e.id, audioPath);
      } else {
        fallbackToSpeech();
      }
    } catch (error) {
      console.error("Failed to play text:", error);
      fallbackToSpeech();
    } finally {
      setLoading(false);
    }
  };

  const kanjiChars = findKanji(e.japaneseText);
  const hasKanji = kanjiChars.length > 0;

  return (
    <View>
      <View style={styles.exampleTitle}>
        <HighlightText text={e.japaneseText} highlight={word} />
        <ThemedText size="sm" type="secondary">
          {e.englishText}
        </ThemedText>
      </View>

      <HapticTab
        style={styles.icon}
        onPress={handlePlayText}
        disabled={audioAvailable && loading}
      >
        {audioAvailable && loading ? (
          <ActivityIndicator size="small" />
        ) : (
          <IconSymbol name="play.circle" size={24} color={tintColor} />
        )}
      </HapticTab>

      {hasKanji && onKanjiPress && (
        <HapticTab
          style={styles.kanjiButton}
          onPress={() => onKanjiPress(kanjiChars)}
        >
          <ThemedText size="sm" type="secondary">
            Kanji Details
          </ThemedText>
        </HapticTab>
      )}
    </View>
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
    paddingVertical: 16,
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
    marginTop: 16,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: "600",
  },
  exampleTitle: {
    gap: 4,
    flexDirection: "column",
    maxWidth: "90%",
  },
  examplesLoading: {
    alignItems: "center",
    paddingVertical: 16,
  },
  icon: {
    position: "absolute",
    right: 0,
  },
  kanjiButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
