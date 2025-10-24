import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";

import { FuriganaText } from "@/components/FuriganaText";
import { HapticTab } from "@/components/HapticTab";
import { KanjiDetails } from "@/components/KanjiList";
import { Loader } from "@/components/Loader";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import {
  addExamplesList,
  addToHistory,
  DictionaryEntry,
  ExampleSentence,
  FuriganaEntry,
  FuriganaSegment,
  getDictionaryEntry,
  getFuriganaForText,
  getWordExamples,
  WordMeaning
} from "@/services/database";
import {
  cleanupJpReadings,
  createChatPrompt,
  deduplicateEn,
  extractSegmentsFromTokens,
  findKanji,
  formatEn
} from "@/services/parse";
import { createWordPrompt } from "@/services/request";

export default function WordDetailScreen() {
  const markColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const router = useRouter();
  const params = useLocalSearchParams();
  const [entry, setEntry] = useState<{
    word: DictionaryEntry;
    meanings: WordMeaning[];
    examples: ExampleSentence[];
  } | null>(null);
  const [furigana, setFurigana] = useState<FuriganaEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const db = useSQLiteContext();
  const ai = useUnifiedAI();

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
        await addToHistory(db, result.word);

        const furiganaData = await getFuriganaForText(db, result.word.word);
        setFurigana(furiganaData);
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

  const handleSpeech = async () => {
    if (entry) {
      try {
        await ai.generateSpeech(entry.word.word);
      } catch (error) {
        console.error("Speech generation failed:", error);
      }
    }
  };

  const handleStartChat = () => {
    if (!entry) return;

    const initialPrompt = createChatPrompt("word", {
      word: entry.word.word,
      reading: entry.word.reading,
      kanji: entry.word.kanji || undefined,
    });

    const meanings = entry.meanings.map((m) => m.meaning).join("; ");

    router.push({
      pathname: "/word/chat",
      params: {
        word: entry.word.word,
        reading: entry.word.reading,
        meanings,
        initialPrompt,
      },
    });
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
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <ThemedView style={styles.headerSection}>
        <HapticTab onPress={handleSpeech}>
          <FuriganaText
            word={entry.word.word}
            segments={furigana?.segments}
            reading={entry.word.reading}
            textStyle={styles.word}
          />
        </HapticTab>
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

      {ai.isAvailable && (
        <>
          <View style={styles.askAIButton}>
            <HapticTab onPress={handleStartChat} style={styles.actionButton}>
              <View style={styles.actionContent}>
                <IconSymbol
                  name="bubble.left.and.text.bubble.right"
                  size={24}
                  color={tintColor}
                />
                <ThemedText style={styles.actionText}>Start Chat</ThemedText>
              </View>
            </HapticTab>
            <ThemedText type="secondary" size="sm">
              Get explanations, examples, and usage tips
            </ThemedText>
          </View>
        </>
      )}
    </ScrollView>
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
  const router = useRouter();

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
      console.error("Failed to generate or save examples:", error);
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
            word={entry.word.word}
            wordId={entry.word.id}
            onKanjiPress={(kanjiChars) =>
              router.push({
                pathname: "/word/kanji-list",
                params: { kanji: kanjiChars.join(",") },
              })
            }
          />
        ))}
        {entry.examples.length === 0 ? (
          <ThemedText type="secondary">{"No examples found"}</ThemedText>
        ) : null}
        {ai.isAvailable ? (
          <Pressable
            style={styles.examplesLoading}
            disabled={ai.isGenerating}
            onPress={handleFetchExamples}
          >
            {ai.isGenerating ? (
              <ActivityIndicator size="small" />
            ) : (
              <ThemedText>✨🤖✨</ThemedText>
            )}
          </Pressable>
        ) : null}
      </Card>
    </>
  );
}

function ExampleRow({
  e,
  word,
  wordId,
  onKanjiPress,
}: {
  e: ExampleSentence;
  word: string;
  wordId: number;
  onKanjiPress?: (kanjiChars: string[]) => void;
}) {
  const tintColor = useThemeColor({}, "tint");
  const ai = useUnifiedAI();
  const audioAvailable = ai.currentProvider === "remote";
  const [loading, setLoading] = useState(false);

  const segments = useMemo<FuriganaSegment[]>(() => {
    if (Array.isArray(e.segments) && e.segments.length > 0) {
      return e.segments;
    }

    const extracted = extractSegmentsFromTokens(e.tokens);
    return extracted;
  }, [e.segments, e.tokens]);

  const reading = useMemo(() => {
    if (typeof e.reading === "string" && e.reading.trim().length > 0) {
      return e.reading.trim();
    }

    if (segments.length === 0) {
      return "";
    }

    const derived = segments
      .map((segment) => segment.rt?.trim() || segment.ruby)
      .join("");
    return derived;
  }, [e.reading, segments]);

  const fallbackToSpeech = async () => {
    try {
      await ai.generateSpeech(e.japaneseText);
    } catch (error) {
      console.error("Speech generation failed:", error);
    }
  };

  const handlePlayText = async () => {
    if (!audioAvailable) {
      await fallbackToSpeech();
      return;
    }

    try {
      setLoading(true);
      await ai.generateSpeech(cleanupJpReadings(e.japaneseText));
    } catch (error) {
      console.error("Failed to play text:", error);
      await fallbackToSpeech();
    } finally {
      setLoading(false);
    }
  };

  const kanjiChars = findKanji(e.japaneseText);
  const hasKanji = kanjiChars.length > 0;

  return (
    <View>
      <View style={styles.exampleTitle}>
        <FuriganaText
          word={e.japaneseText}
          reading={reading}
          textStyle={styles.exampleJapanese}
          furiganaStyle={styles.exampleFurigana}
          segments={segments}
        />
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
    flex: 1,
    paddingRight: 32,
    alignItems: "flex-start",
  },
  exampleJapanese: {
    fontSize: 16,
    lineHeight: 22,
  },
  exampleFurigana: {
    fontSize: 10,
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
  askAIButton: {
    marginTop: 12,
    alignItems: "center",
  },
  askAIContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  askAIText: {
    flex: 1,
    gap: 4,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  actionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
