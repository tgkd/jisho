import { experimental_streamedQuery as streamedQuery } from "@tanstack/query-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSubscription } from "@/providers/SubscriptionContext";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import { streamRemoteChat } from "@/services/ai-streams";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function useStreamedChat() {
  const ai = useUnifiedAI();
  const subscription = useSubscription();
  const queryClient = useQueryClient();
  const [requestId, setRequestId] = useState(0);
  const messagesRef = useRef<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const prevFetchStatusRef = useRef<string>("idle");

  const isRemote = ai.currentProvider === "remote";

  const query = useQuery({
    queryKey: ["ai-chat", requestId] as const,
    enabled: requestId > 0 && isRemote,
    queryFn: streamedQuery<string, string>({
      streamFn: ({ signal }: { signal: AbortSignal }) => {
        if (!subscription.isPremium) {
          subscription.showPaywall();
          throw new Error("Subscription required for AI chat");
        }
        return streamRemoteChat(messagesRef.current, signal);
      },
      reducer: (prev: string, chunk: string) => prev + chunk,
      initialValue: "",
    }),
    staleTime: Infinity,
    gcTime: 0,
  });

  // Commit assistant message when remote stream completes
  useEffect(() => {
    if (
      prevFetchStatusRef.current === "fetching" &&
      query.fetchStatus === "idle" &&
      query.isSuccess &&
      isRemote
    ) {
      const assistantContent = query.data || "";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: assistantContent,
        };
        return updated;
      });
      messagesRef.current = [
        ...messagesRef.current,
        { role: "assistant", content: assistantContent },
      ];
    }
    prevFetchStatusRef.current = query.fetchStatus;
  }, [query.fetchStatus, query.isSuccess, query.data, isRemote]);

  // For local AI: manual streaming via callbacks
  const localAbortRef = useRef<AbortController | null>(null);
  const [localIsStreaming, setLocalIsStreaming] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMessage: Message = { role: "user", content: trimmed };
      const placeholder: Message = { role: "assistant", content: "" };

      const conversationMessages = [...messagesRef.current, userMessage];
      messagesRef.current = conversationMessages;
      setMessages([...messagesRef.current, placeholder]);

      if (isRemote) {
        setRequestId((id) => id + 1);
      } else {
        localAbortRef.current?.abort();
        const controller = new AbortController();
        localAbortRef.current = controller;
        setLocalIsStreaming(true);

        let accumulated = "";
        try {
          await ai.chatWithMessages(
            conversationMessages,
            {
              onChunk: (chunk: string) => {
                accumulated += chunk;
                const content = accumulated;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content,
                  };
                  return updated;
                });
              },
              onComplete: (fullText: string, error?: string) => {
                setLocalIsStreaming(false);
                const content = error ? `Error: ${error}` : fullText;
                messagesRef.current = [
                  ...messagesRef.current,
                  { role: "assistant", content },
                ];
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content,
                  };
                  return updated;
                });
              },
              onError: (error: string) => {
                setLocalIsStreaming(false);
                const content = `Error: ${error}`;
                messagesRef.current = [
                  ...messagesRef.current,
                  { role: "assistant", content },
                ];
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content,
                  };
                  return updated;
                });
              },
            },
            controller.signal
          );
        } catch (error) {
          if (
            !(error instanceof DOMException && error.name === "AbortError")
          ) {
            setLocalIsStreaming(false);
          }
        }
      }
    },
    [ai, isRemote]
  );

  // Derive display messages: for remote streaming, update the last assistant message with live data
  const displayMessages: Message[] =
    isRemote && query.fetchStatus === "fetching" && query.data !== undefined
      ? messages.map((msg, i) =>
          i === messages.length - 1 && msg.role === "assistant"
            ? { ...msg, content: query.data as string }
            : msg
        )
      : messages;

  const isStreaming = isRemote
    ? query.fetchStatus === "fetching"
    : localIsStreaming;

  const cancel = useCallback(() => {
    if (isRemote) {
      queryClient.cancelQueries({ queryKey: ["ai-chat", requestId] });
    } else {
      localAbortRef.current?.abort();
    }
  }, [isRemote, queryClient, requestId]);

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    setRequestId(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localAbortRef.current?.abort();
    };
  }, []);

  return {
    messages: displayMessages,
    sendMessage,
    isStreaming,
    cancel,
    clearMessages,
    error: isRemote ? query.error : null,
  };
}
