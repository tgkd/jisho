import type { StreamChunk } from "@tanstack/ai/client";

/**
 * AG-UI event `type` tags. The string values mirror @tanstack/ai's `EventType`
 * enum and were verified byte-for-event against the worker's live
 * `/v2/chat` `toHttpResponse` output. They are kept as local literals so this
 * module has no runtime dependency on @tanstack/ai (which is ESM-only),
 * keeping it importable from Node unit tests.
 */
const RUN_STARTED = "RUN_STARTED";
const TEXT_MESSAGE_START = "TEXT_MESSAGE_START";
const TEXT_MESSAGE_CONTENT = "TEXT_MESSAGE_CONTENT";
const TEXT_MESSAGE_END = "TEXT_MESSAGE_END";
const RUN_FINISHED = "RUN_FINISHED";

let seq = 0;

/**
 * Generate an id for a run/thread/message. Only needs to be unique within a
 * single stream, so a counter plus timestamp suffices.
 * @param {string} prefix - Short id namespace (e.g. "run", "msg").
 * @returns {string} A locally-unique id.
 */
function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
}

/**
 * Construct a typed AG-UI chunk. The fields are validated structurally by the
 * unit test against the captured server envelope; the cast bridges the local
 * literal `type` to @tanstack/ai's nominal enum union without importing it.
 * @param {Record<string, unknown>} event - The raw AG-UI event object.
 * @returns {StreamChunk} The event typed as a StreamChunk.
 */
function chunk(event: Record<string, unknown>): StreamChunk {
  return event as unknown as StreamChunk;
}

/**
 * Wrap a stream of text deltas in TanStack AI's canonical AG-UI envelope so any
 * local LLM (Apple Intelligence today, ExecuTorch/etc. later) can be consumed by
 * `useChat` through a `stream()` connection. Mirrors the worker's `/v2/chat`
 * output exactly: RUN_STARTED → TEXT_MESSAGE_START → TEXT_MESSAGE_CONTENT×N →
 * TEXT_MESSAGE_END → RUN_FINISHED. Empty deltas are skipped.
 * @param {AsyncIterable<string>} deltas - Incremental text tokens.
 * @returns {AsyncIterable<StreamChunk>} The AG-UI event stream.
 */
export async function* textDeltasToAgui(
  deltas: AsyncIterable<string>,
): AsyncIterable<StreamChunk> {
  const runId = nextId("run");
  const threadId = nextId("thread");
  const messageId = nextId("msg");

  yield chunk({ type: RUN_STARTED, runId, threadId });
  yield chunk({ type: TEXT_MESSAGE_START, messageId, role: "assistant" });

  let content = "";
  for await (const delta of deltas) {
    if (!delta) continue;
    content += delta;
    yield chunk({ type: TEXT_MESSAGE_CONTENT, messageId, delta, content });
  }

  yield chunk({ type: TEXT_MESSAGE_END, messageId });
  yield chunk({ type: RUN_FINISHED, runId, threadId });
}
