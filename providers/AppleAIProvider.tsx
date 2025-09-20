import { apple } from "@react-native-ai/apple";
import { generateObject, streamText } from "ai";
import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useState } from "react";
import { useMMKVBoolean } from "react-native-mmkv";

import {
  AiExample,
  aiExampleSchemaArray,
  ExplainRequestType
} from "@/services/request";
import { SETTINGS_KEYS } from "@/services/storage";

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
  toggleState: () => void;
  isReady: boolean;
  isGenerating: boolean;
  enabled: boolean;
  error: string | null;
  interrupt: () => void;
  clearHistory: () => void;
  genType: "examples" | "explain" | null;
  currentResponse: string;
}

const AIContext = createContext<AIProviderValue | undefined>(undefined);

export function AppleAIProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useMMKVBoolean(SETTINGS_KEYS.LOCAL_AI_ENABLED);
  const [genType, setGenType] = useState<"examples" | "explain" | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const isReady = enabled && apple.isAvailable();

  const toggleState = useCallback(() => {
    if (enabled) {
      setEnabled(false);
      if (isGenerating && abortController) {
        abortController.abort();
        setAbortController(null);
        setIsGenerating(false);
      }
    } else {
      setEnabled(true);
    }
  }, [enabled, isGenerating, abortController, setEnabled]);

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

      let systemPrompt = "";
      if (type === "vocabulary") {
        systemPrompt = generateWordExplanationPrompt(text);
      } else {
        systemPrompt = EXPLAIN_GRAMMAR;
      }

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

  const clearHistory = useCallback(() => {
    setCurrentResponse("");
    setError(null);
  }, []);

  return (
    <AIContext.Provider
      value={{
        generateExamples,
        explainText,
        toggleState,
        clearHistory,
        isReady: !!isReady,
        isGenerating,
        genType,
        currentResponse,
        error,
        interrupt,
        enabled: enabled ?? false,
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

const EXAMPLES_PROMPT = `You are a Japanese language expert. Generate 3-5 example sentences for the given Japanese word or phrase.

Respond with a JSON object containing a "sentences" array. Each sentence object should have:
- "jp": The Japanese sentence with furigana annotations in format: kanji[furigana]
- "jp_reading": The full reading in hiragana only
- "en": The English translation

Requirements:
- Include the exact user-provided word/topic at least once
- ALL kanji characters MUST have furigana annotations in format: kanji[furigana]
- Sentences must be grammatically correct and natural
- Sentences must be culturally appropriate
- Use the most common readings for kanji
- Provide hiragana-only reading for jp_reading field

Example format:
\`\`\`json
{
  "sentences": [
    {
      "jp": "この道[みち]の角[かど]を右[みぎ]に曲[ま]がってください。",
      "jp_reading": "このみちのかどをみぎにまがってください",
      "en": "Please turn right at the corner of this road."
    }
  ]
}
\`\`\``;

const EXPLAIN_GRAMMAR = `**[Pattern/Phrase]** means **"[translation]"** and functions to [grammatical role/purpose].

### Structure Analysis
- **[Component 1]**: [function explanation]
- **[Component 2]**: [function explanation]
- **Pattern formula:** [X + Y + Z pattern notation]

### Usage Examples
- **Basic usage:**
  - **[Japanese sentence]**
    *([ふりがな], [romaji])*
    → "[English translation]"

- **Variation:**
  - **[Japanese sentence]**
    *([ふりがな], [romaji])*
    → "[English translation]"

### Related Constructions
**[Related Pattern 1]**
- Meaning: [meaning]
- When to use: [context]
- Difference: [how it differs from main pattern]

**[Related Pattern 2]**
- Meaning: [meaning]
- When to use: [context]
- Difference: [how it differs from main pattern]

### Usage Rules
- **Correct structure:** [specific syntactic requirements]
- **Common mistakes:** [errors to avoid]
- **Register awareness:** [formality considerations]`;

const generateWordExplanationPrompt = (prompt: string) => {
  // Check if the prompt contains kanji characters
  const containsKanji = /[\u4e00-\u9faf]/.test(prompt);

  let basePrompt = `
**[Word (ふりがな, romaji)]** - *[part of speech]*
Means **"[primary translation]"** or **"[secondary translation],"** specifically referring to **[precise meaning]**.`;

  // Add kanji analysis section if the word contains kanji
  if (containsKanji) {
    basePrompt += `

### Kanji Analysis
For each kanji in the word:
- **[Kanji 1 (ふりがな, romaji)]** → Strokes: [number], JLPT: [level]
  - **Readings**: On: [on'yomi], Kun: [kun'yomi]
  - **Core meaning:** "[core meaning]"

- **[Kanji 2 (ふりがな, romaji)]** → Strokes: [number], JLPT: [level]
  - **Readings**: On: [on'yomi], Kun: [kun'yomi]
  - **Core meaning:** "[core meaning]"

**Combined meaning:** "[compound meaning]" with nuance of **[specific connotation]**`;
  }

  // Add usage examples
  basePrompt += `

### Usage Examples
- **Casual context:**
  - **[Japanese sentence]**
    *([ふりがな], [romaji])*
    → "[English translation]"

- **Formal context:**
  - **[Japanese sentence]**
    *([ふりがな], [romaji])*
    → "[English translation]"`;

  // Add common compounds if word contains kanji
  if (containsKanji) {
    basePrompt += `

### Common Compounds
- **[Compound 1]** ([reading]) - "[meaning]"
- **[Compound 2]** ([reading]) - "[meaning]"
- **[Compound 3]** ([reading]) - "[meaning]"`;
  }

  // Add similar words comparison
  basePrompt += `

### Similar Words Comparison
**[Similar Word 1]**
- Reading: [reading]
- Meaning: [core meaning]
- Usage: [when/how used]
- Nuance: [specific connotation]

**[Similar Word 2]**
- Reading: [reading]
- Meaning: [core meaning]
- Usage: [when/how used]
- Nuance: [specific connotation]

### Usage Summary
- **Standard usage:** [typical context]
- **Special considerations:** [politeness level, gender associations]
- **Common collocations:** [words/phrases often used with it]`;

  // Add mnemonic if word contains kanji
  if (containsKanji) {
    basePrompt += `
- **Mnemonic:** [memorable image/story to help remember the kanji]`;
  }

  return basePrompt;
};
