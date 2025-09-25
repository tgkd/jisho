import { useLocalSearchParams } from "expo-router";
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
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import { getKanjiById, KanjiEntry } from "@/services/database";

export default function KanjiDetailScreen() {
  const markColor = useThemeColor({}, "text");
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const [entry, setEntry] = useState<KanjiEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const db = useSQLiteContext();

  const loadKanjiDetails = async () => {
    try {
      const result = await getKanjiById(db, Number(params.id));

      if (result) {
        setEntry(result);
      }
    } catch (error) {
      console.error("Failed to load kanji details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKanjiDetails();
  }, [params]);

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
          <ThemedText>{"Kanji not found"}</ThemedText>
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
        <ThemedText type="title">{entry.character}</ThemedText>
      </ThemedView>
      {entry.meanings?.length ? (
        <>
          <ThemedText type="title" style={styles.sectionTitle}>
            {"Meanings"}
          </ThemedText>
          <Card variant="grouped">
            {entry.meanings.map((meaning, idx) => (
              <View key={idx} style={styles.row}>
                <IconSymbol name="circle.fill" size={6} color={markColor} />
                <ThemedText size="md">{meaning}</ThemedText>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <ReadingsSection entry={entry} />
    </ScrollView>
  );
}

function ReadingsSection({ entry }: { entry: KanjiEntry }) {
  const tintColor = useThemeColor({}, "tint");
  const ai = useUnifiedAI();

  const handleSpeech = async (reading: string) => {
    try {
      await ai.generateSpeech(reading);
    } catch (error) {
      console.error("Speech generation failed:", error);
    }
  };

  return (
    <>
      <ThemedText style={styles.sectionTitle}>{"Readings"}</ThemedText>
      <Card variant="grouped">
        {entry.onReadings?.length ? (
          <View style={styles.readingSection}>
            <ThemedText type="secondary">{"On"}</ThemedText>
            <View style={styles.readingList}>
              {entry.onReadings?.map((r, idx) => (
                <View style={styles.reading} key={idx}>
                  <ThemedText>{r}</ThemedText>
                  <HapticTab onPress={() => handleSpeech(r)}>
                    <IconSymbol
                      name="play.circle"
                      size={24}
                      color={tintColor}
                    />
                  </HapticTab>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {entry.kunReadings?.length ? (
          <View style={styles.readingSection}>
            <ThemedText type="secondary">{"Kun"}</ThemedText>
            <View style={styles.readingList}>
              {entry.kunReadings?.map((r, idx) => (
                <View style={styles.reading} key={idx}>
                  <ThemedText>{r}</ThemedText>
                  <HapticTab onPress={() => handleSpeech(r)}>
                    <IconSymbol
                      name="play.circle"
                      size={24}
                      color={tintColor}
                    />
                  </HapticTab>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </Card>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
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
  readingSection: {
    paddingVertical: 8,
    gap: 8,
  },
  readingList: {
    flexDirection: "column",
    flexWrap: "wrap",
    gap: 8,
  },
  reading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerSection: {
    alignItems: "center",
    paddingTop: 16,
    gap: 8,
  },
});
