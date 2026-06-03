import type { ConnectionAdapter } from "@tanstack/ai-client";
import { stream, xhrHttpStream } from "@tanstack/ai-client";
import type { ModelMessage, UIMessage } from "@tanstack/ai/client";

import { textDeltasToAgui } from "./agui";
import type { ChatMessage, LocalChatAdapter } from "./local-adapter";

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? "";

type AnyMessage = UIMessage | ModelMessage;

/**
 * Extract plain text from a ChatClient message, whether it stores content as a
 * string (ModelMessage) or as typed parts (UIMessage / multimodal ModelMessage).
 * @param {AnyMessage} message - A UI or model message.
 * @returns {string} The concatenated text content.
 */
function messageText(message: AnyMessage): string {
  const anyMsg = message as { content?: unknown; parts?: unknown };

  if (typeof anyMsg.content === "string") {
    return anyMsg.content;
  }

  const parts = Array.isArray(anyMsg.parts)
    ? anyMsg.parts
    : Array.isArray(anyMsg.content)
      ? anyMsg.content
      : [];

  return parts
    .map((part: unknown) => {
      if (typeof part === "string") return part;
      const p = part as { type?: string; text?: string; content?: string };
      if (p.type && p.type !== "text") return "";
      return p.text ?? p.content ?? "";
    })
    .join("");
}

/**
 * Normalize ChatClient messages into the provider-agnostic {@link ChatMessage}
 * shape consumed by local adapters.
 * @param {Array<AnyMessage>} messages - The conversation history.
 * @returns {ChatMessage[]} Plain role/content messages.
 */
function toChatMessages(messages: AnyMessage[]): ChatMessage[] {
  return messages.map((message) => {
    const role =
      message.role === "assistant" || message.role === "system"
        ? message.role
        : "user";
    return { role, content: messageText(message) };
  });
}

/**
 * Build the runtime-switched chat connection for `useChat`.
 * - `remote`: streams the worker's AG-UI `/v2/chat` endpoint over XHR, attaching
 *   the RevenueCat `X-User-ID` header for subscription verification.
 * - `local`: runs the injected on-device adapter and wraps its text deltas into
 *   the same AG-UI envelope, so the UI consumes both providers identically.
 * @returns {ConnectionAdapter} A connection adapter for `useChat({ connection })`.
 */
export function buildChatConnection(opts: {
  provider: "local" | "remote";
  getUserId: () => string | undefined;
  local: LocalChatAdapter;
}): ConnectionAdapter {
  if (opts.provider === "remote") {
    return xhrHttpStream(`${BASE_URL}/v2/chat`, () => {
      const userId = opts.getUserId();
      return userId ? { headers: { "X-User-ID": userId } } : {};
    });
  }

  return stream((messages, _data, signal) =>
    textDeltasToAgui(opts.local.run(toChatMessages(messages), signal)),
  );
}

/**
 * Consume the worker's AG-UI `/v2/reading` stream as plain text deltas. Reading
 * passages are one-shot and non-chat, so rather than `useChat` this drives the
 * connection imperatively and yields `TEXT_MESSAGE_CONTENT` deltas — suitable for
 * `experimental_streamedQuery`. `lvl` travels in the query string; the transport
 * POSTs an (ignored) empty body.
 * @returns {AsyncIterable<string>} Incremental passage text.
 */
export async function* streamReadingPassageDeltas(opts: {
  level: string;
  getUserId: () => string | undefined;
  signal?: AbortSignal;
}): AsyncIterable<string> {
  const connection = xhrHttpStream(
    `${BASE_URL}/v2/reading?lvl=${encodeURIComponent(opts.level)}`,
    () => {
      const userId = opts.getUserId();
      return userId ? { headers: { "X-User-ID": userId } } : {};
    },
  );

  for await (const chunk of connection.connect([], undefined, opts.signal)) {
    const event = chunk as { type?: string; delta?: string };
    if (event.type === "TEXT_MESSAGE_CONTENT" && event.delta) {
      yield event.delta;
    }
  }
}
