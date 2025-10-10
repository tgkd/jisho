import { ChatFooterView } from "@/components/ChatFooter";
import { ChatMessage } from "@/components/ChatMessage";
import { ThemedText } from "@/components/ThemedText";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import {
  getMessages,
  getSession,
  saveMessage,
  type PracticeMessage,
  type PracticeSession,
} from "@/services/database/practice-sessions";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView, KeyboardController } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const ai = useUnifiedAI();
  const flashListRef = useRef<FlashListRef<PracticeMessage>>(null);

  const [session, setSession] = useState<PracticeSession | null>(null);
  const [messages, setMessages] = useState<PracticeMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const loadSessionData = async () => {
    try {
      setIsLoading(true);
      const sessionData = await getSession(db, Number(sessionId));
      if (!sessionData) {
        Alert.alert("Error", "Practice session not found");
        router.back();
        return;
      }

      setSession(sessionData);
      const messagesData = await getMessages(db, Number(sessionId));
      setMessages(messagesData);
    } catch (error) {
      console.error("Failed to load session:", error);
      Alert.alert("Error", "Failed to load practice session");
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || !session || isGenerating) return;

      try {
        setIsGenerating(true);

        const userMessageId = await saveMessage(
          db,
          Number(sessionId),
          "user",
          text
        );
        const userMessage: PracticeMessage = {
          id: userMessageId,
          session_id: Number(sessionId),
          role: "user",
          content: text,
          timestamp: Date.now(),
        };

        const placeholderAssistant: PracticeMessage = {
          id: -1,
          session_id: Number(sessionId),
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        };

        const updatedUIMessages = [
          ...messages,
          userMessage,
          placeholderAssistant,
        ];
        setMessages(updatedUIMessages);

        const conversationHistory = [...messages, userMessage].map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const assistantMessageIndex = updatedUIMessages.length - 1;
        let accumulatedContent = "";

        await ai.chatWithPractice(session.level, conversationHistory, {
          onChunk: (chunk: string) => {
            accumulatedContent += chunk;
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[assistantMessageIndex] = {
                ...newMessages[assistantMessageIndex],
                content: accumulatedContent,
              };
              return newMessages;
            });
          },
          onComplete: async (fullText: string, error?: string) => {
            setIsGenerating(false);
            flashListRef.current?.scrollToEnd({ animated: true });

            if (error) {
              console.error("AI error:", error);
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[assistantMessageIndex] = {
                  ...newMessages[assistantMessageIndex],
                  content: `Error: ${error}`,
                };
                return newMessages;
              });
              return;
            }

            const assistantMessageId = await saveMessage(
              db,
              Number(sessionId),
              "assistant",
              fullText
            );

            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[assistantMessageIndex] = {
                ...newMessages[assistantMessageIndex],
                id: assistantMessageId,
                content: fullText,
              };
              return newMessages;
            });
          },
          onError: (error: string) => {
            console.error("AI error:", error);
            setIsGenerating(false);
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[assistantMessageIndex] = {
                ...newMessages[assistantMessageIndex],
                content: `Error: ${error}`,
              };
              return newMessages;
            });
          },
        });
      } catch (error) {
        console.error("Failed to send message:", error);
        setIsGenerating(false);
        Alert.alert("Error", "Failed to send message");
      }
    },
    [ai, db, session, messages, isGenerating, sessionId]
  );

  const handleWordPress = (word: string) => {
    router.push(`/word?query=${encodeURIComponent(word)}` as any);
  };

  const handlePlayAudio = async (messageId: number, content: string) => {
    try {
      setPlayingMessageId(messageId);
      await ai.speakText(content);
    } catch (error) {
      console.error("Failed to play audio:", error);
      Alert.alert("Error", "Failed to play audio");
    } finally {
      setPlayingMessageId(null);
    }
  };

  const renderMessage = ({ item }: { item: PracticeMessage }) => (
    <ChatMessage
      role={item.role}
      content={item.content}
      timestamp={item.timestamp}
      onWordPress={handleWordPress}
      onPlayAudio={
        item.role === "assistant" && item.id !== -1
          ? () => handlePlayAudio(item.id, item.content)
          : undefined
      }
      isPlaying={playingMessageId === item.id}
    />
  );

  const renderEmpty = useCallback(
    () =>
      !messages.length && session ? (
        <View style={styles.emptyState}>
          <ThemedText size="md" type="secondary" style={styles.emptyText}>
            Start practicing Japanese at {session.level} level!
          </ThemedText>
          <ThemedText size="sm" type="secondary" style={styles.emptyHint}>
            Send a message to begin your conversation
          </ThemedText>
        </View>
      ) : null,
    [messages, session]
  );

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

  return (
    <>
      <FlashList
        contentInsetAdjustmentBehavior="automatic"
        ref={flashListRef}
        style={styles.list}
        contentContainerStyle={styles.scrollContainer}
        keyboardDismissMode="on-drag"
        renderItem={renderMessage}
        data={messages}
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={32}
      >
        <ChatFooterView
          handleSubmit={handleSendMessage}
          loading={isGenerating}
        />
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    height: "100%",
  },
  scrollContainer: {
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyState: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontWeight: "500",
    textAlign: "center",
  },
  emptyHint: {
    textAlign: "center",
  },
});
