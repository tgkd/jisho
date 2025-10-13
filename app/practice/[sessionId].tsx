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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Markdown, { RenderRules } from "react-native-markdown-display";
import { isJapanese } from "wanakana";

/**
 * Renders the practice session passage with speech playback controls.
 *
 * @returns {JSX.Element} Scrollable practice session view.
 * @throws {Error} Propagates data-loading errors from hooks when the SQLite layer fails.
 */
export default function PracticeSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const markdownStyles = useMdStyles();
  const ai = useUnifiedAI();
  const tintColor = useThemeColor({}, "tint");

  const [session, setSession] = useState<PracticeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [speechState, setSpeechState] = useState<{
    index: number | null;
    phase: "idle" | "loading" | "playing";
  }>({ index: null, phase: "idle" });

  const { index: activeSpeechIndex, phase: activeSpeechPhase } = speechState;
  const japaneseParagraphs = useMemo(() => {
    if (!session) return [];

    const contentText = session.content_text ?? "";
    if (!contentText) return [];

    return contentText
      .split("\n\n")
      .map((p) => p.trim())
      .filter((p) => {
        if (!p) return false;
        if (p.startsWith("#")) return false;
        if (/^(Vocabulary|Grammar|English|Translation)/i.test(p)) return false;
        const hasJapanese = Array.from(p).some((char) => isJapanese(char));
        return hasJapanese;
      })
      .map((p) => {
        return p.replace(/[#*_`]/g, "").trim();
      });
  }, [session]);

  const handlePlayParagraph = useCallback(
    async (text: string, index: number) => {
      if (
        activeSpeechIndex === index &&
        (activeSpeechPhase === "loading" || activeSpeechPhase === "playing")
      ) {
        ai.stopSpeech();
        setSpeechState({ index: null, phase: "idle" });
        return;
      }

      try {
        setSpeechState({ index, phase: "loading" });
        await ai.generateSpeech(text);
        setSpeechState((current) => {
          if (current.index !== index) {
            return current;
          }

          if (ai.isPlayingSpeech) {
            return { index, phase: "playing" };
          }

          return { index: null, phase: "idle" };
        });
      } catch (error) {
        console.error("Speech generation failed:", error);
        Alert.alert("Error", "Failed to play paragraph");
        setSpeechState({ index: null, phase: "idle" });
      }
    },
    [ai, activeSpeechIndex, activeSpeechPhase]
  );

  useEffect(() => {
    setSpeechState((current) => {
      if (ai.isPlayingSpeech) {
        if (current.phase === "loading" && current.index !== null) {
          return { index: current.index, phase: "playing" };
        }
        return current;
      }

      if (current.phase === "idle") {
        return current;
      }

      return { index: null, phase: "idle" };
    });
  }, [ai.isPlayingSpeech]);

  const extractTextFromNode = useCallback((node: any): string => {
    if (!node) return "";

    if (typeof node === "string") return node;

    if (node.content && typeof node.content === "string") {
      return node.content;
    }

    if (Array.isArray(node.children)) {
      return node.children.map(extractTextFromNode).join("");
    }

    if (node.type === "text" && node.content) {
      return node.content;
    }

    return "";
  }, []);
  const markdownRules: RenderRules = useMemo(() => {
    let paragraphIndex = -1;

    return {
      paragraph: (node, children, _parent, renderStyles) => {
        const rawText = extractTextFromNode(node);
        const cleanText = rawText.replace(/[#*_`]/g, "").trim();
        const hasJapanese =
          cleanText && Array.from(cleanText).some((char) => isJapanese(char));

        if (hasJapanese && cleanText) {
          paragraphIndex++;
          const currentIndex = paragraphIndex;

          const paragraphText = japaneseParagraphs[currentIndex] || cleanText;
          const isLoading =
            speechState.index === currentIndex &&
            speechState.phase === "loading";
          const isPlaying =
            speechState.index === currentIndex &&
            speechState.phase === "playing";

          return (
            <View key={node.key} style={renderStyles.paragraph}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    handlePlayParagraph(paragraphText, currentIndex)
                  }
                  style={{
                    marginTop: 2,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={tintColor} />
                  ) : (
                    <IconSymbol
                      name={isPlaying ? "stop.circle.fill" : "play.circle"}
                      size={20}
                      color={tintColor}
                    />
                  )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>{children}</View>
              </View>
            </View>
          );
        }

        return (
          <View key={node.key} style={renderStyles.paragraph}>
            {children}
          </View>
        );
      },
    };
  }, [
    japaneseParagraphs,
    speechState.index,
    speechState.phase,
    tintColor,
    handlePlayParagraph,
    extractTextFromNode,
  ]);

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
      <Markdown style={markdownStyles} rules={markdownRules}>
        {contentOutput}
      </Markdown>

      <View style={styles.actionsContainer}>
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
