import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

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

export default function PracticeScreen() {
  const router = useRouter();

  const handleLevelPress = (level: JLPTLevel) => {
    router.push(`/practice/passages/${level}` as any);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Card>
        <ThemedText size="lg" style={styles.title}>
          Reading Practice
        </ThemedText>
        <ThemedText size="sm" type="secondary" style={styles.subtitle}>
          AI-generated passages to improve your Japanese reading skills
        </ThemedText>
      </Card>

      <View style={styles.levelsContainer}>
        {levels.map((item) => (
          <HapticTab
            key={item.level}
            onPress={() => handleLevelPress(item.level)}
            style={styles.levelCard}
          >
            <Card style={[styles.cardContent, { borderLeftColor: item.color }]}>
              <View style={styles.levelHeader}>
                <View style={styles.levelTitleContainer}>
                  <ThemedText size="md" style={styles.levelTitle}>
                    {item.title}
                  </ThemedText>
                  <ThemedText size="sm" type="secondary">
                    {item.description}
                  </ThemedText>
                </View>
                <IconSymbol
                  name="chevron.right"
                  size={20}
                  color={Colors.light.textSecondary}
                />
              </View>
            </Card>
          </HapticTab>
        ))}
      </View>

      <Card>
        <ThemedText size="xs" type="secondary" style={styles.note}>
          💡 Tip: Each passage includes furigana, translation, audio
          playback, and word lookup features to help you learn effectively.
        </ThemedText>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 24,
  },
  title: {
    fontWeight: "600",
  },
  subtitle: {
    lineHeight: 20,
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
});
