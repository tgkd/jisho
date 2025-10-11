import { queryOptions } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import { fetch, FetchRequestInit } from "expo/fetch";
import { z } from "zod";

import { DictionaryEntry, ExampleSentence, WordMeaning } from "./database";
import { settingsStorage, SETTINGS_KEYS } from "./storage";

export const aiExampleSchema = z.object({
  jp: z.string(),
  en: z.string(),
  jp_reading: z.string(),
});

export const aiExampleSchemaArray = z.array(aiExampleSchema);

export type AiExample = z.infer<typeof aiExampleSchema>;

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
    `${process.env.EXPO_PUBLIC_BASE_URL}/example?word=${encodeURIComponent(
      prompt
    )}`,
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

/**
 * Get audio file for text-to-speech synthesis.
 * @param {string} prompt - Text to synthesize
 * @param {string} [voice] - Voice identifier for OpenAI TTS (default: nova)
 * @param {string} [lang] - Two-letter language code for Cloudflare AI (default: jp)
 * @returns {Promise<File>} Downloaded audio file
 * @throws {Error} If prompt is missing or download fails
 */
export async function getAiSound(
  prompt: string,
  voice?: string,
  lang?: string
) {
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

  const queryParams = new URLSearchParams({
    prompt: encodeURIComponent(prompt),
  });
  if (voice) queryParams.append("voice", voice);
  if (lang) queryParams.append("lang", lang);

  const file = await File.downloadFileAsync(
    `${process.env.EXPO_PUBLIC_BASE_URL}/sound?${queryParams.toString()}`,
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
        `${process.env.EXPO_PUBLIC_BASE_URL}/example?word=${prompt}`,
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

/**
 * Get AI explanation for text with streaming response.
 * Uses POST /chat with mode="chat" as per API spec.
 * @param {AbortSignal | null} [signal] - Optional abort signal
 * @returns {Function} Function that takes text and returns streaming response
 */
export function getAiExplanation(signal?: AbortSignal | null) {
  return function (prompt: string) {
    if (!prompt) {
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
      body: JSON.stringify({
        mode: "chat",
        messages: [{ role: "user", content: prompt }],
      }),
    });
  };
}

/**
 * Get AI chat response for conversational tutoring.
 * @param {AbortSignal | null} [signal] - Optional abort signal
 * @returns {Function} Function that takes messages and returns streaming response
 */
export function getAiChat(signal?: AbortSignal | null) {
  return function (
    messages: {
      role: "user" | "assistant" | "system" | "developer";
      content: string;
    }[]
  ) {
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
      body: JSON.stringify({ messages, mode: "chat" }),
    });
  };
}

/**
 * Get AI-generated reading practice passage with streaming response.
 * Uses POST /chat with mode="practice" as per API spec.
 * @param {string} level - JLPT difficulty level (e.g., "N5", "N3", "jlpt n2")
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<Response>} Streaming response with practice content
 * @throws {Error} If level is missing or request fails
 */
export function getAiReadingPassage(
  level: string,
  signal?: AbortSignal
): Promise<Response> {
  if (!level) {
    throw new Error("No level provided");
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
    body: JSON.stringify({
      mode: "practice",
      lvl: level,
      messages: [
        {
          role: "user",
          content: "Generate a reading practice passage",
        },
      ],
    }),
  });
}
