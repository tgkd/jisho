import type { SQLiteDatabase } from "expo-sqlite";

import { searchDictionary } from "../services/database/search";
import { DB_PATH, ExpoSQLiteTestAdapter } from "../test-utils/db-adapter";

jest.mock("expo-sqlite", () => ({}), { virtual: true });

jest.mock("expo-file-system", () => {
  class MockDirectory {}

  class MockFile {
    get exists() {
      return false;
    }

    delete() {}
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: { document: "", cache: "" },
  };
});

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}));

describe("searchDictionary integration", () => {
  let adapter: ExpoSQLiteTestAdapter;
  let db: SQLiteDatabase;

  beforeAll(async () => {
    adapter = await ExpoSQLiteTestAdapter.open(DB_PATH);
    db = adapter.asSQLiteDatabase();
  });

  afterAll(async () => {
    await adapter.close();
  });

  test("words table contains expected columns", async () => {
    const columns = await adapter.getAllAsync<{ name: string }>(
      "PRAGMA table_info(words)"
    );
    const columnNames = columns.map((column) => column.name);

    expect(columnNames).toEqual(
      expect.arrayContaining([
        "word",
        "reading",
        "reading_hiragana",
        "kanji",
      ])
    );
  });

  test("searchDictionary ranks exact reading matches first", async () => {
    const result = await searchDictionary(db, "かど", { limit: 10 });

    expect(result.error).toBeUndefined();
    expect(result.words.length).toBeGreaterThan(0);

    const kadoIndex = result.words.findIndex(
      (word) => word.word === "角" || word.kanji === "角"
    );

    expect(kadoIndex).toBeGreaterThan(-1);
    expect(kadoIndex).toBeLessThan(5);

    const kadoEntry = result.words[kadoIndex];
    expect(kadoEntry.readingHiragana).toBe("かど");
  });

  test("single kanji queries resolve through direct lookup", async () => {
    const result = await searchDictionary(db, "角", { limit: 5 });

    expect(result.error).toBeUndefined();
    expect(result.words.length).toBeGreaterThan(0);

    const kadoIndex = result.words.findIndex(
      (wordEntry) =>
        (wordEntry.word === "角" || wordEntry.kanji === "角") &&
        wordEntry.readingHiragana === "かど"
    );

    expect(kadoIndex).toBeGreaterThan(-1);
    expect(kadoIndex).toBeLessThan(5);
  });

  test("english queries return matching meanings", async () => {
    const result = await searchDictionary(db, "corner", { limit: 10 });

    expect(result.error).toBeUndefined();
    expect(result.words.length).toBeGreaterThan(0);

    const containsCornerMeaning = Array.from(result.meanings.values()).some(
      (meaningList) =>
        meaningList.some((meaning) =>
          meaning.meaning.toLowerCase().includes("corner")
        )
    );

    expect(containsCornerMeaning).toBe(true);
  });

  test("romaji queries map to japanese results", async () => {
    const result = await searchDictionary(db, "Shinkansen", { limit: 10 });

    expect(result.error).toBeUndefined();
    expect(result.words.length).toBeGreaterThan(0);

    const hasShinkansen = result.words.some(
      (wordEntry) =>
        wordEntry.word === "新幹線" || wordEntry.readingHiragana === "しんかんせん"
    );

    expect(hasShinkansen).toBe(true);
  });

  test("katakana input matches hiragana readings", async () => {
    const result = await searchDictionary(db, "カド", { limit: 10 });

    expect(result.error).toBeUndefined();
    expect(result.words.length).toBeGreaterThan(0);

    const containsReadingMatch = result.words.some(
      (wordEntry) => wordEntry.readingHiragana === "かど"
    );

    expect(containsReadingMatch).toBe(true);
  });

  test("queries below minimum length return descriptive error", async () => {
    const result = await searchDictionary(db, "", { minQueryLength: 2 });

    expect(result.words).toEqual([]);
    expect(result.error).toBe("Query must be at least 2 character(s) long");
  });

  test("kanji compound search returns results", async () => {
    const result = await searchDictionary(db, "食べる", { limit: 10 });

    expect(result.error).toBeUndefined();
    expect(result.words.length).toBeGreaterThan(0);

    const hasTaberu = result.words.some(
      (w) => w.word === "食べる" || w.readingHiragana === "たべる"
    );
    expect(hasTaberu).toBe(true);
  });

  test("katakana loanword search returns results", async () => {
    const result = await searchDictionary(db, "テレビ", { limit: 10 });

    expect(result.error).toBeUndefined();
    expect(result.words.length).toBeGreaterThan(0);

    const hasTerebi = result.words.some(
      (w) => w.word === "テレビ" || w.readingHiragana === "てれび"
    );
    expect(hasTerebi).toBe(true);
  });

  test("prefix matching surfaces expected results", async () => {
    const result = await searchDictionary(db, "たべ", { limit: 20 });

    expect(result.error).toBeUndefined();
    expect(result.words.length).toBeGreaterThan(0);

    const hasTaberu = result.words.some(
      (w) => w.word === "食べる" || w.readingHiragana === "たべる"
    );
    expect(hasTaberu).toBe(true);
  });

  test("multi-word english query returns results", async () => {
    const result = await searchDictionary(db, "to eat", { limit: 10 });

    expect(result.error).toBeUndefined();
    expect(result.words.length).toBeGreaterThan(0);

    const hasEatMeaning = Array.from(result.meanings.values()).some(
      (meaningList) =>
        meaningList.some((m) => m.meaning.toLowerCase().includes("eat"))
    );
    expect(hasEatMeaning).toBe(true);
  });

  test("withMeanings: false omits meanings from result", async () => {
    const result = await searchDictionary(db, "水", {
      limit: 5,
      withMeanings: false,
    });

    expect(result.error).toBeUndefined();
    expect(result.words.length).toBeGreaterThan(0);
    expect(result.meanings.size).toBe(0);
  });

  test("limit option restricts result count", async () => {
    const result = await searchDictionary(db, "water", { limit: 3 });

    expect(result.error).toBeUndefined();
    expect(result.words.length).toBeLessThanOrEqual(3);
  });

  test("query too complex returns error", async () => {
    const longQuery = "a".repeat(65);
    const result = await searchDictionary(db, longQuery, { limit: 10 });

    expect(result.words).toEqual([]);
    expect(result.error).toBe("Query is too long or complex to process");
  });

  test("whitespace-only query returns minimum length error", async () => {
    const result = await searchDictionary(db, "   ", { minQueryLength: 1 });

    expect(result.words).toEqual([]);
    expect(result.error).toBeDefined();
  });

  test("gibberish query returns empty results without error", async () => {
    const result = await searchDictionary(db, "xyzqqq", { limit: 10 });

    expect(result.words).toEqual([]);
    expect(result.error).toBeUndefined();
  });

  test("results have no duplicate word+reading pairs", async () => {
    const result = await searchDictionary(db, "かど", { limit: 50 });

    expect(result.error).toBeUndefined();

    const seen = new Set<string>();
    for (const w of result.words) {
      const key = `${w.word}::${w.readingHiragana}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  describe("sequential typing simulation", () => {
    test("each keystroke produces valid results for progressive input", async () => {
      const fullWord = "たべる";
      const queries = fullWord.split("").map((_, i) => fullWord.slice(0, i + 1));

      for (const query of queries) {
        const result = await searchDictionary(db, query, { limit: 10 });
        expect(result.error).toBeUndefined();
        expect(Array.isArray(result.words)).toBe(true);
      }
    });

    test("aborting earlier searches does not affect the final result", async () => {
      const fullWord = "しんかんせん";
      const queries = fullWord.split("").map((_, i) => fullWord.slice(0, i + 1));

      const controllers = queries.map(() => new AbortController());

      const searches = queries.map((query, i) =>
        searchDictionary(db, query, { limit: 10, signal: controllers[i].signal })
      );

      for (let i = 0; i < controllers.length - 1; i++) {
        controllers[i].abort();
      }

      const results = await Promise.allSettled(searches);

      for (let i = 0; i < results.length - 1; i++) {
        const r = results[i];
        expect(
          r.status === "rejected" || r.status === "fulfilled"
        ).toBe(true);
      }

      const last = results[results.length - 1];
      expect(last.status).toBe("fulfilled");

      if (last.status === "fulfilled") {
        expect(last.value.error).toBeUndefined();
        expect(last.value.words.length).toBeGreaterThan(0);

        const hasShinkansen = last.value.words.some(
          (w) => w.word === "新幹線" || w.readingHiragana === "しんかんせん"
        );
        expect(hasShinkansen).toBe(true);
      }
    });

    test("aborted search throws AbortError", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        searchDictionary(db, "たべる", { limit: 10, signal: controller.signal })
      ).rejects.toThrow("Search cancelled");
    });

    test("final query result is correct after sequential searches", async () => {
      const queries = ["w", "wa", "wat", "wate", "water"];

      let lastResult;
      for (const query of queries) {
        lastResult = await searchDictionary(db, query, { limit: 10 });
      }

      expect(lastResult!.error).toBeUndefined();
      expect(lastResult!.words.length).toBeGreaterThan(0);

      const hasWaterMeaning = Array.from(lastResult!.meanings.values()).some(
        (meaningList) =>
          meaningList.some((m) => m.meaning.toLowerCase().includes("water"))
      );
      expect(hasWaterMeaning).toBe(true);
    });
  });
});
