import { useLocalSearchParams } from "expo-router";

import { ChatView } from "@/components/ChatView";

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    word?: string;
    reading?: string;
    meanings?: string;
    initialPrompt?: string;
  }>();

  return <ChatView {...params} />;
}
