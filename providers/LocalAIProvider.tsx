import { AiExample, ExplainRequestType } from "@/services/request";
import { SETTINGS_KEYS } from "@/services/storage";
import type { ReactNode } from "react";
import React, {
  createContext,
  use,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  QWEN3_0_6B,
  QWEN3_TOKENIZER,
  QWEN3_TOKENIZER_CONFIG,
  LLMTool,
  useLLM,
  type Message,
} from "react-native-executorch";

import { useMMKVBoolean } from "react-native-mmkv";

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
  downloadProgress: number | undefined;
  isReady: boolean;
  isGenerating: boolean;
  enabled: boolean;
  error: string | null;
  interrupt: () => void;
  messageHistory: Message[];
  clearHistory: () => void;
  genType: "examples" | "explain" | null;
  currentResponse: string;
}

const AIContext = createContext<AIProviderValue | undefined>(undefined);

export function LocalAIProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useMMKVBoolean(SETTINGS_KEYS.LOCAL_AI_ENABLED);
  const [genType, setGenType] = useState<"examples" | "explain" | null>(null);
  const examplesCallbackRef = useRef<((examples: AiExample[]) => void) | null>(
    null
  );
  const explainCallbackRef = useRef<{
    onChunk: (text: string) => void;
    onComplete: (fullResponse: string, error?: string) => void;
  } | null>(null);

  const llm = useLLM({
    modelSource: QWEN3_0_6B,
    tokenizerSource: QWEN3_TOKENIZER,
    tokenizerConfigSource: QWEN3_TOKENIZER_CONFIG,
    preventLoad: !enabled,
  });

  useEffect(() => {
    if (llm.isReady) {
      llm.configure({
        chatConfig: {
          systemPrompt:
            "You are a helpful AI assistant for a Japanese learning app.",
          contextWindowLength: 5,
        },
        toolsConfig: {
          tools: TOOL_DEFINITIONS,
          executeToolCallback: async (call) => {
            if (call.toolName === "examples_formatter") {
              if (call.arguments) {
                try {
                  return JSON.stringify(call.arguments);
                } catch (e) {
                  console.error("Error stringifying tool arguments:", e);
                  return JSON.stringify({
                    error: "Failed to process tool arguments",
                  });
                }
              }
              return JSON.stringify({ error: "No arguments provided to tool" });
            }
            return null;
          },
        },
      });
    }
  }, [llm.isReady, enabled]);

  const toggleState = useCallback(() => {
    if (enabled) {
      setEnabled(false);
      if (llm.isGenerating) {
        llm.interrupt();
      }
    } else {
      setEnabled(true);
    }
  }, [enabled, llm, setEnabled]);

  useEffect(() => {
    if (genType !== "examples") {
      return;
    }

    if (!llm.isGenerating) {
      examplesCallbackRef.current?.(parseExamples(llm.response));
      examplesCallbackRef.current = null;
    }
  }, [llm.response, llm.isGenerating, genType]);

  useEffect(() => {
    if (genType !== "explain") {
      return;
    }

    if (llm.isGenerating) {
      explainCallbackRef.current?.onChunk(llm.response);
      return;
    }

    if (llm.response) {
      explainCallbackRef.current?.onComplete(llm.response);
      explainCallbackRef.current = null;
      setGenType(null);
    }
  }, [llm.response, llm.isGenerating, genType]);

  const generateExamples = useCallback(
    async (prompt: string, onComplete: (resp: AiExample[]) => void) => {
      setGenType("examples");
      examplesCallbackRef.current = onComplete;

      if (!llm.isReady || !enabled) {
        console.warn("LLM not ready or not enabled for generating examples.");
        setGenType(null);
        onComplete([]);
        examplesCallbackRef.current = null;
        return;
      }

      try {
        await llm.generate([
          { role: "system", content: EXAMPLES_PROMPT },
          { role: "user", content: prompt },
        ]);
      } catch (error) {
        console.error("Error during llm.generate call for examples:", error);
        onComplete([]);
        examplesCallbackRef.current = null;
        setGenType(null);
      }
    },
    [llm, enabled]
  );

  const explainText = async (
    text: string,
    type: ExplainRequestType,
    onChunk: (text: string) => void,
    onComplete: (fullResponse: string, error?: string) => void
  ) => {
    if (!llm.isReady || !enabled) {
      console.warn("LLM not ready or not enabled for explaining text.");
      onComplete("", "LLM not available");
      return;
    }

    setGenType("explain");
    explainCallbackRef.current = { onChunk, onComplete };

    let systemPrompt = "";

    if (type === "vocabulary") {
      systemPrompt = generateWordExplanationPrompt(text);
    } else {
      systemPrompt = EXPLAIN_GRAMMAR;
    }

    try {
      await llm.generate([
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ]);
    } catch (error) {
      console.error("Error explaining text:", error);

      onComplete("", error instanceof Error ? error.message : "Unknown error");
      explainCallbackRef.current = null;
      setGenType(null);
    }
  };

  const clearHistory = useCallback(() => {
    if (llm.messageHistory.length > 0) {
      llm.deleteMessage(0);
    }
  }, [llm]);

  return (
    <AIContext.Provider
      value={{
        generateExamples,
        explainText,
        toggleState,
        clearHistory,
        downloadProgress: llm.downloadProgress,
        isReady: llm.isReady,
        isGenerating: llm.isGenerating,
        genType,
        currentResponse: llm.response,
        error: llm.error,
        interrupt: llm.interrupt,
        messageHistory: llm.messageHistory,
        enabled: enabled ?? false,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useLocalAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error("useLocalAI must be used within AIProvider");
  return ctx;
}

const parseExamples = (responseString: string | null): AiExample[] => {
  if (!responseString) {
    console.warn("No response string to parse for examples");
    return [];
  }

  let cleanedString = responseString;

  const codeBlockPattern = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
  const match = responseString.match(codeBlockPattern);

  if (match && match[1]) {
    cleanedString = match[1].trim();
  }

  const eotIndex = cleanedString.indexOf("<|eot_id|>");
  if (eotIndex !== -1) {
    cleanedString = cleanedString.substring(0, eotIndex).trim();
  }

  try {
    const parsedResponse = JSON.parse(cleanedString);
    const examples: AiExample[] = parsedResponse.sentences;

    if (!examples || !Array.isArray(examples)) {
      console.error(
        "Parsed response does not contain a 'sentences' array:",
        parsedResponse
      );
      return [];
    }

    return examples
      .filter(
        (e) =>
          e.jp &&
          e.jp_reading &&
          e.en &&
          typeof e.jp === "string" &&
          typeof e.jp_reading === "string" &&
          typeof e.en === "string"
      )
      .map((e) => ({
        jp: e.jp.trim(),
        jp_reading: e.jp_reading.trim(),
        en: e.en.trim(),
      }));
  } catch (e) {
    console.error(
      "Error parsing cleaned LLM response for examples:",
      e,
      "Cleaned string was:",
      cleanedString
    );
    return [];
  }
};

const MAX_TOKENS = 512;

const EXAMPLES_PROMPT = `
# Japanese Language Expert & Tool User

You have a tool available: "examples_formatter".
When you use the "examples_formatter" tool, it will provide you with perfectly formatted JSON data containing Japanese-English sentence pairs.

**Your Task:**
1.  Understand the user's request for example sentences. The user will provide input in the format: [word]::[reading]::[meaning;meaning;...]
2.  Based on this input and the requirements below, prepare the arguments for the "examples_formatter" tool. The arguments should be a JSON object with a "sentences" key, containing an array of 3-5 sentence pair objects.
3.  Call the "examples_formatter" tool with these arguments.
4.  **CRITICAL INSTRUCTION: Once the "examples_formatter" tool returns its JSON data, your final response to the user MUST BE EXACTLY THAT JSON DATA, AND NOTHING ELSE. Do not add any introductory text, concluding remarks, explanations, or any conversational filler around the JSON provided by the tool. Your entire output must be only the valid JSON string received from the tool.**

Respect maximum token limit: ${MAX_TOKENS} tokens.

**Requirements for the data you prepare for the "examples_formatter" tool (this defines the structure of the final JSON output):**
-   The root of the JSON object must be: \`{ "sentences": [...] }\`
-   The "sentences" key must hold an array of 3 to 5 sentence pair objects.
-   Each sentence pair object within the "sentences" array must have the following string keys:
    -   "jp": The Japanese sentence. ALL kanji characters MUST have furigana annotations in the format: \`kanji[furigana]\` (e.g., "日本[にほん]語[ご]は難[むずか]しいです。").
    -   "jp_reading": The full reading of the Japanese sentence in hiragana only (e.g., "にほんごはむずかしいです").
    -   "en": The English translation of the sentence.

**Content Requirements for Each Sentence Pair (to be ensured by your argument preparation for the tool):**
1.  Include the exact user-provided word/topic at least once.
2.  All kanji characters must have furigana as specified.
3.  Sentences must be grammatically correct and sound natural.
4.  Sentences must be culturally appropriate.
5.  Sentences must be relevant to the user-provided word/topic.
6.  If multiple translations for the word exist, use the most common one in the examples.
7.  If multiple readings for a kanji exist, use the most common one relevant to the context.

**Example of the EXACT final JSON output you should provide (this is what the tool will give you, and what you MUST output without modification):**
\`\`\`json
{
  "sentences": [
    {
      "jp": "この道[みち]の角[かど]を右[みぎ]に曲[ま]がってください。",
      "jp_reading": "このみちのかどをみぎにまがってください",
      "en": "Please turn right at the corner of this road."
    },
    {
      "jp": "彼[かれ]は部屋[へや]の角[すみ]で本[ほん]を読[よ]んでいます。",
      "jp_reading": "かれはへやのすみでほんをよんでいます",
      "en": "He is reading a book in the corner of the room."
    },
    {
      "jp": "三角形[さんかくけい]には三[みっ]つの角[かど]があります。",
      "jp_reading": "さんかくけいにはみっつのかどがあります",
      "en": "A triangle has three corners."
    }
  ]
}
\`\`\`
`;

type ExamplesSchemaType = {
  sentences: {
    jp: string;
    jp_reading: string;
    en: string;
  }[];
};

const TOOL_DEFINITIONS: LLMTool[] = [
  {
    name: "examples_formatter",
    description:
      "Formats 3-5 Japanese-English example sentence pairs based on user input.",
    parameters: {
      type: "dict",
      properties: {
        sentences: {
          type: "array",
          description:
            "An array of sentence pair objects. Each object must contain 'jp', 'jp_reading', and 'en' strings.",
          items: {
            type: "object",
            properties: {
              jp: {
                type: "string",
                description:
                  "The Japanese sentence with furigana (e.g., 日本[にほん]語[ご]).",
              },
              jp_reading: {
                type: "string",
                description:
                  "The full reading of the Japanese sentence in hiragana (e.g., にほんご).",
              },
              en: {
                type: "string",
                description: "The English translation of the sentence.",
              },
            },
            required: ["jp", "jp_reading", "en"],
          },
        },
      },
      required: ["sentences"],
    },
  },
];

const EXPLAIN_GRAMMAR = `
**[Pattern/Phrase]** means **"[translation]"** and functions to [grammatical role/purpose].

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
- **Register awareness:** [formality considerations]
`;

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
