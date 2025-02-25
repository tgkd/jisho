import { Stack, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Loader } from "@/components/Loader";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
  DictionaryEntry,
  ExampleSentence,
  getDictionaryEntry,
  searchExamples,
} from "@/services/database";

export default function WordDetailScreen() {
  const tintColor = useThemeColor(
    { light: "#000000", dark: "#ffffff" },
    "text"
  );

  const params = useLocalSearchParams();
  const title = typeof params.title === "string" ? params.title : "Details";
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [examples, setExamples] = useState<ExampleSentence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const db = useSQLiteContext();

  useEffect(() => {
    const loadEntry = async () => {
      try {
        const result = await getDictionaryEntry(db, Number(params.id));
        setEntry(result);

        if (result) {
          try {
            const exampleResults = await searchExamples(db, result.word);
            setExamples(exampleResults);
          } catch (error) {
            console.error("Failed to load examples:", error);
          }
        }
      } catch (error) {
        console.error("Failed to load dictionary entry:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntry();
  }, [params]);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerBackTitle: "Search", title }} />
        <View style={styles.loadingContainer}>
          <Loader />
        </View>
      </ThemedView>
    );
  }

  if (!entry) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerBackTitle: "Search", title }} />
        <View style={styles.errorContainer}>
          <ThemedText>{"Word not found"}</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerBackTitle: "Search", title }} />
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
                <ThemedText type="secondary">{m.part_of_speech}</ThemedText>
              </View>
            </View>
          ))}
        </Card>
        <ThemedText type="title" style={styles.sectionTitle}>
          Example Sentences
        </ThemedText>
        <Card variant="grouped" style={styles.examplesSection}>
          {examples.map((example, idx) => (
            <View key={idx} style={styles.exampleItem}>
              <View>
                <ThemedText style={styles.japaneseText}>
                  {example.japanese_text}
                </ThemedText>
                <ThemedText type="secondary" style={styles.englishText}>
                  {example.english_text}
                </ThemedText>
              </View>
            </View>
          ))}
        </Card>
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
    gap: 16,
    borderRadius: 10,
    padding: 16,
  },
  exampleItem: {
    gap: 8,
  },
  japaneseText: {
    fontSize: 17,
    lineHeight: 24,
  },
  englishText: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 4,
  },
  examplesLoading: {
    marginTop: 24,
    alignItems: "center",
    paddingVertical: 16,
  },
});
