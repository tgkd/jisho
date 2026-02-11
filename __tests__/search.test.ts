import type { SQLiteDatabase } from "expo-sqlite";
import path from "path";
import sqlite3 from "sqlite3";

import { searchDictionary } from "../services/database/search";

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

type SqliteParams = any[] | Record<string, unknown> | undefined;

class ExpoSQLiteTestAdapter {
  private constructor(private readonly db: sqlite3.Database) {}

  static async open(dbPath: string): Promise<ExpoSQLiteTestAdapter> {
    return new Promise((resolve, reject) => {
      const database = new sqlite3.Database(
        dbPath,
        sqlite3.OPEN_READONLY,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(new ExpoSQLiteTestAdapter(database));
          }
        }
      );
    });
  }

  asSQLiteDatabase(): SQLiteDatabase {
    return this as unknown as SQLiteDatabase;
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async all<T = unknown>(sql: string, params?: SqliteParams): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params ?? [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  async get<T = unknown>(sql: string, params?: SqliteParams): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params ?? [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve((row as T) ?? null);
        }
      });
    });
  }

  async getAllAsync<T>(sql: string, params?: any, ...rest: any[]): Promise<T[]> {
    return this.execute<T[]>("all", sql, params, rest);
  }

  async getFirstAsync<T>(sql: string, params?: any, ...rest: any[]): Promise<T | null> {
    return this.execute<T | null>("get", sql, params, rest);
  }

  private execute<T>(
    method: "all" | "get",
    sql: string,
    params?: any,
    rest: any[] = []
  ): Promise<T> {
    const normalized = this.normalizeParams(params, rest);

    return new Promise((resolve, reject) => {
      (this.db as any)[method](sql, normalized, (err: Error | null, result: any) => {
        if (err) {
          reject(err);
        } else if (method === "get") {
          resolve((result ?? null) as T);
        } else {
          resolve(result as T);
        }
      });
    });
  }

  private normalizeParams(first: any, rest: any[]): SqliteParams {
    if (rest.length > 0) {
      return [first, ...rest];
    }

    if (Array.isArray(first)) {
      return first;
    }

    if (first && typeof first === "object") {
      return first as Record<string, unknown>;
    }

    if (first === undefined || first === null) {
      return [];
    }

    return [first];
  }
}

describe("searchDictionary integration", () => {
  let adapter: ExpoSQLiteTestAdapter;
  let db: SQLiteDatabase;
  const databasePath = path.join(
    __dirname,
    "../assets/db/db_20260211_105924.db"
  );

  beforeAll(async () => {
    adapter = await ExpoSQLiteTestAdapter.open(databasePath);
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
});
