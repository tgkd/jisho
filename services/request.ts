import { queryOptions } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";
import { fetch, FetchRequestInit } from "expo/fetch";
import { z } from "zod";

import { DictionaryEntry, ExampleSentence, WordMeaning } from "./database";

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
  provider: "cf" | "open" = "open",
  signal?: AbortSignal
): Promise<AiExample[]> {
  if (!prompt) {
    throw new Error("No prompt provided");
  }

  const resp = await fetch(
    `${
      process.env.EXPO_PUBLIC_BASE_URL
    }/ask/${provider}?prompt=${encodeURIComponent(prompt)}`,
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

export async function getAiSound(
  prompt: string,
  provider: "cf" | "open" = "open"
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

  const file = await File.downloadFileAsync(
    `${
      process.env.EXPO_PUBLIC_BASE_URL
    }/sound/${provider}?prompt=${encodeURIComponent(prompt)}`,
    new Directory(Paths.cache),
    {
      headers,
      idempotent: true,
    }
  );

  if (!file.exists) {
    throw new Error("Failed to download audio" + file.uri);
  }

  return file;
}

function getDefaultOptions(): FetchRequestInit {
  const username = process.env.EXPO_PUBLIC_AUTH_USERNAME;
  const password = process.env.EXPO_PUBLIC_AUTH_PASSWORD;
  const headers: Record<string, string> = {};
  if (username && password) {
    headers.Authorization = `Basic ${btoa(`${username}:${password}`)}`;
  }
  return { headers, credentials: "include" };
}

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
  return function (
    prompt: string,
    type: ExplainRequestType,
    provider: "cf" | "open" = "open"
  ) {
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
      `${process.env.EXPO_PUBLIC_BASE_URL}/explain/${provider}?prompt=${prompt}&type=${type}`,
      {
        signal: signal || undefined,
        headers,
        credentials: defaultOptions.credentials,
      }
    );
  };
}

export function getAiChat(signal?: AbortSignal | null) {
  return function (
    messages: { role: "user" | "assistant"; content: string }[],
    provider: "cf" | "open" = "open"
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
    return fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/chat/${provider}`, {
      method: "POST",
      signal: signal || undefined,
      headers,
      credentials: defaultOptions.credentials,
      body: JSON.stringify({ messages }),
    });
  };
}
