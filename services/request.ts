import { fetch, FetchRequestInit } from "expo/fetch";
import { queryOptions } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";

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
    return null;
  }

  return `${e.word.word}::${e.word.reading}::${e.meanings
    .map((m) => m.meaning)
    .join(";")}`;
}

// function getAiExamples(prompt: string, provider: "cf" | "open" = "open") {
//   return ;
// }

const DEFAULT_OPTIONS: FetchRequestInit = {
  headers: {
    Authorization: `Basic ${btoa(
      `${process.env.EXPO_PUBLIC_AUTH_USERNAME}:${process.env.EXPO_PUBLIC_AUTH_PASSWORD}`
    )}`,
  },
  credentials: "include",
};

export const aiExamplesQueryOptions = (
  prompt: string | null,
  o: { provider?: "cf" | "open" } = { provider: "open" }
) =>
  queryOptions({
    enabled: false,
    queryKey: ["ai-examples", prompt, o.provider],
    queryFn: async ({ signal }) => {
      if (!prompt) {
        throw new Error("No prompt provided");
      }

      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_BASE_URL}/ask/${o.provider}?prompt=${prompt}`,
        {
          signal,
          method: "GET",
          ...DEFAULT_OPTIONS,
        }
      );

      if (!resp.ok) {
        throw new Error("Network response was not ok");
      }

      return resp.json() as Promise<AiExample[]>;
    },
  });

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

export const aiSoundQueryOptions = (
  prompt: string,
  o: { provider?: "cf" | "open" } = { provider: "open" }
) =>
  queryOptions({
    enabled: false,
    queryKey: ["ai-sound", prompt, o.provider],
    queryFn: async ({ signal }) => {
      if (!prompt) {
        throw new Error("No prompt provided");
      }
      const tempFilePath = `${
        FileSystem.cacheDirectory
      }audio_${Date.now()}.mp3`;

      const downloadResult = await FileSystem.downloadAsync(
        `${process.env.EXPO_PUBLIC_BASE_URL}/sound/${
          o.provider
        }?prompt=${encodeURIComponent(prompt)}`,
        tempFilePath,
        {
          headers: {
            Authorization: `Basic ${btoa(
              `${process.env.EXPO_PUBLIC_AUTH_USERNAME}:${process.env.EXPO_PUBLIC_AUTH_PASSWORD}`
            )}`,
            Accept: "audio/mpeg",
          },
        }
      );

      if (downloadResult.status !== 200) {
        throw new Error(
          `Failed to download audio: HTTP ${downloadResult.status}`
        );
      }

      return tempFilePath;
    },
  });
