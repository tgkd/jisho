import { apple } from "@react-native-ai/apple";
import {
  experimental_generateSpeech as speech,
  generateObject,
  streamText,
} from "ai";
import { useAudioPlayer } from "expo-audio";
import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useState } from "react";

import {
  AiExample,
  aiExampleSchemaArray,
  ExplainRequestType,
} from "@/services/request";

/**
 * Apple AI Provider using @react-native-ai/apple
 *
 * Note: Uses foundationModels direct API instead of Vercel AI SDK patterns
 * due to version compatibility issues between AI SDK v5 and Apple provider v1.
 * The Apple provider implements LanguageModelV1 but AI SDK v5 expects v2.
 */

export interface AIProviderValue {
  generateExamples: (
    prompt: string,
    onComplete: (resp: AiExample[]) => void
  ) => Promise<void>;
  explainText: (
    text: string,
    type: ExplainRequestType,
    onChunk: (text: string) => void,
    onComplete: (fullResponse: string, error?: string) => void
  ) => Promise<void>;
  generateSpeech: (
    text: string,
    options?: { language?: string; rate?: number }
  ) => Promise<void>;
  isReady: boolean;
  isGenerating: boolean;
  error: string | null;
  interrupt: () => void;
  clearHistory: () => void;
  genType: "examples" | "explain" | null;
  currentResponse: string;
}

const AIContext = createContext<AIProviderValue | undefined>(undefined);

export function AppleAIProvider({ children }: { children: ReactNode }) {
  const [genType, setGenType] = useState<"examples" | "explain" | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const isReady = apple.isAvailable();

  // Audio player for speech synthesis
  const audioPlayer = useAudioPlayer();

  const generateExamples = useCallback(
    async (prompt: string, onComplete: (resp: AiExample[]) => void) => {
      if (!isReady) {
        console.warn(
          "Apple AI not ready or not enabled for generating examples."
        );
        onComplete([]);
        return;
      }

      setGenType("examples");
      setIsGenerating(true);
      setError(null);
      setCurrentResponse("");

      const controller = new AbortController();
      setAbortController(controller);

      try {
        const result = await generateObject({
          model: apple(),
          prompt: EXAMPLES_PROMPT.replace("{word}", prompt),
          schema: aiExampleSchemaArray,
        });

        onComplete(result.object);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("Examples generation was aborted");
        } else {
          console.error("Error during generateText call for examples:", error);
          setError(error instanceof Error ? error.message : "Unknown error");
        }
        onComplete([]);
      } finally {
        setIsGenerating(false);
        setGenType(null);
        setAbortController(null);
      }
    },
    [isReady]
  );

  const explainText = useCallback(
    async (
      text: string,
      type: ExplainRequestType,
      onChunk: (text: string) => void,
      onComplete: (fullResponse: string, error?: string) => void
    ) => {
      if (!isReady) {
        console.warn("Apple AI not ready or not enabled for explaining text.");
        onComplete("", "Apple AI not available");
        return;
      }

      setGenType("explain");
      setIsGenerating(true);
      setError(null);
      setCurrentResponse("");

      const controller = new AbortController();
      setAbortController(controller);

      // Build a concise, free-form prompt that works for both words and sentences
      const systemPrompt = `${EXPLAIN_GRAMMAR}\n\nTarget: ${text}`;

      try {
        const { textStream } = await streamText({
          model: apple(),
          prompt: systemPrompt,
          abortSignal: controller.signal,
        });

        let fullResponse = "";
        for await (const chunk of textStream) {
          fullResponse += chunk;
          onChunk(chunk);
          setCurrentResponse(fullResponse);
        }

        onComplete(fullResponse);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("Text explanation was aborted");
        } else {
          console.error("Error explaining text:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          setError(errorMessage);
          onComplete("", errorMessage);
        }
      } finally {
        setIsGenerating(false);
        setGenType(null);
        setAbortController(null);
      }
    },
    [isReady]
  );

  const interrupt = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsGenerating(false);
      setGenType(null);
    }
  }, [abortController]);

  const generateSpeech = useCallback(
    async (
      text: string,
      options: { language?: string; rate?: number } = {}
    ) => {
      console.log("start local", text);

      if (!isReady) {
        throw new Error("Apple AI not ready for speech synthesis");
      }

      try {
        console.log("generating speech for:", text);

        const data = await speech({
          model: apple.speechModel(),
          text,
          language:
            options.language === "ja" ? "ja-JP" : options.language || "en-US",
        });

        const audioDataUri = `data:audio/wav;base64,${data.audio.base64}`;

        // Load and play the audio
        await audioPlayer.replace(audioDataUri);
        await audioPlayer.play();
      } catch (error) {
        console.error("Apple AI speech synthesis failed:", error);
        throw error;
      }
    },
    [isReady, audioPlayer]
  );

  const clearHistory = useCallback(() => {
    setCurrentResponse("");
    setError(null);
  }, []);

  return (
    <AIContext.Provider
      value={{
        generateExamples,
        explainText,
        generateSpeech,
        clearHistory,
        isReady,
        isGenerating,
        genType,
        currentResponse,
        error,
        interrupt,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAppleAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error("useAppleAI must be used within AppleAIProvider");
  return ctx;
}

const EXAMPLES_PROMPT = `You are a Japanese language expert.

Input: {word}
Input format: headword::reading::meanings (semicolon-separated). Use this only as reference to extract the headword and reading. Do NOT output or repeat this format.

Task:
- Generate exactly 5 natural, culturally appropriate Japanese sentences.
- Every sentence MUST include the exact headword (text before the first ::) as written; conjugation is allowed. Do not use synonyms or different spellings.
- Vary the contexts; avoid duplicates.

Output (JSON only):
- Return ONLY a JSON array of 5 objects with these fields: jp, jp_reading, en.
- jp: the Japanese sentence with furigana for ALL kanji in the format 漢字[かんじ]. For the headword, use the provided reading.
- jp_reading: the entire sentence in hiragana only.
- en: a natural English translation.
- Do NOT include any extra text, comments, keys, or code fences—output valid JSON only.`;

const EXPLAIN_GRAMMAR = `You are a concise Japanese tutor.
Given a word or a sentence, explain the core meaning or grammatical function and key nuances in clear English.
Mention part of speech or grammar role when relevant.
If helpful, include up to 2 short natural examples with kana and translations.
Keep it compact and free-form (no rigid structure).`;

// note: prompt separation by type removed; a single generic prompt is used for both words and sentences.
