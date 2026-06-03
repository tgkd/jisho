import type { UIMessage } from "@tanstack/ai-react";
import { useChat } from "@tanstack/ai-react";
import { useCallback, useMemo } from "react";

import { useSubscription } from "@/providers/SubscriptionContext";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import { buildChatConnection } from "@/services/ai/connection";
import { appleLocalAdapter } from "@/services/ai/local-adapter";
import { SETTINGS_KEYS, settingsStorage } from "@/services/storage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Read the RevenueCat user id used to authenticate remote AI requests.
 * @returns {string | undefined} The stored user id, if any.
 */
function getUserId(): string | undefined {
  return settingsStorage.getString(SETTINGS_KEYS.REVENUECAT_USER_ID);
}

/**
 * Flatten a UIMessage's typed parts into the plain text the chat UI renders.
 * @param {UIMessage} message - A useChat message.
 * @returns {string} The concatenated text content.
 */
function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("content" in part ? (part.content ?? "") : ""))
    .join("");
}

/**
 * Tutor chat backed by TanStack AI `useChat`. A single runtime-switched
 * connection serves both the remote worker (`/v2/chat`) and the on-device
 * provider, so the UI is provider-agnostic. The provider is encoded in the
 * client `id` so toggling it spins up a fresh client with the right transport.
 * @returns Chat state with the legacy `{ messages, sendMessage, isStreaming,
 *   cancel, clearMessages, error }` shape consumed by ChatView.
 */
export function useStreamedChat() {
  const ai = useUnifiedAI();
  const subscription = useSubscription();
  const provider = ai.currentProvider;
  const isRemote = provider === "remote";

  const connection = useMemo(
    () =>
      buildChatConnection({ provider, getUserId, local: appleLocalAdapter }),
    [provider],
  );

  const {
    messages: uiMessages,
    sendMessage: sendChatMessage,
    isLoading,
    error,
    stop,
    clear,
  } = useChat({ id: `chat-${provider}`, connection });

  const messages: Message[] = useMemo(
    () =>
      uiMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: messageText(m),
        })),
    [uiMessages],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (isRemote && !subscription.isPremium) {
        subscription.showPaywall();
        return;
      }
      await sendChatMessage(trimmed);
    },
    [isRemote, subscription, sendChatMessage],
  );

  return {
    messages,
    sendMessage,
    isStreaming: isLoading,
    cancel: stop,
    clearMessages: clear,
    error: error ?? null,
  };
}
