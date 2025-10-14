import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import {
  createSession,
  type JLPTLevel
} from "@/services/database/practice-sessions";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View
} from "react-native";

interface LevelCardData {
  level: JLPTLevel;
  title: string;
  description: string;
  color: string;
}

const levels: LevelCardData[] = [
  {
    level: "N5",
    title: "JLPT N5",
    description: "Basic level - everyday expressions and simple phrases",
    color: "#4CAF50",
  },
  {
    level: "N4",
    title: "JLPT N4",
    description: "Elementary level - basic conversations and texts",
    color: "#2196F3",
  },
  {
    level: "N3",
    title: "JLPT N3",
    description: "Intermediate level - everyday situations",
    color: "#FF9800",
  },
  {
    level: "N2",
    title: "JLPT N2",
    description: "Advanced level - newspapers and general topics",
    color: "#F44336",
  },
  {
    level: "N1",
    title: "JLPT N1",
    description: "Expert level - complex texts and abstract topics",
    color: "#9C27B0",
  },
];

export default function NewPracticeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel | null>(null);

  const handleLevelPress = async (level: JLPTLevel) => {
    if (isGenerating) return;

    try {
      setIsGenerating(true);
      setSelectedLevel(level);

      const sessionId = await createSession(db, level);

      router.replace(`/practice/${sessionId}` as any);
    } catch (error) {
      console.error("Failed to create session:", error);
      Alert.alert("Error", "Failed to create practice session");
    } finally {
      setIsGenerating(false);
      setSelectedLevel(null);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <ThemedText size="xs" type="secondary" style={styles.note}>
        Get AI-generated reading passages tailored to your JLPT level. Practice
        reading comprehension and expand your vocabulary with content designed
        for your learning stage.
      </ThemedText>

      <ThemedText size="xs" type="secondary" style={styles.disclaimer}>
        ⚠️ AI-generated content may contain errors or inaccuracies. Please
        verify important information with reliable sources.
      </ThemedText>

      <View style={styles.levelsContainer}>
        {levels.map((item) => (
          <HapticTab
            key={item.level}
            onPress={() => handleLevelPress(item.level)}
            style={styles.levelCard}
            disabled={isGenerating}
          >
            <Card
              style={[
                styles.cardContent,
                { borderLeftColor: item.color },
                isGenerating &&
                  selectedLevel !== item.level &&
                  styles.cardDisabled,
              ]}
            >
              <View style={styles.levelHeader}>
                <View style={styles.levelTitleContainer}>
                  <ThemedText size="md" style={styles.levelTitle}>
                    {item.title}
                  </ThemedText>
                  <ThemedText size="sm" type="secondary">
                    {item.description}
                  </ThemedText>
                </View>
                {isGenerating && selectedLevel === item.level ? (
                  <ActivityIndicator size="small" color={Colors.light.tint} />
                ) : (
                  <IconSymbol
                    name="chevron.right"
                    size={20}
                    color={Colors.light.textSecondary}
                  />
                )}
              </View>
            </Card>
          </HapticTab>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 24,
  },
  levelsContainer: {
    gap: 12,
  },
  levelCard: {
    borderRadius: 16,
  },
  cardContent: {
    borderLeftWidth: 4,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  levelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  levelTitleContainer: {
    flex: 1,
    gap: 4,
  },
  levelTitle: {
    fontWeight: "600",
  },
  note: {
    textAlign: "center",
    lineHeight: 18,
  },
  disclaimer: {
    textAlign: "center",
    lineHeight: 18,
    opacity: 0.7,
  },
});
