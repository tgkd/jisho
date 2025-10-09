import { queryOptions } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import { fetch, FetchRequestInit } from "expo/fetch";
import { z } from "zod";

import { DictionaryEntry, ExampleSentence, WordMeaning } from "./database";
import { settingsStorage, SETTINGS_KEYS } from "./storage";

export enum ExplainRequestType {
  V = "vocabulary",
  G = "grammar",
}

export const aiExampleSchema = z.object({
  jp: z.string(),
  en: z.string(),
  jp_reading: z.string(),
});

export const aiExampleSchemaArray = z.array(aiExampleSchema);

export type AiExample = z.infer<typeof aiExampleSchema>;

export const aiReadingPassageSchema = z.object({
  title: z.string(),
  content: z.string(),
  translation: z.string(),
});

export type AiReadingPassage = z.infer<typeof aiReadingPassageSchema>;

export function createWordPrompt(
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

export async function getAiExamples(
  prompt: string,
  signal?: AbortSignal
): Promise<AiExample[]> {
  if (!prompt) {
    throw new Error("No prompt provided");
  }

  const resp = await fetch(
    `${process.env.EXPO_PUBLIC_BASE_URL}/ask?prompt=${encodeURIComponent(prompt)}`,
    {
      signal,
      method: "GET",
      ...getDefaultOptions(),
    }
  );

  if (!resp.ok) {
    throw new Error("Network response was not ok");
  }

  return resp.json() as Promise<AiExample[]>;
}

export async function getAiSound(prompt: string) {
  if (!prompt) {
    throw new Error("No prompt provided");
  }
  const defaultOptions = getDefaultOptions();
  const headers: Record<string, string> = {
    Accept: "audio/mpeg",
  };

  if (defaultOptions.headers) {
    Object.assign(headers, defaultOptions.headers);
  }

  const timestamp = Date.now();
  const sanitizedPrompt = prompt.slice(0, 20).replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `audio_${sanitizedPrompt}_${timestamp}.mp3`;
  const targetFile = new File(Paths.cache, filename);

  const file = await File.downloadFileAsync(
    `${process.env.EXPO_PUBLIC_BASE_URL}/sound?prompt=${encodeURIComponent(prompt)}`,
    targetFile,
    {
      headers,
      idempotent: false,
    }
  );

  if (!file.exists) {
    throw new Error("Failed to download audio" + file.uri);
  }

  return file;
}

/**
 * Get default fetch options including authentication headers.
 * Adds RevenueCat user ID for subscription verification.
 * @returns {FetchRequestInit} Default fetch configuration with headers
 */
function getDefaultOptions(): FetchRequestInit {
  const headers: Record<string, string> = {};

  // Add RevenueCat user ID for subscription verification
  const userId = settingsStorage.getString(SETTINGS_KEYS.REVENUECAT_USER_ID);
  if (userId) {
    headers["X-User-ID"] = userId;
  }

  return { headers, credentials: "include" };
}

export const aiExamplesQueryOptions = (prompt: string | null) =>
  queryOptions({
    enabled: false,
    queryKey: ["ai-examples", prompt],
    queryFn: async ({ signal }) => {
      if (!prompt) {
        throw new Error("No prompt provided");
      }

      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_BASE_URL}/ask?prompt=${prompt}`,
        {
          signal,
          method: "GET",
          ...getDefaultOptions(),
        }
      );

      if (!resp.ok) {
        throw new Error("Network response was not ok");
      }

      return resp.json() as Promise<AiExample[]>;
    },
  });

export function getAiExplanation(signal?: AbortSignal | null) {
  return function (prompt: string, type: ExplainRequestType) {
    if (!prompt) {
      return Promise.resolve(new Response());
    }
    const defaultOptions = getDefaultOptions();
    const headers = {
      ...defaultOptions.headers,
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };
    return fetch(
      `${process.env.EXPO_PUBLIC_BASE_URL}/explain?prompt=${prompt}&type=${type}`,
      {
        signal: signal || undefined,
        headers,
        credentials: defaultOptions.credentials,
      }
    );
  };
}

export function getAiChat(signal?: AbortSignal | null) {
  return function (messages: { role: "user" | "assistant"; content: string }[]) {
    if (!messages.length) {
      return Promise.resolve(new Response());
    }
    const defaultOptions = getDefaultOptions();
    const headers = {
      ...defaultOptions.headers,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };
    return fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/chat`, {
      method: "POST",
      signal: signal || undefined,
      headers,
      credentials: defaultOptions.credentials,
      body: JSON.stringify({ messages }),
    });
  };
}

export async function getAiReadingPassage(
  level: string,
  signal?: AbortSignal
): Promise<AiReadingPassage> {
  if (!level) {
    throw new Error("No level provided");
  }

  const resp = await fetch(
    `${process.env.EXPO_PUBLIC_BASE_URL}/passage?level=${encodeURIComponent(level)}`,
    {
      signal,
      method: "GET",
      ...getDefaultOptions(),
    }
  );

  if (!resp.ok) {
    throw new Error("Network response was not ok");
  }

  return resp.json() as Promise<AiReadingPassage>;
}
