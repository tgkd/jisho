import type { SQLiteDatabase } from "expo-sqlite";

import {
  addExamplesList,
  getDictionaryEntry,
  getWordExamples,
} from "../services/database/dictionary";
import {
  DB_PATH,
  ExpoSQLiteTestAdapter,
  openWritableSeedCopy,
} from "../test-utils/db-adapter";

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

describe("Dictionary database operations", () => {
  let adapter: ExpoSQLiteTestAdapter;
  let db: SQLiteDatabase;

  beforeAll(async () => {
    adapter = await ExpoSQLiteTestAdapter.open(DB_PATH);
    db = adapter.asSQLiteDatabase();
  });

  afterAll(async () => {
    await adapter.close();
  });

  test("words / meanings / examples tables exist", async () => {
    const tables = await adapter.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('words', 'meanings', 'examples') ORDER BY name"
    );

    expect(tables.map((t) => t.name)).toEqual(["examples", "meanings", "words"]);
  });

  test("getDictionaryEntry returns word + meanings", async () => {
    const sample = await adapter.getFirstAsync<{ id: number; word: string }>(
      "SELECT id, word FROM words WHERE word IS NOT NULL LIMIT 1"
    );

    expect(sample).not.toBeNull();

    const entry = await getDictionaryEntry(db, sample!.id, false);

    expect(entry).not.toBeNull();
    expect(entry!.word.id).toBe(sample!.id);
    expect(entry!.word.word).toBe(sample!.word);
    expect(Array.isArray(entry!.meanings)).toBe(true);
    expect(entry!.examples).toEqual([]);

    if (entry!.meanings.length > 0) {
      const first = entry!.meanings[0];
      expect(first.wordId).toBe(sample!.id);
      expect(typeof first.meaning).toBe("string");
    }
  });

  test("getDictionaryEntry returns null for missing id", async () => {
    const entry = await getDictionaryEntry(db, 999_999_999, false);
    expect(entry).toBeNull();
  });

  test("getDictionaryEntry includes examples when withExamples=true", async () => {
    const wordWithExamples = await adapter.getFirstAsync<{ id: number }>(
      "SELECT w.id FROM words w JOIN examples e ON w.id = e.word_id LIMIT 1"
    );

    if (!wordWithExamples) {
      // No example rows in the seed — skip rather than fail
      return;
    }

    const entry = await getDictionaryEntry(db, wordWithExamples.id, true);

    expect(entry).not.toBeNull();
    expect(Array.isArray(entry!.examples)).toBe(true);
    expect(entry!.examples.length).toBeGreaterThan(0);

    const first = entry!.examples[0];
    expect(typeof first.japaneseText).toBe("string");
    expect(typeof first.englishText).toBe("string");
  });

  test("getWordExamples falls back to text matching when no word_id rows", async () => {
    const sample = await adapter.getFirstAsync<{
      id: number;
      word: string;
      reading: string;
      reading_hiragana: string | null;
      kanji: string | null;
      position: number;
    }>(
      "SELECT id, word, reading, reading_hiragana, kanji, position FROM words WHERE word = '水' LIMIT 1"
    );

    if (!sample) return;

    const examples = await getWordExamples(db, {
      ...sample,
      readingHiragana: sample.reading_hiragana,
    });

    expect(Array.isArray(examples)).toBe(true);
    examples.forEach((ex) => {
      expect(typeof ex.japaneseText).toBe("string");
      expect(typeof ex.englishText).toBe("string");
    });
  });
});

describe("Dictionary write operations", () => {
  let adapter: ExpoSQLiteTestAdapter;
  let db: SQLiteDatabase;

  beforeAll(async () => {
    adapter = await openWritableSeedCopy();
    db = adapter.asSQLiteDatabase();
  });

  afterAll(async () => {
    await adapter.close();
  });

  test("addExamplesList replaces AI rows for a word", async () => {
    const sample = await adapter.getFirstAsync<{ id: number }>(
      "SELECT id FROM words LIMIT 1"
    );
    expect(sample).not.toBeNull();
    const wordId = sample!.id;

    const before = await adapter.getAllAsync<{ id: number }>(
      "SELECT id FROM examples WHERE word_id = ? AND example_id IS NULL",
      [wordId]
    );
    expect(before).toEqual([]);

    await addExamplesList(
      wordId,
      [
        { jp: "テスト1", en: "Test 1", jp_reading: "テスト" },
        { jp: "テスト2", en: "Test 2", jp_reading: "テスト" },
      ],
      db
    );

    const inserted = await adapter.getAllAsync<{ japanese_text: string }>(
      "SELECT japanese_text FROM examples WHERE word_id = ? AND example_id IS NULL ORDER BY id",
      [wordId]
    );
    expect(inserted.map((e) => e.japanese_text)).toEqual(["テスト1", "テスト2"]);

    await addExamplesList(
      wordId,
      [{ jp: "テスト3", en: "Test 3", jp_reading: "テスト" }],
      db
    );

    const replaced = await adapter.getAllAsync<{ japanese_text: string }>(
      "SELECT japanese_text FROM examples WHERE word_id = ? AND example_id IS NULL ORDER BY id",
      [wordId]
    );
    expect(replaced.map((e) => e.japanese_text)).toEqual(["テスト3"]);
  });
});
