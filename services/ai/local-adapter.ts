import { apple } from "@react-native-ai/apple";
import { streamText } from "ai";

const MAX_TOKENS = 1500;

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

/** Plain conversation message handed to a local adapter. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Provider-agnostic on-device chat contract. Any local LLM library is adopted
 * by implementing this interface — the UI and streaming layers are unaffected.
 * `run` yields incremental text deltas; the connection layer wraps them into
 * the AG-UI envelope via {@link textDeltasToAgui}.
 */
export interface LocalChatAdapter {
  readonly isReady: boolean;
  run(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string>;
}

/**
 * Apple Intelligence implementation of {@link LocalChatAdapter}, wrapping the
 * Vercel AI SDK `streamText` bridge to `@react-native-ai/apple`.
 */
export const appleLocalAdapter: LocalChatAdapter = {
  get isReady(): boolean {
    return apple.isAvailable();
  },

  async *run(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    if (!apple.isAvailable()) {
      yield "Apple Intelligence is not available. Please enable it in iOS Settings or switch to the remote AI provider.";
      return;
    }

    const result = await streamText({
      model: apple(),
      messages: [
        { role: "system", content: JP_EXPLANATION_SYSTEM_PROMPT },
        ...messages,
      ],
      abortSignal: signal,
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.1,
    });

    let emitted = false;
    for await (const delta of result.textStream) {
      emitted = true;
      yield delta;
    }

    if (!emitted) {
      yield "Apple Intelligence is not available on the simulator. Please test on a physical device with Apple Intelligence enabled, or switch to the remote AI provider in settings.";
    }
  },
};
