import { getAiChat, getAiReadingPassageStreaming } from "./request";

/**
 * Convert a fetch Response with ReadableStream body to an AsyncIterable of string chunks.
 */
async function* responseToAsyncIterable(
  response: Response
): AsyncIterable<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text) yield text;
    return;
  }

  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) yield chunk;
    }
    const remaining = decoder.decode();
    if (remaining) yield remaining;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stream chat messages from the remote AI API.
 */
export async function* streamRemoteChat(
  messages: { role: "user" | "assistant" | "system" | "developer"; content: string }[],
  signal: AbortSignal
): AsyncIterable<string> {
  const fetchFn = getAiChat(signal);
  const response = await fetchFn(messages);

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  yield* responseToAsyncIterable(response);
}

/**
 * Stream a reading passage from the remote AI API.
 */
export async function* streamRemoteReadingPassage(
  level: string,
  signal: AbortSignal
): AsyncIterable<string> {
  const response = await getAiReadingPassageStreaming(level, signal);

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  yield* responseToAsyncIterable(response);
}
