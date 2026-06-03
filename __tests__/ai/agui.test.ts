import { textDeltasToAgui } from "@/services/ai/agui";

type Event = Record<string, any>;

async function collect(deltas: string[]): Promise<Event[]> {
  async function* gen(): AsyncIterable<string> {
    for (const d of deltas) yield d;
  }
  const out: Event[] = [];
  for await (const ev of textDeltasToAgui(gen())) {
    out.push(ev as Event);
  }
  return out;
}

describe("textDeltasToAgui", () => {
  it("mirrors the canonical AG-UI envelope captured from /v2/chat", async () => {
    const events = await collect(["こ", "んにち", "は"]);

    expect(events.map((e) => e.type)).toEqual([
      "RUN_STARTED",
      "TEXT_MESSAGE_START",
      "TEXT_MESSAGE_CONTENT",
      "TEXT_MESSAGE_CONTENT",
      "TEXT_MESSAGE_CONTENT",
      "TEXT_MESSAGE_END",
      "RUN_FINISHED",
    ]);

    // run/thread ids present and stable across RUN_STARTED → RUN_FINISHED
    const start = events[0];
    const finish = events[events.length - 1];
    expect(start.runId).toBeTruthy();
    expect(start.threadId).toBeTruthy();
    expect(finish.runId).toBe(start.runId);
    expect(finish.threadId).toBe(start.threadId);

    // message id stable across START → CONTENT → END; role on START
    const messageId = events[1].messageId;
    expect(messageId).toBeTruthy();
    expect(events[1].role).toBe("assistant");
    for (const content of events.slice(2, 5)) {
      expect(content.messageId).toBe(messageId);
    }
    expect(events[5].messageId).toBe(messageId);

    // each content chunk carries the incremental delta + cumulative content
    expect(events[2]).toMatchObject({ delta: "こ", content: "こ" });
    expect(events[3]).toMatchObject({ delta: "んにち", content: "こんにち" });
    expect(events[4]).toMatchObject({ delta: "は", content: "こんにちは" });
  });

  it("skips empty deltas but keeps cumulative content correct", async () => {
    const events = await collect(["a", "", "b"]);
    const contents = events.filter((e) => e.type === "TEXT_MESSAGE_CONTENT");
    expect(contents.map((c) => c.delta)).toEqual(["a", "b"]);
    expect(contents[contents.length - 1].content).toBe("ab");
  });

  it("emits a well-formed envelope for an empty stream", async () => {
    const events = await collect([]);
    expect(events.map((e) => e.type)).toEqual([
      "RUN_STARTED",
      "TEXT_MESSAGE_START",
      "TEXT_MESSAGE_END",
      "RUN_FINISHED",
    ]);
  });
});
