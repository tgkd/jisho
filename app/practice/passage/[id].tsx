import { FuriganaText } from "@/components/FuriganaText";
import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import { getFuriganaForText } from "@/services/database";
import { getPassageById } from "@/services/database/passages";
import { SETTINGS_KEYS } from "@/services/storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";

type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

interface Passage {
  id: number;
  level: JLPTLevel;
  title: string;
  content: string;
  translation?: string;
  created_at: number;
}

interface FuriganaSegment {
  ruby: string;
  rt?: string;
}

export default function PassageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const ai = useUnifiedAI();

  const [passage, setPassage] = useState<Passage | null>(null);
  const [furiganaSegments, setFuriganaSegments] = useState<FuriganaSegment[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const [showFurigana] = useMMKVBoolean(SETTINGS_KEYS.SHOW_FURIGANA);

  useEffect(() => {
    loadPassage();
  }, [id]);

  const loadPassage = async () => {
    try {
      setIsLoading(true);
      const data = await getPassageById(db, Number(id));
      if (data) {
        setPassage(data);
        const furiganaData = await getFuriganaForText(db, data.content);
        if (furiganaData) {
          setFuriganaSegments(furiganaData.segments);
        }
      } else {
        Alert.alert("Error", "Passage not found");
        router.back();
      }
    } catch (error) {
      console.error("Failed to load passage:", error);
      Alert.alert("Error", "Failed to load passage");
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudio = async () => {
    if (!passage) return;

    try {
      setIsPlayingAudio(true);
      await ai.speakText(passage.content);
    } catch (error) {
      console.error("Failed to play audio:", error);
      Alert.alert("Error", "Failed to play audio");
    } finally {
      setIsPlayingAudio(false);
    }
  };

  const handleWordPress = (word: string) => {
    router.push(`/word?query=${encodeURIComponent(word)}`);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!passage) {
    return (
      <View style={styles.centerContainer}>
        <ThemedText>Passage not found</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Card>
        <ThemedText size="lg" style={styles.title}>
          {passage.title}
        </ThemedText>
        <View style={styles.metadata}>
          <ThemedText size="xs" type="secondary">
            {passage.level} • {new Date(passage.created_at).toLocaleDateString()}
          </ThemedText>
        </View>
      </Card>

      <Card>
        <View style={styles.controls}>
          <HapticTab
            onPress={handlePlayAudio}
            style={[styles.controlButton, isPlayingAudio && styles.controlButtonActive]}
          >
            <IconSymbol
              name={isPlayingAudio ? "stop.circle" : "play.circle"}
              size={24}
              color={isPlayingAudio ? Colors.light.tint : Colors.light.text}
            />
            <ThemedText size="sm">
              {isPlayingAudio ? "Stop" : "Play Audio"}
            </ThemedText>
          </HapticTab>

          <HapticTab
            onPress={() => setShowTranslation(!showTranslation)}
            style={[
              styles.controlButton,
              showTranslation && styles.controlButtonActive,
            ]}
          >
            <IconSymbol
              name="character.book.closed"
              size={24}
              color={showTranslation ? Colors.light.tint : Colors.light.text}
            />
            <ThemedText size="sm">
              {showTranslation ? "Hide" : "Show"} Translation
            </ThemedText>
          </HapticTab>
        </View>
      </Card>

      <Card>
        <View style={styles.passageContent}>
          {furiganaSegments.length > 0 && showFurigana ? (
            <Pressable onPress={() => handleWordPress(passage.content)}>
              <FuriganaText
                word={passage.content}
                segments={furiganaSegments}
                reading=""
                textStyle={styles.passageText}
              />
            </Pressable>
          ) : (
            <Pressable onPress={() => handleWordPress(passage.content)}>
              <ThemedText size="md" style={styles.passageText}>
                {passage.content}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </Card>

      {showTranslation && passage.translation && (
        <Card style={styles.translationCard}>
          <View style={styles.translationHeader}>
            <IconSymbol
              name="text.bubble"
              size={20}
              color={Colors.light.textSecondary}
            />
            <ThemedText size="sm" type="secondary" style={styles.translationLabel}>
              Translation
            </ThemedText>
          </View>
          <ThemedText size="sm" style={styles.translationText}>
            {passage.translation}
          </ThemedText>
        </Card>
      )}

      <Card>
        <ThemedText size="xs" type="secondary" style={styles.hint}>
          💡 Tip: Tap on any part of the text to look up words in the dictionary
        </ThemedText>
      </Card>
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
  title: {
    fontWeight: "600",
    marginBottom: 8,
  },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
  },
  controls: {
    flexDirection: "row",
    gap: 12,
  },
  controlButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.light.accentLight,
  },
  controlButtonActive: {
    backgroundColor: Colors.light.accentLight,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  passageContent: {
    paddingVertical: 8,
  },
  passageText: {
    lineHeight: 32,
    fontSize: 18,
  },
  translationCard: {
    backgroundColor: Colors.light.accentLight,
  },
  translationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  translationLabel: {
    fontWeight: "600",
  },
  translationText: {
    lineHeight: 22,
  },
  hint: {
    textAlign: "center",
    lineHeight: 18,
  },
});
