import {
  buildFuriganaSegmentsFromTokens,
  processJpExampleText,
} from "../services/parse";
import type { ReadingToken } from "../services/parse";

describe("processJpExampleText", () => {
  it("extracts readings and normalized forms while discarding markers", () => {
    const breakdown = [
      "話(はな)す{話した} ~ と [02]",
      "静か(しずか) に",
    ].join("\n");

    const tokens = processJpExampleText(breakdown);

    expect(tokens).toEqual([
      { text: "話", reading: "はな", form: "話した" },
      { text: "と" },
      { text: "静か", reading: "しずか" },
      { text: "に" },
    ]);
  });

  it("returns an empty array for blank input", () => {
    expect(processJpExampleText("\n   \n")).toEqual([]);
    expect(processJpExampleText(undefined)).toEqual([]);
  });
});

describe("buildFuriganaSegmentsFromTokens", () => {
  it("maps parsed tokens into furigana segments", () => {
    const breakdown =
      "彼(かれ)[01] は 忙しい(いそがしい) 生活 の 中(なか) で(#2028980) 家族 と 会う[01] 事(こと){こと} が 無い{ない}";

    const tokens = processJpExampleText(breakdown);
    const segments = buildFuriganaSegmentsFromTokens(tokens);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments).toEqual(
      expect.arrayContaining([
        { ruby: "彼", rt: "かれ" },
        { ruby: "忙しい", rt: "いそがしい" },
        expect.objectContaining({ ruby: "生活" }),
        { ruby: "こと", rt: "こと" },
        expect.objectContaining({ ruby: "ない" }),
      ])
    );
  });

  it("filters out tokens without surface text", () => {
    const breakdown = "   ";
    const tokens = processJpExampleText(breakdown);
    const segments = buildFuriganaSegmentsFromTokens(tokens);

    expect(tokens).toHaveLength(0);
    expect(segments).toEqual([]);
  });

  it("prefers normalized forms and trims readings when building segments", () => {
    const tokens: ReadingToken[] = [
      { text: "走る", reading: "  はしる  ", form: "走った" },
      { text: "猫" },
      { text: "  ", reading: "  " },
    ];

    const segments = buildFuriganaSegmentsFromTokens(tokens);

    expect(segments).toEqual([
      { ruby: "走った", rt: "はしる" },
      { ruby: "猫" },
    ]);
  });
});
