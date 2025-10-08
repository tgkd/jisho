import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import { getPassagesByLevel, savePassage } from "@/services/database/passages";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View
} from "react-native";

type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

interface Passage {
  id: number;
  level: JLPTLevel;
  title: string;
  content: string;
  translation?: string;
  created_at: number;
}

export default function PassagesListScreen() {
  const { level } = useLocalSearchParams<{ level: JLPTLevel }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const ai = useUnifiedAI();

  const [passages, setPassages] = useState<Passage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadPassages();
  }, [level]);

  const loadPassages = async () => {
    try {
      setIsLoading(true);
      const data = await getPassagesByLevel(db, level);
      setPassages(data);
    } catch (error) {
      console.error("Failed to load passages:", error);
      Alert.alert("Error", "Failed to load passages");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePassage = async () => {
    try {
      setIsGenerating(true);
      const passage = await ai.generateReadingPassage(level);
      await savePassage(db, {
        level,
        title: passage.title,
        content: passage.content,
        translation: passage.translation,
      });
      await loadPassages();
    } catch (error) {
      console.error("Failed to generate passage:", error);
      Alert.alert("Error", "Failed to generate passage");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePassagePress = (passageId: number) => {
    router.push(`/practice/passage/${passageId}` as any);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Card>
        <View style={styles.header}>
          <View>
            <ThemedText size="lg" style={styles.levelTitle}>
              {level} Reading Passages
            </ThemedText>
            <ThemedText size="sm" type="secondary">
              {passages.length} passage{passages.length !== 1 ? "s" : ""} saved
            </ThemedText>
          </View>
        </View>

        <HapticTab
          onPress={handleGeneratePassage}
          style={[
            styles.generateButton,
            isGenerating && styles.generateButtonDisabled,
          ]}
          disabled={isGenerating}
        >
          <View style={styles.generateButtonContent}>
            {isGenerating ? (
              <>
                <ActivityIndicator size="small" color={Colors.light.text} />
                <ThemedText size="sm">Generating passage...</ThemedText>
              </>
            ) : (
              <>
                <IconSymbol
                  name="sparkles"
                  size={20}
                  color={Colors.light.text}
                />
                <ThemedText size="sm">Generate New Passage</ThemedText>
              </>
            )}
          </View>
        </HapticTab>
      </Card>

      {passages.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <IconSymbol
              name="book.closed"
              size={48}
              color={Colors.light.textSecondary}
            />
            <ThemedText size="md" type="secondary" style={styles.emptyText}>
              No passages yet
            </ThemedText>
            <ThemedText size="sm" type="secondary" style={styles.emptyHint}>
              Generate your first passage to start practicing
            </ThemedText>
          </View>
        </Card>
      ) : (
        <View style={styles.passagesList}>
          {passages.map((passage) => (
            <HapticTab
              key={passage.id}
              onPress={() => handlePassagePress(passage.id)}
              style={styles.passageCard}
            >
              <Card>
                <View style={styles.passageHeader}>
                  <View style={styles.passageTitleContainer}>
                    <ThemedText size="md" style={styles.passageTitle}>
                      {passage.title}
                    </ThemedText>
                    <ThemedText size="xs" type="secondary">
                      {formatDate(passage.created_at)}
                    </ThemedText>
                  </View>
                  <IconSymbol
                    name="chevron.right"
                    size={16}
                    color={Colors.light.textSecondary}
                  />
                </View>
                <ThemedText
                  size="sm"
                  type="secondary"
                  numberOfLines={2}
                  style={styles.passagePreview}
                >
                  {passage.content.substring(0, 100)}...
                </ThemedText>
              </Card>
            </HapticTab>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  levelTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  generateButton: {
    borderRadius: 12,
    backgroundColor: Colors.light.accentLight,
    padding: 16,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontWeight: "500",
  },
  emptyHint: {
    textAlign: "center",
  },
  passagesList: {
    gap: 12,
  },
  passageCard: {
    borderRadius: 16,
  },
  passageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  passageTitleContainer: {
    flex: 1,
    gap: 4,
  },
  passageTitle: {
    fontWeight: "600",
  },
  passagePreview: {
    lineHeight: 20,
  },
});
