import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Markdown from "react-native-markdown-display";
import Animated, { LinearTransition } from "react-native-reanimated";

import { ChatFooterView } from "@/components/ChatFooter";
import { ChatListItem } from "@/components/ChatItem";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { Colors } from "@/constants/Colors";
import { useMdStyles } from "@/hooks/useMdStyles";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import { addChat, Chat, getChats, removeChatById } from "@/services/database";
import { ExplainRequestType } from "@/services/request";

export default function ExploreScreen() {
  const db = useSQLiteContext();
  const markdownStyles = useMdStyles();
  const ai = useUnifiedAI();
  const scrollRef = useRef<Animated.FlatList<Chat>>(null);
  const [chatsHistory, setChatsHistory] = useState<Chat[]>([]);
  const [currentResponse, setCurrentResponse] = useState<string>("");

  useEffect(() => {
    const fetchChats = async () => {
      const chats = await getChats(db);
      setChatsHistory(chats);
    };

    fetchChats();
  }, []);

  const handleDelete = async (id: number) => {
    await removeChatById(db, id);
    setChatsHistory((t) => t.filter((c) => c.id !== id));
  };

  const handleAddChatAndSeparator = async (
    message: string,
    reqParams: any[]
  ) => {
    const req = getTitle(reqParams, message);
    const newChat = await addChat(db, req, message);
    if (newChat) {
      setChatsHistory((c) => [...c, newChat]);
      setCurrentResponse("");
    }
  };

  // Remove stream hook - we'll handle streaming directly in handleSubmit

  const handleSubmit = useCallback(
    async (query: string, type: ExplainRequestType) => {
      const text = query.trim();

      if (text.length === 0) {
        return;
      }

      try {
        setCurrentResponse("");

        await ai.explainText(query, type, {
          onChunk: (chunk: string) => {
            setCurrentResponse((prev) => prev + chunk);
            scrollRef.current?.scrollToEnd({ animated: true });
          },
          onComplete: async (fullResponse: string, error?: string) => {
            if (error) {
              console.error("AI error:", error);
              setCurrentResponse("");
              return;
            }

            if (fullResponse) {
              await handleAddChatAndSeparator(fullResponse, [query]);
            }
          },
          onError: (error: string) => {
            console.error("AI error:", error);
            setCurrentResponse("");
          }
        });
      } catch (error) {
        console.error("Search failed:", error);
      }
    },
    [ai, handleAddChatAndSeparator, scrollRef]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Chat; index: number }) => (
      <ChatListItem
        data={item}
        handleDelete={handleDelete}
        isLast={index === chatsHistory.length - 1}
      />
    ),
    [chatsHistory]
  );

  const renderFooter = useCallback(
    () =>
      currentResponse?.length ? (
        <Card
          lightColor={Colors.light.secondaryBackground}
          darkColor={Colors.dark.secondaryBackground}
        >
          <Markdown style={markdownStyles}>{currentResponse}</Markdown>
        </Card>
      ) : null,
    [currentResponse, markdownStyles]
  );

  const renderEmpty = useCallback(
    () =>
      !chatsHistory.length && !currentResponse.length ? (
        <View style={styles.emptyMsg}>
          <ThemedText textAlign="center" type="secondary">
            {"Ask me anything"}
          </ThemedText>
        </View>
      ) : null,
    [chatsHistory, currentResponse]
  );

  return (
    <KeyboardAvoidingView
      behavior="translate-with-padding"
      keyboardVerticalOffset={96}
      style={styles.container}
    >
      <Animated.FlatList
        itemLayoutAnimation={LinearTransition}
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.scrollContainer}
        keyboardDismissMode="on-drag"
        removeClippedSubviews={true}
        renderItem={renderItem}
        data={chatsHistory}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
      />

      <ChatFooterView
        handleSubmit={handleSubmit}
        loading={ai.isGenerating}
      />
    </KeyboardAvoidingView>
  );
}

function getTitle(reqParams: any[], msg: string) {
  if (!reqParams) {
    return msg;
  }
  return reqParams?.[0] && typeof reqParams[0] === "string"
    ? reqParams[0]
    : msg;
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
});
