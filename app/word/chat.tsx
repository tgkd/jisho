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
import { useThemeColor } from "@/hooks/useThemeColor";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import { ExplainRequestType } from "@/services/request";

interface TemporaryChat {
  id: number;
  query: string;
  response: string;
}

export default function ExploreScreen() {
  const markdownStyles = useMdStyles();
  const backgroundColor = useThemeColor({}, "background");
  const ai = useUnifiedAI();
  const scrollRef = useRef<FlashListRef<TemporaryChat>>(null);
  const [chatsHistory, setChatsHistory] = useState<TemporaryChat[]>([]);
  const [currentResponse, setCurrentResponse] = useState<string>("");
  const [currentQuery, setCurrentQuery] = useState<string>("");
  const [nextId, setNextId] = useState<number>(1);

  const handleAddChat = useCallback((query: string, response: string) => {
    const newChat: TemporaryChat = {
      id: nextId,
      query,
      response,
    };
    setChatsHistory((c) => [...c, newChat]);
    setNextId(prev => prev + 1);
    setCurrentResponse("");
    setCurrentQuery("");
  }, [nextId]);

  const handleSubmit = useCallback(
    async (query: string) => {
      const text = query.trim();

      if (text.length === 0) {
        return;
      }

      try {
        setCurrentResponse("");
        setCurrentQuery(query);

        await ai.explainText(query, ExplainRequestType.V, {
          onChunk: (chunk: string) => {
            setCurrentResponse((prev) => prev + chunk);

          },
          onComplete: (fullResponse: string, error?: string) => {
            if (error) {
              console.error("AI error:", error);
              setCurrentResponse("");
              setCurrentQuery("");
              return;
            }

            if (fullResponse) {
              scrollRef.current?.scrollToEnd({ animated: true });
              handleAddChat(query, fullResponse);
            }
          },
          onError: (error: string) => {
            console.error("AI error:", error);
            setCurrentResponse("");
            setCurrentQuery("");
          }
        });
      } catch (error) {
        console.error("Search failed:", error);
      }
    },
    [ai, handleAddChat, scrollRef]
  );

  const renderItem = useCallback(
    ({ item }: { item: TemporaryChat }) => (
      <Card
        lightColor={Colors.light.secondaryBackground}
        darkColor={Colors.dark.secondaryBackground}
      >
        <View style={styles.chatItem}>
          <ThemedText type="defaultSemiBold" style={styles.query}>
            {item.query}
          </ThemedText>
          <Markdown style={markdownStyles}>{item.response}</Markdown>
        </View>
      </Card>
    ),
    [markdownStyles]
  );

  const renderFooter = useCallback(
    () =>
      currentResponse?.length || currentQuery?.length ? (
        <Card
          lightColor={Colors.light.secondaryBackground}
          darkColor={Colors.dark.secondaryBackground}
        >
          <View style={styles.chatItem}>
            {currentQuery && (
              <ThemedText type="defaultSemiBold" style={styles.query}>
                {currentQuery}
              </ThemedText>
            )}
            {currentResponse && (
              <Markdown style={markdownStyles}>{currentResponse}</Markdown>
            )}
          </View>
        </Card>
      ) : null,
    [currentResponse, currentQuery, markdownStyles]
  );

  const renderEmpty = useCallback(
    () =>
      !chatsHistory.length && !currentResponse.length ? (
        <View style={styles.emptyMsg}>
          <ThemedText textAlign="center" type="secondary">
            {"No messages yet. Start by asking a question!"}
          </ThemedText>
        </View>
      ) : null,
    [chatsHistory, currentResponse]
  );

  return (
    <KeyboardAvoidingView
      behavior="translate-with-padding"
      keyboardVerticalOffset={32}
      style={[styles.container, { backgroundColor }]}
    >
      <FlashList
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.scrollContainer}
        keyboardDismissMode="on-drag"
        renderItem={renderItem}
        data={chatsHistory}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      <ChatFooterView
        handleSubmit={handleSubmit}
        loading={ai.isGenerating}
      />
    </KeyboardAvoidingView>
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
});
