import { StyleSheet, View, ScrollView, Platform } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useThemeColor } from "@/hooks/useThemeColor";
import { DictionaryEntry, getDictionaryEntry } from "@/services/database";
import { Loader } from "@/components/Loader";

export default function WordDetailScreen() {
  const tintColor = useThemeColor(
    { light: "#000000", dark: "#ffffff" },
    "text"
  );
  const { id } = useLocalSearchParams();
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const db = useSQLiteContext();

  useEffect(() => {
    const loadEntry = async () => {
      try {
        const result = await getDictionaryEntry(db, Number(id));
        setEntry(result);
      } catch (error) {
        console.error("Failed to load dictionary entry:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntry();
  }, [id]);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen
          options={{
            headerBackTitle: "Search",
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
        <View style={styles.errorContainer}>
          <ThemedText>{"Word not found"}</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerSection}>
          <ThemedText type="title" style={styles.word}>
            {entry.word}
          </ThemedText>
          <ThemedText style={styles.reading}>{entry.reading}</ThemedText>
        </View>

        <View style={styles.meaningsSection}>
          <ThemedText type="defaultSemiBold">{"Meanings"}</ThemedText>
          {entry.meanings.map((meaning, index) => (
            <View key={index} style={styles.meaningItem}>
              <IconSymbol name="circle.fill" size={6} color={tintColor} />
              <ThemedText style={styles.meaningText}>
                {meaning.meaning}
              </ThemedText>
            </View>
          ))}
        </View>
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
    gap: 16,
  },
  headerSection: {
    gap: 8,
    alignItems: "center",
  },
  word: {
    fontSize: 48,
    lineHeight: 64,
  },
  reading: {
    fontSize: 24,
    color: "#666",
  },
  meaningsSection: {
    gap: 8,
  },
  meaningItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  meaningText: {
    flex: 1,
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
  },
});
