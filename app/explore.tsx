import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Markdown from "react-native-markdown-display";

import { ChatFooterView } from "@/components/ChatFooter";
import { ChatsHistory } from "@/components/ChatsHistory";
import { MenuActions } from "@/components/MenuActions";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { Colors } from "@/constants/Colors";
import { useTextStream } from "@/hooks/useFetch";
import { useMdStyles } from "@/hooks/useMdStyles";
import { addChat, Chat, getChats, removeChatById } from "@/services/database";
import { ExplainRequestType, getAiExplanation } from "@/services/request";

export default function ExploreScreen() {
  const db = useSQLiteContext();
  const markdownStyles = useMdStyles();
  const scrollRef = useRef<ScrollView>(null);
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
    const chatId = await addChat(db, req, message);
    if (typeof chatId === "number") {
      setChatsHistory((c) => [
        ...c,
        {
          id: 0,
          request: req,
          createdAt: new Date().toISOString(),
          response: message,
        },
      ]);
      setCurrentResponse("");
    }
  };

  const stream = useTextStream(
    getAiExplanation(),
    (chunk) => {
      setCurrentResponse((t) => t + chunk);
      scrollRef.current?.scrollToEnd({ animated: true });
    },
    handleAddChatAndSeparator
  );

  const handleSubmit = useCallback(
    async (query: string, type: ExplainRequestType) => {
      const text = query.trim();

      if (text.length === 0) {
        return;
      }

      try {
        setCurrentResponse("");
        await stream.fetchData(query, type);
      } catch (error) {
        console.error("Search failed:", error);
      }
    },
    [stream]
  );

  return (
    <KeyboardAvoidingView
      behavior="translate-with-padding"
      keyboardVerticalOffset={96}
      style={styles.container}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.scrollContainer}
        keyboardDismissMode="on-drag"
        removeClippedSubviews={true}
      >
        <ChatsHistory chats={chatsHistory} handleDelete={handleDelete} />

        {currentResponse.length ? (
          <Card
            lightColor={Colors.light.secondaryBackground}
            darkColor={Colors.dark.secondaryBackground}
          >
            <Markdown style={markdownStyles}>{currentResponse}</Markdown>
          </Card>
        ) : null}

        {!chatsHistory.length && !currentResponse.length ? (
          <ThemedText textAlign="center" type="secondary">
            {"Ask me anything"}
          </ThemedText>
        ) : null}
      </ScrollView>
      <ChatFooterView handleSubmit={handleSubmit} loading={stream.isLoading} />
    </KeyboardAvoidingView>
  );
}

function getTitle(reqParams: any[], msg: string) {
  if (!reqParams || reqParams.length === 0) {
    return Math.random().toString(36).slice(2, 10);
  }

  const resp = reqParams[0];

  if (typeof resp !== "string") {
    return Math.random().toString(36).slice(2, 10);
  }

  if (resp.length < 36) {
    return resp.slice(0, 36);
  }

  return reqParams?.[0] && typeof reqParams[0] === "string"
    ? reqParams[0].slice(0, 36) + "…"
    : msg.slice(0, 36) + "…";
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
});
