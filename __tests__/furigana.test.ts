import type { SQLiteDatabase } from "expo-sqlite";

import { getFuriganaForText } from "../services/database/furigana";
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

async function ensureFuriganaTable(adapter: ExpoSQLiteTestAdapter) {
  await adapter.exec(`
    CREATE TABLE IF NOT EXISTS furigana (
      id INTEGER PRIMARY KEY,
      text TEXT NOT NULL,
      reading TEXT NOT NULL,
      reading_hiragana TEXT,
      segments TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_furigana_text_reading ON furigana(text, reading);
    CREATE INDEX IF NOT EXISTS idx_furigana_text ON furigana(text);
  `);
}

describe("getFuriganaForText", () => {
  let adapter: ExpoSQLiteTestAdapter;
  let db: SQLiteDatabase;

  beforeAll(async () => {
    adapter = await openWritableSeedCopy();
    db = adapter.asSQLiteDatabase();
    await ensureFuriganaTable(adapter);

    await adapter.runAsync(
      `INSERT OR IGNORE INTO furigana (text, reading, reading_hiragana, segments) VALUES
        (?, ?, ?, ?),
        (?, ?, ?, ?)`,
      [
        "言う",
        "いう",
        "いう",
        '[{"ruby":"言","rt":"い"},{"ruby":"う"}]',
        "今日",
        "きょう",
        "きょう",
        '[{"ruby":"今日","rt":"きょう"}]',
      ]
    );
  });

  afterAll(async () => {
    await adapter.close();
  });

  test("returns parsed segments for a known text", async () => {
    const result = await getFuriganaForText(db, "言う");

    expect(result).not.toBeNull();
    expect(result!.text).toBe("言う");
    expect(result!.reading).toBe("いう");
    expect(result!.segments).toEqual([
      { ruby: "言", rt: "い" },
      { ruby: "う" },
    ]);
  });

  test("returns null for unknown text", async () => {
    const result = await getFuriganaForText(db, "存在しない単語xyz");
    expect(result).toBeNull();
  });

  test("handles single-segment readings", async () => {
    const result = await getFuriganaForText(db, "今日");

    expect(result).not.toBeNull();
    expect(result!.segments).toHaveLength(1);
    expect(result!.segments[0]).toEqual({ ruby: "今日", rt: "きょう" });
  });
});
