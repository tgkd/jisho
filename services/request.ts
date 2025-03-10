import { DictionaryEntry, ExampleSentence, WordMeaning } from "./database";

export type AiExample = {
  jp: string;
  en: string;
  jp_reading: string;
};

export function craeteWordPrompt(
  e: {
    word: DictionaryEntry;
    meanings: WordMeaning[];
    examples: ExampleSentence[];
  } | null
) {
  if (!e) {
    return undefined;
  }

  return `${e.word.word}::${e.word.reading}::${e.meanings
    .map((m) => m.meaning)
    .join(";")}`;
}

export function getAiExamples(
  prompt?: string,
  provider: "cf" | "open" = "open"
) {
  return function (signal?: AbortSignal | null) {
    if (!prompt) {
      return Promise.resolve(new Response());
    }
    return fetch(
      `${process.env.EXPO_PUBLIC_BASE_URL}/ask/${provider}?prompt=${prompt}`,
      {
        signal: signal || undefined,
        headers: {
          Authorization: `Basic ${btoa(
            `${process.env.EXPO_PUBLIC_AUTH_USERNAME}:${process.env.EXPO_PUBLIC_AUTH_PASSWORD}`
          )}`,
        },
        credentials: "include",
      }
    );
  };
}

export function getAiExplanation(signal?: AbortSignal | null) {
  return function (prompt: string, provider: "cf" | "open" = "open") {
    if (!prompt) {
      return Promise.resolve(new Response());
    }
    return fetch(
      `${process.env.EXPO_PUBLIC_BASE_URL}/explain/${provider}?prompt=${prompt}`,
      {
        signal: signal || undefined,
        headers: {
          Authorization: `Basic ${btoa(
            `${process.env.EXPO_PUBLIC_AUTH_USERNAME}:${process.env.EXPO_PUBLIC_AUTH_PASSWORD}`
          )}`,
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        credentials: "include",
      }
    );
  };
}
