import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Markdown from "react-native-markdown-display";

import { ChatFooterView } from "@/components/ChatFooter";
import { ChatsHistory } from "@/components/ChatsHistory";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { Colors } from "@/constants/Colors";
import { useTextStream } from "@/hooks/useFetch";
import { useMdStyles } from "@/hooks/useMdStyles";
import { addChat, Chat, getChats, removeChatById } from "@/services/database";
import { getAiExplanation } from "@/services/request";

export default function ExploreScreen() {
  const db = useSQLiteContext();
  const markdownStyles = useMdStyles();
  const [chatsHistory, setChatsHistory] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
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
    const req =
      reqParams?.[0] && typeof reqParams[0] === "string"
        ? reqParams[0].slice(0, 36) + "…"
        : message.slice(0, 36) + "…";
    await addChat(db, req, message);
    setMessages((m) => [...m, message]);
    setCurrentResponse("");
  };

  const stream = useTextStream(
    getAiExplanation(),
    (chunk) => {
      setCurrentResponse((t) => t + chunk);
    },
    handleAddChatAndSeparator
  );

  const handleSubmit = useCallback(
    async (query: string) => {
      const text = query.trim();

      if (text.length === 0) {
        return;
      }

      try {
        setCurrentResponse("");
        await stream.fetchData(query);
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
        contentContainerStyle={styles.scrollContainer}
        keyboardDismissMode="on-drag"
      >
        {messages.map((m, idx) => (
          <Card
            key={idx}
            lightColor={Colors.light.secondaryBackground}
            darkColor={Colors.dark.secondaryBackground}
          >
            <Markdown style={markdownStyles}>{m}</Markdown>
          </Card>
        ))}
        {currentResponse.length ? (
          <Card
            lightColor={Colors.light.secondaryBackground}
            darkColor={Colors.dark.secondaryBackground}
          >
            <Markdown style={markdownStyles}>{currentResponse}</Markdown>
          </Card>
        ) : null}
        {chatsHistory.length && !messages.length && !currentResponse.length ? (
          <ChatsHistory chats={chatsHistory} handleDelete={handleDelete} />
        ) : null}
        {!messages.length && !chatsHistory.length ? (
          <ThemedText textAlign="center" type="secondary">
            {"Ask me anything"}
          </ThemedText>
        ) : null}
      </ScrollView>
      <ChatFooterView handleSubmit={handleSubmit} loading={stream.isLoading} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingTop: 24,
    paddingBottom: 96,
    paddingHorizontal: 16,
    gap: 8
  },
});
