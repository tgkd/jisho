import { Stack, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { Loader } from "@/components/Loader";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
  addBookmark,
  DictionaryEntry,
  ExampleSentence,
  getDictionaryEntry,
  isBookmarked,
  removeBookmark,
} from "@/services/database";

const PARTS_OF_SPEECH: Record<string, string> = {
  n: "Noun",
  v1: "Ichidan verb",
  v5: "Godan verb",
  "adj-i": "I-adjective",
  "adj-na": "Na-adjective",
  "adj-t": "Taru adjective",
  adv: "Adverb",
  exp: "Expression",
  int: "Interjection",
  num: "Number",
  pref: "Prefix",
  suf: "Suffix",
  vs: "Suru verb",
  v5r: "Godan verb (irregular)",
  vz: "Ichidan verb (zuru)",
  vi: "Intransitive verb",
  vk: "Kuru verb",
  vn: "Irregular nu verb",
  vr: "Ru verb",
  "vs-c": "Suru verb - special class",
  "vs-i": "Suru verb - irregular",
  "vs-s": "Suru verb - special class",
};

export default function WordDetailScreen() {
  const tintColor = useThemeColor({}, "text");
  const params = useLocalSearchParams();
  const title = typeof params.title === "string" ? params.title : "Details";
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [examples, setExamples] = useState<ExampleSentence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const db = useSQLiteContext();

  const loadEntry = async () => {
    try {
      const result = await getDictionaryEntry(db, Number(params.id), true);

      if (result) {
        if ("examples" in result) {
          setExamples(result.examples);
          setEntry({
            id: result.id,
            word: result.word,
            reading: result.reading,
            reading_hiragana: result.reading_hiragana,
            kanji: result.kanji,
            meanings: result.meanings,
          });
        } else {
          setExamples([]);
          setEntry(result);
        }
      }

      if (result) {
        const bookmarkStatus = await isBookmarked(db, result.id);
        setBookmarked(bookmarkStatus);
      }
    } catch (error) {
      console.error("Failed to load dictionary entry:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEntry();
  }, []);

  const handleToggleBookmark = async () => {
    if (!entry) return;

    try {
      if (bookmarked) {
        await removeBookmark(db, entry.id);
      } else {
        await addBookmark(db, entry.id);
      }
      setBookmarked(!bookmarked);
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
            headerBackTitle: "Search",
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
                name={bookmarked ? "bookmark.fill" : "bookmark"}
                size={24}
                color={tintColor}
              />
            </HapticTab>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={styles.headerSection}>
          <ThemedText type="title" style={styles.word}>
            {entry.word}
          </ThemedText>
          <ThemedText type="secondary" style={styles.reading}>
            {`【${entry.reading.join(", ")}】`}
          </ThemedText>
        </ThemedView>

        <Card variant="grouped" style={styles.meaningsSection}>
          {entry.meanings.map((m, idx) => (
            <View key={idx} style={styles.meaningItem}>
              <IconSymbol name="circle.fill" size={6} color={tintColor} />
              <View>
                <ThemedText style={styles.meaningText}>
                  {m.meaning.replaceAll(";", ", ")}
                </ThemedText>
                {m.part_of_speech && PARTS_OF_SPEECH[m.part_of_speech] ? (
                  <ThemedText type="secondary">
                    {PARTS_OF_SPEECH[m.part_of_speech]}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          ))}
        </Card>

        {examples.length ? (
          <>
            <ThemedText type="title" style={styles.sectionTitle}>
              {"Example Sentences"}
            </ThemedText>
            <Card variant="grouped" style={styles.examplesSection}>
              {examples.map((example, idx) => (
                <View key={idx} style={styles.exampleItem}>
                  <ThemedText>{example.japanese_text}</ThemedText>
                  <ThemedText type="secondary">
                    {example.english_text}
                  </ThemedText>
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
  },
  word: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.41,
  },
  reading: {
    fontSize: 17,
    marginTop: 4,
  },
  meaningsSection: {
    gap: 8,
    borderRadius: 10,
    padding: 16,
  },
  meaningItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  meaningText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
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
    gap: 8,
  },
  examplesLoading: {
    marginTop: 24,
    alignItems: "center",
    paddingVertical: 16,
  },
});
