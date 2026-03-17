import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState
} from "react";
import { useMMKVString } from "react-native-mmkv";

import {
  AiExample,
  getAiChat,
  getAiExamples,
  getAiSound
} from "@/services/request";
import { SETTINGS_KEYS } from "@/services/storage";
import { useAppleAI } from "./AppleAIProvider";
import { useSpeech } from "./SpeechProvider";
import { useSubscription } from "./SubscriptionContext";

export type AIProviderType = "local" | "remote";

export interface StreamingResponse {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string, error?: string) => void;
  onError: (error: string) => void;
}

class SubscriptionRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionRequiredError";
  }
}

export async function readResponseStream(
  response: Response,
  streaming: StreamingResponse
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    const fullText = await response.text();
    streaming.onChunk(fullText);
    streaming.onComplete(fullText);
    return;
  }

  const decoder = new TextDecoder();
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      streaming.onChunk(chunk);
    }

    const remaining = decoder.decode();
    if (remaining) {
      fullText += remaining;
      streaming.onChunk(remaining);
    }

    streaming.onComplete(fullText);
  } catch (streamError) {
    streaming.onError(`Stream reading error: ${streamError}`);
  }
}

export interface UnifiedAIContextValue {
  generateExamples: (prompt: string) => Promise<AiExample[]>;
  chatWithMessages: (
    messages: { role: "user" | "assistant"; content: string }[],
    streaming: StreamingResponse,
    signal?: AbortSignal
  ) => Promise<void>;
  generateSpeech: (
    text: string,
    options?: { language?: string; rate?: number }
  ) => Promise<void>;

  isGenerating: boolean;
  isAvailable: boolean;
  currentProvider: AIProviderType;
  setCurrentProvider: (provider: AIProviderType) => void;
  interrupt: () => void;
}

const UnifiedAIContext = createContext<UnifiedAIContextValue | undefined>(
  undefined
);

export function UnifiedAIProvider({ children }: { children: ReactNode }) {
  const localAI = useAppleAI();
  const subscription = useSubscription();
  const speech = useSpeech();
  const [currentProvider, setCurrentProvider] = useMMKVString(
    SETTINGS_KEYS.AI_PROVIDER_TYPE
  );
  const provider = (currentProvider as AIProviderType) || "local";
  const [isGenerating, setIsGenerating] = useState(false);
  const isAvailable = localAI.isReady || provider === "remote";

  const checkRemoteAccess = useCallback((): boolean => {
    if (provider !== "remote") {
      return true;
    }

    if (!subscription.isPremium) {
      subscription.showPaywall();
      return false;
    }
    return true;
  }, [provider, subscription]);

  const generateExamples = useCallback(
    async (prompt: string): Promise<AiExample[]> => {
      if (provider === "local") {
        return new Promise((resolve) => {
          localAI.generateExamples(prompt, (examples) => {
            resolve(examples);
          });
        });
      } else {
        if (!checkRemoteAccess()) {
          throw new SubscriptionRequiredError(
            "Subscription required for AI examples"
          );
        }

        setIsGenerating(true);
        try {
          const examples = await getAiExamples(prompt);
          return examples;
        } finally {
          setIsGenerating(false);
        }
      }
    },
    [provider, localAI, checkRemoteAccess]
  );

  const chatWithMessages = useCallback(
    async (
      messages: { role: "user" | "assistant"; content: string }[],
      streaming: StreamingResponse,
      signal?: AbortSignal
    ): Promise<void> => {
      try {
        if (provider === "local") {
          await localAI.chatWithMessages(
            messages,
            streaming.onChunk,
            (fullResponse, error) => {
              if (error) {
                streaming.onError(error);
              } else {
                streaming.onComplete(fullResponse);
              }
            }
          );
        } else {
          if (!checkRemoteAccess()) {
            streaming.onError("Subscription required for AI chat");
            return;
          }

          const fetchFn = getAiChat(signal);
          const response = await fetchFn(messages);

          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }

          await readResponseStream(response, streaming);
        }
      } catch (error) {
        streaming.onError(
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [provider, localAI, checkRemoteAccess]
  );

  const generateSpeech = useCallback(
    async (
      text: string,
      options: {
        language?: string;
        rate?: number;
      } = {
        language: "ja",
        rate: 0.8,
      }
    ): Promise<void> => {
      try {
        if (provider === "remote") {
          if (!checkRemoteAccess()) {
            throw new SubscriptionRequiredError(
              "Subscription required for cloud TTS"
            );
          }

          const file = await getAiSound(text);
          await speech.playAudio(file.uri);
          return;
        }

        if (provider === "local" && localAI.isReady) {
          const b64 = await localAI.generateSpeech(text);
          if (!b64) throw new Error("Local AI returned no audio data");
          await speech.playAudio(`data:audio/wav;base64,${b64}`);
          return;
        }
      } catch (error) {
        console.warn("Speech failed, falling back to expo-speech:", error);
      }

      speech.speakText(text, {
        language: options.language || "ja",
        rate: options.rate,
      });
    },
    [provider, localAI, speech, checkRemoteAccess]
  );

  const interrupt = useCallback(() => {
    if (provider === "local") {
      localAI.interrupt();
    }
  }, [provider, localAI]);

  const contextValue: UnifiedAIContextValue = {
    generateExamples,
    chatWithMessages,
    generateSpeech,
    isGenerating: isGenerating || localAI.isGenerating,
    isAvailable,
    currentProvider: provider,
    setCurrentProvider,
    interrupt,
  };

  return (
    <UnifiedAIContext.Provider value={contextValue}>
      {children}
    </UnifiedAIContext.Provider>
  );
}

export function useUnifiedAI(): UnifiedAIContextValue {
  const context = useContext(UnifiedAIContext);
  if (!context) {
    throw new Error("useUnifiedAI must be used within UnifiedAIProvider");
  }
  return context;
}
