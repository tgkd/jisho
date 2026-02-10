import { FlashList, FlashListRef } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Markdown from "react-native-markdown-display";

import { ChatFooterView } from "@/components/ChatFooter";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useMdStyles } from "@/hooks/useMdStyles";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import { Button, Host } from "@expo/ui/swift-ui";
import {
  disabled,
  labelStyle
} from "@expo/ui/swift-ui/modifiers";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatScreen() {
  const markdownStyles = useMdStyles();
  const ai = useUnifiedAI();
  const params = useLocalSearchParams<{
    word?: string;
    reading?: string;
    meanings?: string;
    initialPrompt?: string;
  }>();
  const scrollRef = useRef<FlashListRef<Message>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const defaultColor = useThemeColor({}, "text");

  const updateMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const copyMessage = useCallback(async (content: string) => {
    await Clipboard.setStringAsync(content);
  }, []);

  const handleSubmit = useCallback(
    async (query: string) => {
      const text = query.trim();

      if (text.length === 0 || isGenerating) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setIsGenerating(true);

        const userMessage: Message = { role: "user", content: text };
        const placeholderAssistant: Message = {
          role: "assistant",
          content: "",
        };

        const currentMessages = messagesRef.current;
        const updatedUIMessages: Message[] = [
          ...currentMessages,
          userMessage,
          placeholderAssistant,
        ];
        updateMessages(() => updatedUIMessages);

        const conversationMessages = [...currentMessages, userMessage];
        let accumulatedContent = "";

        await ai.chatWithMessages(conversationMessages, {
          onChunk: (chunk: string) => {
            accumulatedContent += chunk;
            const content = accumulatedContent;
            updateMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                role: "assistant",
                content,
              };
              return newMessages;
            });
            scrollRef.current?.scrollToEnd({ animated: true });
          },
          onComplete: (_fullResponse: string, error?: string) => {
            setIsGenerating(false);
            scrollRef.current?.scrollToEnd({ animated: true });

            if (error) {
              console.error("AI error:", error);
              updateMessages((prev) => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: `Error: ${error}`,
                };
                return newMessages;
              });
            }
          },
          onError: (error: string) => {
            console.error("AI error:", error);
            setIsGenerating(false);
            updateMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                role: "assistant",
                content: `Error: ${error}`,
              };
              return newMessages;
            });
          },
        }, controller.signal);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Chat failed:", error);
        }
        setIsGenerating(false);
      }
    },
    [ai, isGenerating, updateMessages],
  );

  useEffect(() => {
    if (!initialized && params.initialPrompt) {
      setInitialized(true);
      handleSubmit(params.initialPrompt);
    }
  }, [initialized, params, handleSubmit]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      return (
        <View>
          <Card
            lightColor={
              item.role === "user"
                ? Colors.light.background
                : Colors.light.secondaryBackground
            }
            darkColor={
              item.role === "user"
                ? Colors.dark.background
                : Colors.dark.secondaryBackground
            }
          >
            <View style={styles.chatItem}>
              {item.role === "user" ? (
                <ThemedText type="defaultSemiBold" style={styles.userMessage}>
                  {item.content}
                </ThemedText>
              ) : (
                <Markdown style={markdownStyles}>
                  {item.content || "..."}
                </Markdown>
              )}
            </View>
          </Card>
          {item.role === "assistant" && item.content.length > 0 && (
            <View style={styles.messageActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => copyMessage(item.content)}
                hitSlop={8}
              >
                <IconSymbol name="doc.on.doc" size={16} color={defaultColor} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    },
    [markdownStyles, copyMessage, defaultColor],
  );

  const renderEmpty = useCallback(
    () =>
      !messages.length ? (
        <View style={styles.emptyMsg}>
          <ThemedText size="xs" type="secondary">
            AI-generated content may contain errors or inaccuracies. Please
            verify important information with reliable sources.
          </ThemedText>
          <ThemedText size="xs" type="secondary">
            All messages are temporary and will disappear after closing the
            chat.
          </ThemedText>
        </View>
      ) : null,
    [messages],
  );

  const clearMessages = useCallback(() => {
    if (isGenerating) {
      return;
    }
    abortRef.current?.abort();
    updateMessages(() => []);
    setInitialized(false);
  }, [isGenerating, updateMessages]);

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: ({ children }) => (
            <ThemedText type="title" style={{ flex: 1 }}>
              {children}
            </ThemedText>
          ),
          headerRight: () => (
            <Host style={{ width: 35, height: 35 }}>
              <Button
                role="destructive"
                label="Clear"
                systemImage={"trash"}
                onPress={clearMessages}
                modifiers={[
                  labelStyle("iconOnly"),
                  disabled(isGenerating || messages.length === 0),
                ]}
              />
            </Host>
          ),
        }}
      />
      <FlashList
        contentInsetAdjustmentBehavior="automatic"
        ref={scrollRef}
        estimatedItemSize={120}
        style={styles.list}
        contentContainerStyle={styles.scrollContainer}
        keyboardDismissMode="on-drag"
        renderItem={renderItem}
        data={messages}
        ListEmptyComponent={renderEmpty}
      />
      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={32}
      >
        <ChatFooterView handleSubmit={handleSubmit} loading={isGenerating} />
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    height: "100%",
  },
  scrollContainer: {
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyMsg: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  chatItem: {
    gap: 8,
  },
  messageActions: {
    flexDirection: "row",
    paddingTop: 4,
    paddingLeft: 4,
  },
  actionButton: {
    width: 28,
    height: 28,
  },
  userMessage: {
    opacity: 0.8,
  },
});
