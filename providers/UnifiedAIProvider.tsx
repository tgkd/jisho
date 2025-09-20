import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";

import {
  AiExample,
  ExplainRequestType,
  getAiExamples,
  getAiExplanation,
  getAiSound,
} from "@/services/request";
import { SETTINGS_KEYS } from "@/services/storage";
import { useAppleAI } from "./AppleAIProvider";

export type AIProviderType = "local" | "remote" | "none";
export type AIProviderPreference = "local" | "remote" | "auto";

export interface StreamingResponse {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string, error?: string) => void;
  onError: (error: string) => void;
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
  generateAudio: (text: string) => Promise<string | null>;

  // State management
  isGenerating: boolean;
  isAvailable: boolean;
  currentProvider: AIProviderType;
  preferredProvider: AIProviderPreference;

  // Configuration
  setPreferredProvider: (provider: AIProviderPreference) => void;

  // Utilities
  interrupt: () => void;
  getProviderCapabilities: () => {
    examples: boolean;
    explanation: boolean;
    audio: boolean;
    streaming: boolean;
  };
}

const UnifiedAIContext = createContext<UnifiedAIContextValue | undefined>(
  undefined
);

export function UnifiedAIProvider({ children }: { children: ReactNode }) {
  const localAI = useAppleAI();
  const [apiAuthUsername] = useMMKVString(SETTINGS_KEYS.API_AUTH_USERNAME);
  const [useApiCredentials] = useMMKVBoolean(SETTINGS_KEYS.USE_API_CREDENTIALS);
  const [preferredProvider, setPreferredProvider] =
    useState<AIProviderPreference>("auto");
  const [currentProvider, setCurrentProvider] =
    useState<AIProviderType>("none");
  const [isGenerating, setIsGenerating] = useState(false);
  const localAvailable = localAI.isReady;
  const remoteAvailable = (useApiCredentials ?? false) && !!apiAuthUsername;
  const isAvailable = localAvailable || remoteAvailable;

  useEffect(() => {
    if (preferredProvider === "auto") {
      if (localAvailable) {
        setCurrentProvider("local");
      } else if (remoteAvailable) {
        setCurrentProvider("remote");
      } else {
        setCurrentProvider("none");
      }
    } else if (preferredProvider === "local") {
      setCurrentProvider(localAvailable ? "local" : "none");
    } else if (preferredProvider === "remote") {
      setCurrentProvider(remoteAvailable ? "remote" : "none");
    }
  }, [preferredProvider, localAvailable, remoteAvailable]);

  // Track generating state
  useEffect(() => {
    setIsGenerating(localAI.isGenerating);
  }, [localAI.isGenerating]);

  const generateExamples = useCallback(
    async (prompt: string): Promise<AiExample[]> => {
      if (currentProvider === "none") {
        throw new Error(
          "No AI provider available. Please configure API credentials in Settings or ensure Apple Intelligence is available."
        );
      }

      try {
        if (currentProvider === "local") {
          return new Promise((resolve) => {
            localAI.generateExamples(prompt, (examples) => {
              resolve(examples);
            });
          });
        } else {
          setIsGenerating(true);
          try {
            return await getAiExamples(prompt, "open");
          } finally {
            setIsGenerating(false);
          }
        }
      } catch (error) {
        // Fallback logic
        if (currentProvider === "local" && remoteAvailable) {
          console.warn("Local AI failed, falling back to remote");
          // Fallback to remote
          setIsGenerating(true);
          try {
            return await getAiExamples(prompt, "open");
          } finally {
            setIsGenerating(false);
          }
        }
        throw error;
      }
    },
    [currentProvider, localAI, remoteAvailable]
  );

  const explainText = useCallback(
    async (
      text: string,
      type: ExplainRequestType,
      streaming: StreamingResponse,
      signal?: AbortSignal
    ): Promise<void> => {
      if (currentProvider === "none") {
        streaming.onError(
          "No AI provider available. Please configure API credentials in Settings or ensure Apple Intelligence is available."
        );
        return;
      }

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
        // Fallback logic
        if (currentProvider === "local" && remoteAvailable) {
          console.warn("Local AI failed, falling back to remote");
          try {
            const fetchFn = getAiExplanation(signal);
            const response = await fetchFn(text, type);
            // Handle remote streaming fallback...
            const fullText = await response.text();
            streaming.onChunk(fullText);
            streaming.onComplete(fullText);
          } catch (fallbackError) {
            streaming.onError(`All providers failed: ${fallbackError}`);
          }
        } else {
          streaming.onError(
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }
    },
    [currentProvider, localAI, remoteAvailable]
  );

  const generateAudio = useCallback(
    async (text: string): Promise<string | null> => {
      if (currentProvider === "none" || currentProvider === "local") {
        // Local AI doesn't support audio generation
        return null;
      }

      try {
        return await getAiSound(text, "open");
      } catch (error) {
        console.error("Audio generation failed:", error);
        return null;
      }
    },
    [currentProvider]
  );

  const interrupt = useCallback(() => {
    if (currentProvider === "local") {
      localAI.interrupt();
    }
    // Note: Remote interruption would need AbortController support
  }, [currentProvider, localAI]);

  const getProviderCapabilities = useCallback(() => {
    return {
      examples: isAvailable,
      explanation: isAvailable,
      audio: currentProvider === "remote",
      streaming: isAvailable,
    };
  }, [isAvailable, currentProvider]);

  const contextValue: UnifiedAIContextValue = {
    generateExamples,
    explainText,
    generateAudio,
    isGenerating,
    isAvailable,
    currentProvider,
    preferredProvider,
    setPreferredProvider,
    interrupt,
    getProviderCapabilities,
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
