import type { SQLiteDatabase } from "expo-sqlite";

import {
  addKanjiToHistory,
  addToHistory,
  clearHistory,
  getHistory,
  removeHistoryById,
} from "../services/database/history";
import type { DictionaryEntry, KanjiEntry } from "../services/database/types";
import {
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

async function ensureHistoryTable(adapter: ExpoSQLiteTestAdapter) {
  await adapter.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY NOT NULL,
      entry_type TEXT DEFAULT 'word' NOT NULL,
      word_id INTEGER,
      kanji_id INTEGER,
      kanji_character TEXT,
      kanji_meaning TEXT,
      kanji_on_readings TEXT,
      kanji_kun_readings TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (word_id) REFERENCES words (id)
    );
  `);
}

function asDictionaryEntry(row: {
  id: number;
  word: string;
  reading: string;
  reading_hiragana: string | null;
  kanji: string | null;
  position: number;
}): DictionaryEntry {
  return {
    id: row.id,
    word: row.word,
    reading: row.reading,
    readingHiragana: row.reading_hiragana,
    kanji: row.kanji,
    position: row.position,
  };
}

describe("history database operations", () => {
  let adapter: ExpoSQLiteTestAdapter;
  let db: SQLiteDatabase;
  let wordSamples: DictionaryEntry[] = [];
  let kanjiSample: KanjiEntry;

  beforeAll(async () => {
    adapter = await openWritableSeedCopy();
    db = adapter.asSQLiteDatabase();
    await ensureHistoryTable(adapter);

    const rows = await adapter.getAllAsync<{
      id: number;
      word: string;
      reading: string;
      reading_hiragana: string | null;
      kanji: string | null;
      position: number;
    }>(
      "SELECT id, word, reading, reading_hiragana, kanji, position FROM words WHERE word IS NOT NULL ORDER BY id LIMIT 5"
    );
    wordSamples = rows.map(asDictionaryEntry);

    const kanjiRow = await adapter.getFirstAsync<{
      id: number;
      character: string;
    }>("SELECT id, character FROM kanji LIMIT 1");

    kanjiSample = {
      id: kanjiRow!.id,
      character: kanjiRow!.character,
      jis_code: null,
      unicode: null,
      grade: null,
      strokeCount: null,
      frequency: null,
      created_at: "",
      onReadings: ["みず"],
      kunReadings: ["みず"],
      meanings: ["water"],
    };
  });

  afterAll(async () => {
    await adapter.close();
  });

  beforeEach(async () => {
    await clearHistory(db);
  });

  test("history table has expected columns", async () => {
    const columns = await adapter.getAllAsync<{ name: string }>(
      "PRAGMA table_info(history)"
    );

    expect(columns.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "id",
        "entry_type",
        "word_id",
        "kanji_id",
        "kanji_character",
        "kanji_meaning",
        "kanji_on_readings",
        "kanji_kun_readings",
        "created_at",
      ])
    );
  });

  test("getHistory returns empty array initially", async () => {
    const history = await getHistory(db);
    expect(history).toEqual([]);
  });

  test("addToHistory inserts a word entry", async () => {
    await addToHistory(db, wordSamples[0]);

    const history = await getHistory(db);

    expect(history).toHaveLength(1);
    expect(history[0].entryType).toBe("word");
    if (history[0].entryType === "word") {
      expect(history[0].wordId).toBe(wordSamples[0].id);
      expect(history[0].word).toBe(wordSamples[0].word);
    }
  });

  test("addToHistory upserts when same word is added twice", async () => {
    await addToHistory(db, wordSamples[0]);
    const first = await getHistory(db);

    await new Promise((resolve) => setTimeout(resolve, 10));
    await addToHistory(db, wordSamples[0]);
    const second = await getHistory(db);

    expect(second).toHaveLength(1);
    expect(second[0].createdAt).not.toBe(first[0].createdAt);
  });

  test("getHistory orders entries newest-first", async () => {
    for (const entry of wordSamples.slice(0, 3)) {
      await addToHistory(db, entry);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const history = await getHistory(db);

    expect(history).toHaveLength(3);
    if (history[0].entryType === "word") {
      expect(history[0].wordId).toBe(wordSamples[2].id);
    }
  });

  test("getHistory respects the limit", async () => {
    for (const entry of wordSamples.slice(0, 5)) {
      await addToHistory(db, entry);
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    const limited = await getHistory(db, 3);
    expect(limited).toHaveLength(3);
  });

  test("addKanjiToHistory inserts a kanji entry with parsed readings", async () => {
    await addKanjiToHistory(db, kanjiSample);

    const history = await getHistory(db);

    expect(history).toHaveLength(1);
    expect(history[0].entryType).toBe("kanji");
    if (history[0].entryType === "kanji") {
      expect(history[0].character).toBe(kanjiSample.character);
      expect(history[0].onReadings).toEqual(["みず"]);
      expect(history[0].kunReadings).toEqual(["みず"]);
      expect(history[0].meaning).toBe("water");
    }
  });

  test("removeHistoryById deletes the row", async () => {
    await addToHistory(db, wordSamples[0]);
    const [entry] = await getHistory(db);

    const removed = await removeHistoryById(db, entry.id);
    expect(removed).toBe(true);

    expect(await getHistory(db)).toEqual([]);
  });

  test("clearHistory removes everything", async () => {
    await addToHistory(db, wordSamples[0]);
    await addKanjiToHistory(db, kanjiSample);

    expect(await getHistory(db)).toHaveLength(2);

    await clearHistory(db);
    expect(await getHistory(db)).toEqual([]);
  });
});
