import { apple, AppleSpeech } from "@react-native-ai/apple";
import {
  generateObject,
  experimental_generateSpeech as speech,
  streamText,
} from "ai";
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
        console.warn("⚠️ [AppleAI] Apple AI not ready or not enabled for explaining text.");
        const fallbackMessage = "Apple Intelligence is not available. Please enable it in iOS Settings or switch to the remote AI provider.";
        onComplete(fallbackMessage);
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
          prompt: `${JP_EXPLANATION_SYSTEM_PROMPT}\n\nExplain this Japanese text: ${text}`,
          abortSignal: controller.signal,
          maxOutputTokens: MAX_TOKENS,
        });

        let fullResponse = "";
        for await (const chunk of textStream) {
          fullResponse += chunk;
          onChunk(chunk);
          setCurrentResponse(fullResponse);
        }

        // Handle empty responses (e.g., on simulator where Apple Intelligence doesn't work)
        if (fullResponse.length === 0) {
          const fallbackMessage = "Apple Intelligence is not available on the simulator. Please test on a physical device with Apple Intelligence enabled, or switch to the remote AI provider in settings.";
          console.warn("⚠️ [AppleAI] Empty response - likely running on simulator");
          onComplete(fallbackMessage);
          return;
        }

        onComplete(fullResponse);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("⚠️ [AppleAI] Text explanation was aborted");
        } else {
          console.error("🔴 [AppleAI] Error explaining text:", error);
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
        console.warn("⚠️ [AppleAI] Apple AI not ready or not enabled for chat.");
        const fallbackMessage = "Apple Intelligence is not available. Please enable it in iOS Settings or switch to the remote AI provider.";
        onComplete(fallbackMessage);
        return;
      }

      setGenType("chat");
      setIsGenerating(true);
      setError(null);
      setCurrentResponse("");

      const controller = new AbortController();
      setAbortController(controller);

      try {
        const appleModel = apple();

        const result = await streamText({
          model: appleModel,
          messages: [
            { role: "system", content: JP_EXPLANATION_SYSTEM_PROMPT },
            ...messages,
          ],
          abortSignal: controller.signal,
          maxOutputTokens: MAX_TOKENS,
          temperature: 0.1,
        });

        const { textStream } = result;

        let fullResponse = "";

        for await (const chunk of textStream) {
          fullResponse += chunk;
          onChunk(chunk);
          setCurrentResponse(fullResponse);
        }

        // Handle empty responses (e.g., on simulator where Apple Intelligence doesn't work)
        if (fullResponse.length === 0) {
          const fallbackMessage = "Apple Intelligence is not available on the simulator. Please test on a physical device with Apple Intelligence enabled, or switch to the remote AI provider in settings.";
          console.warn("⚠️ [AppleAI] Empty response - likely running on simulator");
          onComplete(fallbackMessage);
          return;
        }

        onComplete(fullResponse);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("⚠️ [AppleAI] Chat was aborted");
        } else {
          console.error("🔴 [AppleAI] Error in chat:", error);
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

const MAX_TOKENS = 1500; // Adjust based on typical response length needs

const JP_EXPLANATION_SYSTEM_PROMPT = `
You are a Japanese language expert who provides clear, structured explanations.

IMPORTANT: Your response is limited to ${MAX_TOKENS} tokens. Plan your explanation to fit within this limit - prioritize the most essential information and conclude your response naturally before being cut off.

For grammar patterns/phrases, explain:
- What the pattern means and its grammatical function
- Break down the components and structure
- Provide usage examples with furigana and romaji
- Mention related constructions and key usage rules
- Note formality levels and common mistakes

For vocabulary words, explain:
- The word's meaning and part of speech (with furigana and romaji)
- If it contains kanji, analyze each kanji's readings and core meaning
- Show usage in both casual and formal contexts
- List common compounds or collocations
- Compare with similar words to highlight nuances
- Include memory aids if helpful

Format your response with clear headings and bullet points. Always include:
- Japanese text with furigana in brackets: 漢字[かんじ]
- Romaji in parentheses
- English translations in quotes
- Bold key terms and patterns

Be comprehensive but concise. Focus on practical usage and cultural context. Ensure you complete your explanation within the token limit.
`;

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
