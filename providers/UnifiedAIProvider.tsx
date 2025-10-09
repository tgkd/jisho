import * as Speech from "expo-speech";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react";
import { useMMKVString } from "react-native-mmkv";

import {
  AiExample,
  AiReadingPassage,
  ExplainRequestType,
  getAiExamples,
  getAiExplanation,
  getAiReadingPassage,
  getAiSound
} from "@/services/request";
import { SETTINGS_KEYS } from "@/services/storage";
import { useAudioPlayer } from "expo-audio";
import { useAppleAI } from "./AppleAIProvider";
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

export interface UnifiedAIContextValue {
  // Core AI operations
  generateExamples: (prompt: string) => Promise<AiExample[]>;
  explainText: (
    text: string,
    type: ExplainRequestType,
    streaming: StreamingResponse,
    signal?: AbortSignal
  ) => Promise<void>;
  chatWithMessages: (
    messages: { role: "user" | "assistant"; content: string }[],
    streaming: StreamingResponse,
    signal?: AbortSignal
  ) => Promise<void>;
  generateSpeech: (
    text: string,
    options?: { language?: string; rate?: number }
  ) => Promise<string | undefined>;
  generateReadingPassage: (level: string) => Promise<AiReadingPassage>;
  speakText: (text: string) => Promise<void>;

  // State management
  isGenerating: boolean;
  isAvailable: boolean;
  currentProvider: AIProviderType;

  // Configuration
  setCurrentProvider: (provider: AIProviderType) => void;

  // Utilities
  interrupt: () => void;
}

const UnifiedAIContext = createContext<UnifiedAIContextValue | undefined>(
  undefined
);

export function UnifiedAIProvider({ children }: { children: ReactNode }) {
  const localAI = useAppleAI();
  const subscription = useSubscription();
  const audioPlayer = useAudioPlayer(undefined, {
    keepAudioSessionActive: false,
  });
  const [storedProvider, setStoredProvider] = useMMKVString(
    SETTINGS_KEYS.AI_PROVIDER_TYPE
  );
  const [currentProvider, setCurrentProvider] = useState<AIProviderType>(
    (storedProvider as AIProviderType) || "local"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const isAvailable = localAI.isReady || currentProvider === "remote";

  const checkRemoteAccess = useCallback((featureName: string): boolean => {
    if (currentProvider !== "remote") {
      return true;
    }

    const { allowed } = subscription.canUseAI();
    if (!allowed && !subscription.isPremium) {
      subscription.showPaywall(featureName);
      return false;
    }
    return true;
  }, [currentProvider, subscription]);

  // Update persistent storage when provider changes
  const handleProviderChange = useCallback(
    (provider: AIProviderType) => {
      setCurrentProvider(provider);
      setStoredProvider(provider);
    },
    [setStoredProvider]
  );

  // Track generating state
  useEffect(() => {
    setIsGenerating(localAI.isGenerating);
  }, [localAI.isGenerating]);

  const generateExamples = useCallback(
    async (prompt: string): Promise<AiExample[]> => {
      if (currentProvider === "local") {
        return new Promise((resolve) => {
          localAI.generateExamples(prompt, (examples) => {
            resolve(examples);
          });
        });
      } else {
        if (!checkRemoteAccess("AI Example Generation")) {
          throw new SubscriptionRequiredError("Subscription required for AI examples");
        }

        setIsGenerating(true);
        try {
          const examples = await getAiExamples(prompt);
          subscription.trackAIUsage();
          return examples;
        } finally {
          setIsGenerating(false);
        }
      }
    },
    [currentProvider, localAI, checkRemoteAccess, subscription]
  );

  const explainText = useCallback(
    async (
      text: string,
      type: ExplainRequestType,
      streaming: StreamingResponse,
      signal?: AbortSignal
    ): Promise<void> => {
      try {
        if (currentProvider === "local") {
          await localAI.explainText(
            text,
            type,
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
          if (!checkRemoteAccess("AI Explanations")) {
            streaming.onError("Subscription required for AI explanations");
            return;
          }

          // Remote provider with streaming
          const fetchFn = getAiExplanation(signal);
          const response = await fetchFn(text, type);

          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            const fullText = await response.text();
            streaming.onChunk(fullText);
            streaming.onComplete(fullText);
            subscription.trackAIUsage();
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
            subscription.trackAIUsage();
          } catch (streamError) {
            streaming.onError(`Stream reading error: ${streamError}`);
          }
        }
      } catch (error) {
        streaming.onError(
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [currentProvider, localAI, checkRemoteAccess, subscription]
  );

  const chatWithMessages = useCallback(
    async (
      messages: { role: "user" | "assistant"; content: string }[],
      streaming: StreamingResponse,
      signal?: AbortSignal
    ): Promise<void> => {
      try {
        if (currentProvider === "local") {
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
          if (!checkRemoteAccess("AI Chat")) {
            streaming.onError("Subscription required for AI chat");
            return;
          }

          // Remote provider - send only last user message, backend handles history
          const lastUserMessage = messages[messages.length - 1];
          if (!lastUserMessage || lastUserMessage.role !== "user") {
            streaming.onError("Invalid message format for remote provider");
            return;
          }

          const fetchFn = getAiExplanation(signal);
          const response = await fetchFn(
            lastUserMessage.content,
            ExplainRequestType.V
          );

          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            const fullText = await response.text();
            streaming.onChunk(fullText);
            streaming.onComplete(fullText);
            subscription.trackAIUsage();
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
            subscription.trackAIUsage();
          } catch (streamError) {
            streaming.onError(`Stream reading error: ${streamError}`);
          }
        }
      } catch (error) {
        streaming.onError(
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [currentProvider, localAI, checkRemoteAccess, subscription]
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
    ): Promise<string | undefined> => {
      try {
        if (currentProvider === "remote") {
          if (!checkRemoteAccess("Natural Voice Pronunciation")) {
            throw new SubscriptionRequiredError("Subscription required for cloud TTS");
          }

          const file = await getAiSound(text);
          audioPlayer.replace(file.uri);
          await audioPlayer.play();
          subscription.trackAIUsage();
          return file.base64Sync();
        }

        if (currentProvider === "local" && localAI.isReady) {
          const b64 = localAI.generateSpeech(text);
          await audioPlayer.replace(`data:audio/wav;base64,${b64}`);
          await audioPlayer.play();
        }
      } catch (error) {
        console.warn("Speech failed, falling back to expo-speech:", error);
      }

      Speech.speak(text, {
        language: options.language || "ja",
        rate: options.rate,
      });
    },
    [currentProvider, localAI, audioPlayer, checkRemoteAccess, subscription]
  );

  const generateReadingPassage = useCallback(
    async (level: string): Promise<AiReadingPassage> => {
      if (currentProvider === "local") {
        throw new Error("Reading passage generation not supported on local AI");
      }

      if (!checkRemoteAccess("AI Reading Passages")) {
        throw new SubscriptionRequiredError("Subscription required for AI reading passages");
      }

      setIsGenerating(true);
      try {
        const passage = await getAiReadingPassage(level);
        subscription.trackAIUsage();
        return passage;
      } finally {
        setIsGenerating(false);
      }
    },
    [currentProvider, checkRemoteAccess, subscription]
  );

  const speakText = useCallback(
    async (text: string): Promise<void> => {
      await generateSpeech(text);
    },
    [generateSpeech]
  );

  const interrupt = useCallback(() => {
    if (currentProvider === "local") {
      localAI.interrupt();
    }
    // Note: Remote interruption would need AbortController support
  }, [currentProvider, localAI]);

  const contextValue: UnifiedAIContextValue = {
    generateExamples,
    explainText,
    chatWithMessages,
    generateSpeech,
    generateReadingPassage,
    speakText,
    isGenerating,
    isAvailable,
    currentProvider,
    setCurrentProvider: handleProviderChange,
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
