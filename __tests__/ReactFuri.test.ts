import { combineFuri } from "@/components/ReactFuri";

describe("ReactFuri - combineFuri", () => {
  it("handles explicit furigana", () => {
    const result = combineFuri("お世辞", "おせじ", "1:せ;2:じ");
    expect(result).toEqual([
      ["", "お"],
      ["せ", "世"],
      ["じ", "辞"],
    ]);
  });

  it("handles smart fallback without furi", () => {
    const result = combineFuri("大人しい", "おとなしい");
    expect(result).toEqual([
      ["おとな", "大人"],
      ["", "しい"],
    ]);
  });

  it("handles words with explicit furi data", () => {
    const result = combineFuri("漢字", "", "0:かん;1:じ");
    expect(result).toEqual([
      ["かん", "漢"],
      ["じ", "字"],
    ]);
  });

  it("handles kana-only words", () => {
    const result = combineFuri("ひらがな", "ひらがな");
    expect(result).toEqual([["", "ひらがな"]]);
  });

  it("handles special compound readings", () => {
    const result = combineFuri("今日", "きょう", "0:きょう");
    expect(result).toEqual([["きょう", "今日"]]);
  });

  it("handles complex word with okurigana", () => {
    const result = combineFuri("お見舞い", "おみまい");
    expect(result).toEqual([
      ["", "お"],
      ["みま", "見舞"],
      ["", "い"],
    ]);
  });

  it("handles word with object furi format", () => {
    const result = combineFuri("漢字", "", { 0: "かん", 1: "じ" });
    expect(result).toEqual([
      ["かん", "漢"],
      ["じ", "字"],
    ]);
  });

  it("returns word only when word equals reading", () => {
    const result = combineFuri("test", "test");
    expect(result).toEqual([["", "test"]]);
  });
});
