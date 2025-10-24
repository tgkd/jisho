import {
  extractSegmentsFromTokens,
  parseSegmentsFromJson,
} from "../services/parse";

describe("parseSegmentsFromJson", () => {
  it("parses valid JSON array into FuriganaSegment objects", () => {
    const json = JSON.stringify([
      { ruby: "例えば", rt: "たとえば" },
      { ruby: "君", rt: "きみ" },
      { ruby: "は" },
    ]);

    const segments = parseSegmentsFromJson(json);

    expect(segments).toEqual([
      { ruby: "例えば", rt: "たとえば" },
      { ruby: "君", rt: "きみ" },
      { ruby: "は" },
    ]);
  });

  it("filters out segments without ruby property", () => {
    const json = JSON.stringify([
      { ruby: "猫", rt: "ねこ" },
      { rt: "invalid" }, // missing ruby
      { ruby: "" }, // empty ruby
      { ruby: "犬" },
    ]);

    const segments = parseSegmentsFromJson(json);

    expect(segments).toEqual([
      { ruby: "猫", rt: "ねこ" },
      { ruby: "犬" },
    ]);
  });

  it("trims rt values and converts empty strings to undefined", () => {
    const json = JSON.stringify([
      { ruby: "走る", rt: "  はしる  " },
      { ruby: "猫", rt: "" },
      { ruby: "犬", rt: "   " },
    ]);

    const segments = parseSegmentsFromJson(json);

    expect(segments).toEqual([
      { ruby: "走る", rt: "はしる" },
      { ruby: "猫" },
      { ruby: "犬" },
    ]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseSegmentsFromJson("not json")).toEqual([]);
    expect(parseSegmentsFromJson("{invalid}")).toEqual([]);
    expect(parseSegmentsFromJson("")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    const json = JSON.stringify({ ruby: "test" });
    expect(parseSegmentsFromJson(json)).toEqual([]);
  });

  it("filters out non-object elements", () => {
    const json = JSON.stringify([
      { ruby: "猫", rt: "ねこ" },
      "string",
      123,
      null,
      { ruby: "犬", rt: "いぬ" },
    ]);

    const segments = parseSegmentsFromJson(json);

    expect(segments).toEqual([
      { ruby: "猫", rt: "ねこ" },
      { ruby: "犬", rt: "いぬ" },
    ]);
  });
});

describe("extractSegmentsFromTokens", () => {
  it("extracts segments from token breakdown format", () => {
    const tokens = "例えば 君(きみ)[01] は 英語 が 好き(すき) ですか";
    const segments = extractSegmentsFromTokens(tokens);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruby: "例えば" }),
        { ruby: "君", rt: "きみ" },
        expect.objectContaining({ ruby: "は" }),
        expect.objectContaining({ ruby: "英語" }),
        expect.objectContaining({ ruby: "が" }),
        { ruby: "好き", rt: "すき" },
        expect.objectContaining({ ruby: "ですか" }),
      ])
    );
  });

  it("parses JSON format when tokens start with [ or {", () => {
    const jsonTokens = JSON.stringify([
      { ruby: "猫", rt: "ねこ" },
      { ruby: "が" },
      { ruby: "好き", rt: "すき" },
    ]);

    const segments = extractSegmentsFromTokens(jsonTokens);

    expect(segments).toEqual([
      { ruby: "猫", rt: "ねこ" },
      { ruby: "が" },
      { ruby: "好き", rt: "すき" },
    ]);
  });

  it("falls back to text parsing if JSON parsing fails", () => {
    const invalidJson = "[not valid json but 猫(ねこ) token";
    const segments = extractSegmentsFromTokens(invalidJson);

    // Should attempt text parsing as fallback
    expect(segments.length).toBeGreaterThan(0);
  });

  it("returns empty array for null or undefined tokens", () => {
    expect(extractSegmentsFromTokens(null)).toEqual([]);
    expect(extractSegmentsFromTokens(undefined)).toEqual([]);
  });

  it("returns empty array for empty or whitespace tokens", () => {
    expect(extractSegmentsFromTokens("")).toEqual([]);
    expect(extractSegmentsFromTokens("   ")).toEqual([]);
    expect(extractSegmentsFromTokens("\n\t  ")).toEqual([]);
  });

  it("handles complex token breakdown with markers", () => {
    const tokens = "彼(かれ)[01] は 忙しい(いそがしい) 生活 の 中(なか) で(#2028980)";
    const segments = extractSegmentsFromTokens(tokens);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments).toEqual(
      expect.arrayContaining([
        { ruby: "彼", rt: "かれ" },
        { ruby: "忙しい", rt: "いそがしい" },
        expect.objectContaining({ ruby: "生活" }),
        { ruby: "中", rt: "なか" },
      ])
    );
  });

  it("handles normalized forms in curly braces", () => {
    const tokens = "走る{走った} 猫(ねこ) を 見る{見た}";
    const segments = extractSegmentsFromTokens(tokens);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruby: "走った" }),
        { ruby: "猫", rt: "ねこ" },
        expect.objectContaining({ ruby: "を" }),
        expect.objectContaining({ ruby: "見た" }),
      ])
    );
  });

  it("preserves segments without readings", () => {
    const tokens = "例えば これ は ペン です";
    const segments = extractSegmentsFromTokens(tokens);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruby: "例えば" }),
        expect.objectContaining({ ruby: "これ" }),
        expect.objectContaining({ ruby: "は" }),
        expect.objectContaining({ ruby: "ペン" }),
        expect.objectContaining({ ruby: "です" }),
      ])
    );
  });

  it("handles mixed kanji and kana with selective readings", () => {
    const tokens = "今日(きょう) は 良い{いい} 天気 です";
    const segments = extractSegmentsFromTokens(tokens);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments).toEqual(
      expect.arrayContaining([
        { ruby: "今日", rt: "きょう" },
        expect.objectContaining({ ruby: "は" }),
        expect.objectContaining({ ruby: "いい" }),
        expect.objectContaining({ ruby: "天気" }),
        expect.objectContaining({ ruby: "です" }),
      ])
    );
  });
});

describe("extractSegmentsFromTokens - real database examples", () => {
  it("processes example from database: 例えば 君(きみ)[01] は 英語 が 好き(すき) ですか", () => {
    const tokens = "例えば 君(きみ)[01] は 英語 が 好き(すき) ですか";
    const segments = extractSegmentsFromTokens(tokens);

    expect(segments).toHaveLength(7);
    expect(segments[0]).toEqual({ ruby: "例えば" });
    expect(segments[1]).toEqual({ ruby: "君", rt: "きみ" });
    expect(segments[2]).toEqual({ ruby: "は" });
    expect(segments[3]).toEqual({ ruby: "英語" });
    expect(segments[4]).toEqual({ ruby: "が" });
    expect(segments[5]).toEqual({ ruby: "好き", rt: "すき" });
    expect(segments[6]).toEqual({ ruby: "ですか" });
  });

  it("processes example: 例えば 倫敦{ロンドン} は 今(いま) は 朝(あさ) 時(じ)[01] です", () => {
    const tokens = "例えば 倫敦{ロンドン} は 今(いま) は 朝(あさ) 時(じ)[01] です";
    const segments = extractSegmentsFromTokens(tokens);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruby: "例えば" }),
        expect.objectContaining({ ruby: "ロンドン" }),
        expect.objectContaining({ ruby: "は" }),
        { ruby: "今", rt: "いま" },
        { ruby: "朝", rt: "あさ" },
        { ruby: "時", rt: "じ" },
        expect.objectContaining({ ruby: "です" }),
      ])
    );
  });

  it("processes example: 例えば 猫(ねこ)[01] や 犬[01] の[01]{の} 様な{ような} 動物 が 好き(すき) です", () => {
    const tokens =
      "例えば 猫(ねこ)[01] や 犬[01] の[01]{の} 様な{ような} 動物 が 好き(すき) です";
    const segments = extractSegmentsFromTokens(tokens);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruby: "例えば" }),
        { ruby: "猫", rt: "ねこ" },
        expect.objectContaining({ ruby: "や" }),
        expect.objectContaining({ ruby: "犬" }),
        expect.objectContaining({ ruby: "の" }),
        expect.objectContaining({ ruby: "ような" }),
        expect.objectContaining({ ruby: "動物" }),
        expect.objectContaining({ ruby: "が" }),
        { ruby: "好き", rt: "すき" },
        expect.objectContaining({ ruby: "です" }),
      ])
    );
  });
});
