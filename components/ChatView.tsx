import { FlashList, FlashListRef } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import { Stack } from "expo-router";
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
import { useStreamedChat } from "@/hooks/useStreamedChat";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Button, Host } from "@expo/ui/swift-ui";
import {
  disabled,
  labelStyle
} from "@expo/ui/swift-ui/modifiers";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatViewProps {
  word?: string;
  reading?: string;
  meanings?: string;
  initialPrompt?: string;
}

export function ChatView({ initialPrompt }: ChatViewProps) {
  const markdownStyles = useMdStyles();
  const scrollRef = useRef<FlashListRef<Message>>(null);
  const [initialized, setInitialized] = useState(false);
  const defaultColor = useThemeColor({}, "text");

  const {
    messages,
    sendMessage,
    isStreaming,
    cancel,
    clearMessages: hookClearMessages,
  } = useStreamedChat();

  const copyMessage = useCallback(async (content: string) => {
    await Clipboard.setStringAsync(content);
  }, []);

  const handleSubmit = useCallback(
    async (query: string) => {
      const text = query.trim();
      if (text.length === 0 || isStreaming) return;
      await sendMessage(text);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    },
    [isStreaming, sendMessage]
  );

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [isStreaming, messages]);

  useEffect(() => {
    if (!initialized && initialPrompt) {
      setInitialized(true);
      handleSubmit(initialPrompt);
    }
  }, [initialized, initialPrompt, handleSubmit]);

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
    if (isStreaming) return;
    cancel();
    hookClearMessages();
    setInitialized(false);
  }, [isStreaming, cancel, hookClearMessages]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Host matchContents>
              <Button
                role="destructive"
                label="Clear"
                systemImage={"trash"}
                onPress={clearMessages}
                modifiers={[
                  labelStyle("iconOnly"),
                  disabled(isStreaming || messages.length === 0),
                ]}
              />
            </Host>
          ),
        }}
      />
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
        keyboardVerticalOffset={64}
      >
        <ChatFooterView handleSubmit={handleSubmit} loading={isStreaming} offsetBottom={16} />
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
