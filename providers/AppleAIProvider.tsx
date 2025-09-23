import { apple, AppleSpeech } from "@react-native-ai/apple";
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
  chatWithMessages: (
    messages: { role: "user" | "assistant"; content: string }[],
    onChunk: (text: string) => void,
    onComplete: (fullResponse: string, error?: string) => void
  ) => Promise<void>;
  generateSpeech: (text: string) => Promise<string | null>; // base64 audio data
  isReady: boolean;
  isGenerating: boolean;
  error: string | null;
  interrupt: () => void;
  clearHistory: () => void;
  genType: "examples" | "explain" | "chat" | null;
  currentResponse: string;
}

const AIContext = createContext<AIProviderValue | undefined>(undefined);

export function AppleAIProvider({ children }: { children: ReactNode }) {
  const [genType, setGenType] = useState<
    "examples" | "explain" | "chat" | null
  >(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const isReady = apple.isAvailable();

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

      try {
        const { textStream } = await streamText({
          model: apple(),
          prompt: `${EXPLAIN_GRAMMAR}\n\nTarget: ${text}`,
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

  const chatWithMessages = useCallback(
    async (
      messages: { role: "user" | "assistant"; content: string }[],
      onChunk: (text: string) => void,
      onComplete: (fullResponse: string, error?: string) => void
    ) => {
      if (!isReady) {
        console.warn("Apple AI not ready or not enabled for chat.");
        onComplete("", "Apple AI not available");
        return;
      }

      setGenType("chat");
      setIsGenerating(true);
      setError(null);
      setCurrentResponse("");

      const controller = new AbortController();
      setAbortController(controller);

      try {
        const { textStream } = await streamText({
          model: apple(),
          messages: [
            { role: "system", content: CHAT_SYSTEM_PROMPT },
            ...messages,
          ],
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
          console.log("Chat was aborted");
        } else {
          console.error("Error in chat:", error);
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
    async (text: string) => {
      if (!isReady) {
        throw new Error("Apple AI not ready for speech synthesis");
      }
      const voices = await AppleSpeech.getVoices();
      const voice = pickBestJaVoice(voices);

      try {
        const data = await speech({
          model: apple.speechModel(),
          text,
          speed: voice.rate,
          voice: voice.identifier,
          language: voice.language,
        });

        return data?.audio?.base64 || null;
      } catch (error) {
        console.error("Apple AI speech synthesis failed:", error);
        throw error;
      }
    },
    [isReady]
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
        chatWithMessages,
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

const CHAT_SYSTEM_PROMPT = `You are a helpful Japanese language tutor assistant.
You have expertise in Japanese vocabulary, grammar, cultural nuances, and language learning.
Provide clear, concise, and helpful responses to questions about Japanese language and culture.
You can explain grammar points, provide examples, suggest learning strategies, and help with translations.
Keep your responses conversational and educational.`;

// note: prompt separation by type removed; a single generic prompt is used for both words and sentences.
/**
 * Picks the best Japanese voice from a voice list and returns a TTS config.
 * Prefers native Apple Japanese voices (Kyoko) over Eloquence voices.
 * @param voices The enumerated system voices.
 * @returns Config with identifier (if found), language, and sane defaults.
 */
export type SystemVoice = {
  identifier: string;
  isNoveltyVoice: boolean;
  isPersonalVoice: boolean;
  language: string;
  name: string;
  quality?: string | undefined;
};

export type JaTtsConfig = {
  identifier?: string;
  language: "ja-JP";
  rate: number;
  pitch: number;
  volume: number;
};

export function pickBestJaVoice(voices: SystemVoice[]): JaTtsConfig {
  const isJa = (v: SystemVoice) => v.language === "ja-JP";
  const notNovelty = (v: SystemVoice) => !v.isNoveltyVoice;
  const notEloquence = (v: SystemVoice) =>
    !v.identifier.includes(".eloquence.");
  // Prefer Kyoko, then any non-Eloquence JA voice, then any JA voice.
  const kyoko = voices.find((v) => isJa(v) && v.name.includes("Kyoko"));
  const naturalJa = voices.find(
    (v) => isJa(v) && notNovelty(v) && notEloquence(v)
  );
  const anyJa = voices.find(isJa);

  const chosen = kyoko ?? naturalJa ?? anyJa;

  return {
    identifier: chosen?.identifier,
    language: "ja-JP",
    rate: 0.5, // tweak 0.48–0.55 to taste
    pitch: 1.0,
    volume: 1.0,
  };
}
