import { File, Paths } from "expo-file-system";
import { fetch, FetchRequestInit } from "expo/fetch";
import { z } from "zod";

import { DictionaryEntry, ExampleSentence, WordMeaning } from "./database";
import { SETTINGS_KEYS, settingsStorage } from "./storage";

export const aiExampleSchema = z.object({
  jp: z.string(),
  en: z.string(),
  jp_reading: z.string(),
  segments: z.array(z.object({
    ruby: z.string(),
    rt: z.string().nullable().optional(),
  })).optional(),
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

  const params = new URLSearchParams({ word: prompt });

  const resp = await fetchWithTimeout(
    `${process.env.EXPO_PUBLIC_BASE_URL}/example?${params.toString()}`,
    {
      method: "GET",
      ...getDefaultOptions(),
    },
    signal
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

  const cacheKey = hashCacheKey(`${prompt}|${voice ?? ""}|${lang ?? ""}`);
  const targetFile = new File(Paths.cache, `tts_${cacheKey}.mp3`);

  if (targetFile.exists) {
    return targetFile;
  }

  const queryParams = new URLSearchParams({
    prompt,
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

function hashCacheKey(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return hash.toString(36);
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

const CONNECTION_TIMEOUT_MS = 20_000;

/**
 * Fetch with a connection (time-to-first-byte) timeout.
 * The timeout guards only until the response headers arrive; once the
 * response resolves, the streaming body lifetime is governed solely by the
 * caller's signal. This avoids aborting a healthy long-running stream.
 * @param {string} input - Request URL
 * @param {FetchRequestInit} init - Fetch options (must not set `signal`)
 * @param {AbortSignal | null} [callerSignal] - Optional caller abort signal
 * @returns {Promise<Response>} Resolved response
 */
async function fetchWithTimeout(
  input: string,
  init: FetchRequestInit,
  callerSignal?: AbortSignal | null
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("Connection timeout")),
    CONNECTION_TIMEOUT_MS
  );
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, controller.signal])
    : controller.signal;
  try {
    return await fetch(input, { ...init, signal });
  } finally {
    clearTimeout(timer);
  }
}
