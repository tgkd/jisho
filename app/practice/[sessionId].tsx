import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useMdStyles } from "@/hooks/useMdStyles";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import {
  getSession,
  type PracticeSession,
} from "@/services/database/practice-sessions";
import { createChatPrompt, extractJapaneseFromPassage } from "@/services/parse";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";

export default function PracticeSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const markdownStyles = useMdStyles();
  const ai = useUnifiedAI();
  const tintColor = useThemeColor({}, "tint");

  const [session, setSession] = useState<PracticeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSessionData = useCallback(async () => {
    try {
      setIsLoading(true);
      const sessionData = await getSession(db, Number(sessionId));
      if (!sessionData) {
        Alert.alert("Error", "Practice session not found");
        router.back();
        return;
      }

      setSession(sessionData);
    } catch (error) {
      console.error("Failed to load session:", error);
      Alert.alert("Error", "Failed to load practice session");
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [db, sessionId, router]);

  const handleReadAloud = async () => {
    if (!session) return;

    const contentOutput =
      session.content_output ?? session.content ?? session.content_text ?? "";

    if (!contentOutput) {
      return;
    }

    if (ai.isPlayingSpeech) {
      ai.stopSpeech();
      return;
    }

    try {
      const japaneseText =
        session.content_text || extractJapaneseFromPassage(contentOutput);

      if (!japaneseText) {
        Alert.alert("Error", "No Japanese text found in this passage");
        return;
      }

      await ai.generateSpeech(japaneseText);
    } catch (error) {
      console.error("Speech generation failed:", error);
      Alert.alert("Error", "Failed to read aloud");
    }
  };

  const handleStartChat = () => {
    if (!session) return;

    const contentOutput =
      session.content_output ?? session.content ?? session.content_text ?? "";
    if (!contentOutput && !session.content_text) {
      return;
    }

    const japaneseText =
      session.content_text || extractJapaneseFromPassage(contentOutput);

    if (!japaneseText) {
      Alert.alert("Error", "No Japanese text found in this passage");
      return;
    }

    const initialPrompt = createChatPrompt("passage", {
      text: japaneseText,
    });

    router.push({
      pathname: "/word/chat",
      params: {
        initialPrompt,
      },
    });
  };

  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centerContainer}>
        <ThemedText>Session not found</ThemedText>
      </View>
    );
  }

  const contentOutput =
    session.content_output ?? session.content ?? session.content_text ?? "";

  if (!contentOutput) {
    return (
      <View style={styles.centerContainer}>
        <ThemedText type="secondary">No content available</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.actionsContainer}>
        <HapticTab
          onPress={ai.isPlayingSpeech ? ai.stopSpeech : handleReadAloud}
          style={styles.actionButton}
        >
          <View style={styles.actionContent}>
            <IconSymbol
              name={ai.isPlayingSpeech ? "stop.circle" : "play.circle"}
              size={24}
              color={tintColor}
            />
            <ThemedText style={styles.actionText}>{"Audio"}</ThemedText>
          </View>
        </HapticTab>

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
      </View>

      <Markdown style={markdownStyles}>{contentOutput}</Markdown>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  actionsContainer: {
    flexDirection: "row",
    marginBottom: 24,
    gap: 12,
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
