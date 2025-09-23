import { FlashList, FlashListRef } from "@shopify/flash-list";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Markdown from "react-native-markdown-display";

import { ChatFooterView } from "@/components/ChatFooter";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { Colors } from "@/constants/Colors";
import { useMdStyles } from "@/hooks/useMdStyles";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ExploreScreen() {
  const markdownStyles = useMdStyles();
  const ai = useUnifiedAI();
  const scrollRef = useRef<FlashListRef<Message>>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleSubmit = useCallback(
    async (query: string) => {
      const text = query.trim();

      if (text.length === 0 || isGenerating) {
        return;
      }

      try {
        setIsGenerating(true);

        // Add user message and placeholder assistant message to UI
        const userMessage: Message = { role: 'user', content: text };
        const placeholderAssistant: Message = { role: 'assistant', content: '' };

        const updatedUIMessages: Message[] = [
          ...messages,
          userMessage,
          placeholderAssistant,
        ];
        setMessages(updatedUIMessages);

        // Send only messages up to the user message (no empty assistant message)
        const conversationMessages = [...messages, userMessage];
        const assistantMessageIndex = updatedUIMessages.length - 1;
        let accumulatedContent = '';

        await ai.chatWithMessages(conversationMessages, {
          onChunk: (chunk: string) => {
            accumulatedContent += chunk;
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[assistantMessageIndex] = {
                role: 'assistant',
                content: accumulatedContent,
              };
              return newMessages;
            });
            scrollRef.current?.scrollToEnd({ animated: true });

          },
          onComplete: (_fullResponse: string, error?: string) => {
            setIsGenerating(false);

            if (error) {
              console.error("AI error:", error);
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[assistantMessageIndex] = {
                  role: 'assistant',
                  content: `Error: ${error}`,
                };
                return newMessages;
              });
              return;
            }

          },
          onError: (error: string) => {
            console.error("AI error:", error);
            setIsGenerating(false);
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[assistantMessageIndex] = {
                role: 'assistant',
                content: `Error: ${error}`,
              };
              return newMessages;
            });
          },
        });
      } catch (error) {
        console.error("Search failed:", error);
        setIsGenerating(false);
      }
    },
    [ai, messages, isGenerating, scrollRef]
  );

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <Card
        lightColor={
          item.role === 'user'
            ? Colors.light.background
            : Colors.light.secondaryBackground
        }
        darkColor={
          item.role === 'user'
            ? Colors.dark.background
            : Colors.dark.secondaryBackground
        }
      >
        <View style={styles.chatItem}>
          {item.role === 'user' ? (
            <ThemedText type="defaultSemiBold" style={styles.userMessage}>
              {item.content}
            </ThemedText>
          ) : (
            <Markdown style={markdownStyles}>
              {item.content || '...'}
            </Markdown>
          )}
        </View>
      </Card>
    ),
    [markdownStyles]
  );

  const renderEmpty = useCallback(
    () =>
      !messages.length ? (
        <View style={styles.emptyMsg}>
          <ThemedText textAlign="center" type="secondary">
            {
              "All messages are temporary and will disappear after closing the chat."
            }
          </ThemedText>
        </View>
      ) : null,
    [messages]
  );

  return (
    <>
      <FlashList
        contentInsetAdjustmentBehavior="automatic"
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.scrollContainer}
        keyboardDismissMode="on-drag"
        renderItem={renderItem}
        data={messages}
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
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
  container: {
    flex: 1,
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
  emptyMsg: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  chatItem: {
    gap: 8,
  },
  query: {
    opacity: 0.8,
  },
  userMessage: {
    opacity: 0.8,
  },
});
