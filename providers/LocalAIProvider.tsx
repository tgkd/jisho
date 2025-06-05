import { AiExample, ExplainRequestType } from "@/services/request";
import { SETTINGS_KEYS } from "@/services/storage";
import type { ReactNode } from "react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from "react";
import {
  LLAMA3_2_1B_SPINQUANT,
  LLAMA3_2_1B_TOKENIZER,
  LLAMA3_2_TOKENIZER_CONFIG,
  LLMTool,
  useLLM,
  type Message,
} from "react-native-executorch";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";

export interface AIProviderValue {
  generateExamples: (
    prompt: string,
    onComplete: (resp: AiExample[]) => void
  ) => Promise<void>;
  explainText: (
    text: string,
    type: ExplainRequestType,
    onChunk: (text: string) => void
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
}

const AIContext = createContext<AIProviderValue | undefined>(undefined);

function getSystemPromptForType(type: ExplainRequestType): string {
  switch (type) {
    case ExplainRequestType.V:
      return "You are a helpful Japanese language learning assistant. Explain vocabulary words, their meanings, usage, and provide examples in a clear and educational way.";
    case ExplainRequestType.G:
      return "You are a helpful Japanese language learning assistant. Explain grammar patterns, their usage, conjugations, and provide clear examples with explanations.";
    default:
      return "You are a helpful Japanese language learning assistant.";
  }
}

export function LocalAIProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useMMKVBoolean(SETTINGS_KEYS.LOCAL_AI_ENABLED);

  const llm = useLLM({
    modelSource: LLAMA3_2_1B_SPINQUANT,
    tokenizerSource: LLAMA3_2_1B_TOKENIZER,
    tokenizerConfigSource: LLAMA3_2_TOKENIZER_CONFIG,
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
                  // The LLM should provide arguments matching the tool's schema,
                  // which is an object like { sentences: [...] }.
                  // We stringify this directly.
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
          // displayToolCalls: true, // Optional: for debugging
        },
      });
    }
  }, [llm.isReady, enabled]); // Added llm.isReady and enabled to re-configure if needed

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

  // console.log("LLM:", llm.isReady, llm.isGenerating, llm.response); // Original log
  console.log("LLM State:", llm.isReady, llm.isGenerating, "Response available:", !!llm.response);


  const generateExamples = useCallback(
    async (prompt: string, onComplete: (resp: AiExample[]) => void) => {
      if (!llm.isReady || !enabled) {
        console.warn("LLM not ready or not enabled for generating examples.");
        onComplete([]);
        return;
      }

      try {
        await llm.generate([
          { role: "system", content: EXAMPLES_PROMPT },
          { role: "user", content: prompt },
        ]);

        if (llm.response) {
          console.log("LLM raw response for examples:", llm.response);
          try {
            const parsedResponse = JSON.parse(llm.response);
            // The prompt now guides the LLM to return JSON matching the tool's output structure,
            // which should be an object like { sentences: [...] }.
            const examples: AiExample[] = parsedResponse.sentences;
            if (!examples || !Array.isArray(examples)) {
              console.error("Parsed response does not contain a 'sentences' array:", parsedResponse);
              onComplete([]);
            } else {
              onComplete(examples);
            }
          } catch (e) {
            console.error(
              "Error parsing LLM response for examples:",
              e,
              "Raw response was:",
              llm.response
            );
            onComplete([]);
          }
        } else {
          console.warn("LLM generated no response for examples.");
          onComplete([]);
        }
      } catch (error) {
        console.error("Error during llm.generate for examples:", error);
        onComplete([]);
      }
    },
    [llm, enabled]
  );

  // const handleExamplesGenerateEnd = useCallback((txt: string) => {}, []); // Already removed in previous step, ensuring it stays removed.

  const explainText = useCallback(
    async (
      text: string,
      type: ExplainRequestType,
      onChunk: (text: string) => void
    ) => {
      if (!llm.isReady || !enabled) {
        return;
      }

      const systemPrompt = getSystemPromptForType(type);

      try {
        await llm.generate([
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ]);
      } catch (error) {
        console.error("Error explaining text:", error);
      }
    },
    [llm, enabled]
  );

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

const MAX_TOKENS = 512; // Ensure this is appropriate for the model and expected output size

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
      type: "dict", // Assuming "dict" is the expected type by react-native-executorch, otherwise use "object"
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
