import * as Speech from "expo-speech";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useMMKVString } from "react-native-mmkv";

import {
  AiExample,
  getAiChat,
  getAiExamples,
  getAiExplanation,
  getAiReadingPassage,
  getAiSound,
} from "@/services/request";
import { SETTINGS_KEYS } from "@/services/storage";
import { useAudioPlayer } from "expo-audio";
import { useAppleAI } from "./AppleAIProvider";
import { useSubscription } from "./SubscriptionContext";
import { JLPTLevel } from "@/services/database/practice-sessions";

export type AIProviderType = "local" | "remote";

export interface StreamingResponse {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string, error?: string) => void;
  onError: (error: string) => void;
}

const PRACTICE_SYSTEM_PROMPTS: Record<JLPTLevel, string> = {
  N5: "You are a friendly Japanese language teacher helping absolute beginners (JLPT N5 level). Use simple Japanese with hiragana when writing in Japanese. Focus on basic vocabulary and grammar patterns like です/ます forms. Always be encouraging and patient. When explaining, provide both Japanese text and English translations.",
  N4: "You are a supportive Japanese language teacher for elementary students (JLPT N4 level). Use conversational Japanese appropriate for learners who understand basic grammar and can read hiragana and katakana. Introduce simple kanji gradually. Focus on everyday conversations and basic reading comprehension.",
  N3: "You are a Japanese language teacher for intermediate students (JLPT N3 level). Use natural Japanese with common kanji appropriate for this level. Students can handle more complex sentence structures and should be familiar with て-form, た-form, and basic keigo. Provide challenging but accessible content.",
  N2: "You are a Japanese language teacher for advanced students (JLPT N2 level). Use natural, moderately formal Japanese similar to what appears in newspapers and general articles. Students should be comfortable with advanced grammar patterns, a wide range of kanji, and various levels of politeness. Include nuanced expressions and cultural context.",
  N1: "You are a Japanese language teacher for expert students (JLPT N1 level). Use sophisticated, native-level Japanese including complex grammar, advanced kanji, idioms, and formal/literary expressions. Students at this level should be able to understand abstract concepts and subtle nuances in the language. Challenge them with authentic Japanese content.",
};

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
    streaming: StreamingResponse,
    signal?: AbortSignal
  ) => Promise<void>;
  chatWithMessages: (
    messages: { role: "user" | "assistant"; content: string }[],
    streaming: StreamingResponse,
    signal?: AbortSignal
  ) => Promise<void>;
  chatWithPractice: (
    level: JLPTLevel,
    messages: { role: "user" | "assistant"; content: string }[],
    streaming: StreamingResponse,
    signal?: AbortSignal
  ) => Promise<void>;
  generateSpeech: (
    text: string,
    options?: { language?: string; rate?: number }
  ) => Promise<string | undefined>;
  generateReadingPassage: (level: string) => Promise<string>;
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

  const checkRemoteAccess = useCallback((): boolean => {
    if (currentProvider !== "remote") {
      return true;
    }

    if (!subscription.isPremium) {
      subscription.showPaywall();
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
    [currentProvider, localAI, checkRemoteAccess]
  );

  const explainText = useCallback(
    async (
      text: string,
      streaming: StreamingResponse,
      signal?: AbortSignal
    ): Promise<void> => {
      try {
        if (currentProvider === "local") {
          await localAI.explainText(
            text,
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
            streaming.onError("Subscription required for AI explanations");
            return;
          }

          // Remote provider with streaming
          const fetchFn = getAiExplanation(signal);
          const response = await fetchFn(text);

          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }

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
      } catch (error) {
        streaming.onError(
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [currentProvider, localAI, checkRemoteAccess]
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
          if (!checkRemoteAccess()) {
            streaming.onError("Subscription required for AI chat");
            return;
          }

          // Remote provider - send full message history to backend
          const fetchFn = getAiChat(signal);
          const response = await fetchFn(messages);

          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }

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
      } catch (error) {
        streaming.onError(
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [currentProvider, localAI, checkRemoteAccess]
  );

  const chatWithPractice = useCallback(
    async (
      level: JLPTLevel,
      messages: { role: "user" | "assistant"; content: string }[],
      streaming: StreamingResponse,
      signal?: AbortSignal
    ): Promise<void> => {
      try {
        const systemPrompt = PRACTICE_SYSTEM_PROMPTS[level];
        const messagesWithSystem = [
          { role: "assistant" as const, content: systemPrompt },
          ...messages,
        ];

        if (currentProvider === "local") {
          await localAI.chatWithMessages(
            messagesWithSystem,
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
            streaming.onError("Subscription required for practice chat");
            return;
          }

          const fetchFn = getAiChat(signal);
          const response = await fetchFn(messagesWithSystem);

          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }

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
      } catch (error) {
        streaming.onError(
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [currentProvider, localAI, checkRemoteAccess]
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
          if (!checkRemoteAccess()) {
            throw new SubscriptionRequiredError(
              "Subscription required for cloud TTS"
            );
          }

          const file = await getAiSound(text);
          audioPlayer.replace(file.uri);
          await audioPlayer.play();
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
    [currentProvider, localAI, audioPlayer, checkRemoteAccess]
  );

  const generateReadingPassage = useCallback(
    async (level: string): Promise<string> => {
      if (currentProvider === "local") {
        throw new Error("Reading passage generation not supported on local AI");
      }

      if (!checkRemoteAccess()) {
        throw new SubscriptionRequiredError(
          "Subscription required for AI reading passages"
        );
      }

      setIsGenerating(true);
      try {
        const response = await getAiReadingPassage(level);

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        // Read the streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          return await response.text();
        }

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
        }

        return fullText;
      } finally {
        setIsGenerating(false);
      }
    },
    [currentProvider, checkRemoteAccess]
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
    chatWithPractice,
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
