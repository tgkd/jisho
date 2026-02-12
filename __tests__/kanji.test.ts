import type { SQLiteDatabase } from "expo-sqlite";

import {
  getKanji, getKanjiById, getKanjiByUnicode, getKanjiList, searchKanji
} from "../services/database/kanji";
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

describe("Kanji Database Operations", () => {
  let adapter: ExpoSQLiteTestAdapter;
  let db: SQLiteDatabase;

  beforeAll(async () => {
    adapter = await ExpoSQLiteTestAdapter.open(DB_PATH);
    db = adapter.asSQLiteDatabase();
  });

  afterAll(async () => {
    await adapter.close();
  });

  test("kanji table has expected columns", async () => {
    const columns = await adapter.getAllAsync<{ name: string }>(
      "PRAGMA table_info(kanji)"
    );
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toEqual(
      expect.arrayContaining([
        "id",
        "character",
        "unicode",
        "meanings",
        "on_readings",
        "kun_readings",
        "grade",
        "stroke_count",
        "frequency",
      ])
    );
  });

  test('getKanji("水") returns water kanji with readings', async () => {
    const entry = await getKanji(db, "水");

    expect(entry).not.toBeNull();
    expect(entry!.character).toBe("水");
    expect(entry!.meanings).toEqual(expect.arrayContaining(["water"]));
    expect(Array.isArray(entry!.onReadings)).toBe(true);
    expect(Array.isArray(entry!.kunReadings)).toBe(true);
  });

  test("getKanji returns null for non-existent multi-char string", async () => {
    const entry = await getKanji(db, "非存在");
    expect(entry).toBeNull();
  });

  test('searchKanji by meaning "water" returns results', async () => {
    const results = await searchKanji(db, "water");

    expect(results.length).toBeGreaterThan(0);

    const firstMeanings = results[0].meanings;
    expect(firstMeanings).not.toBeNull();
    expect(
      firstMeanings!.some((m) => m.toLowerCase().includes("water"))
    ).toBe(true);
  });

  test('searchKanji by character "水" includes it in results', async () => {
    const results = await searchKanji(db, "水");

    expect(results.length).toBeGreaterThan(0);

    const hasMizu = results.some((r) => r.character === "水");
    expect(hasMizu).toBe(true);
  });

  test("searchKanji respects limit parameter", async () => {
    const results = await searchKanji(db, "water", 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  test("getKanjiByUnicode returns matching character", async () => {
    const waterUnicode = "U6c34";
    const entry = await getKanjiByUnicode(db, waterUnicode);

    expect(entry).not.toBeNull();
    expect(entry!.character).toBe("水");
  });

  test("getKanjiById returns matching character", async () => {
    const water = await getKanji(db, "水");
    expect(water).not.toBeNull();

    const entry = await getKanjiById(db, water!.id);
    expect(entry).not.toBeNull();
    expect(entry!.character).toBe("水");
  });

  test("getKanjiById returns null for non-existent id", async () => {
    const entry = await getKanjiById(db, 999999);
    expect(entry).toBeNull();
  });

  test("getKanjiList returns 50 entries with parsed fields", async () => {
    const list = await getKanjiList(db);

    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(50);

    for (const entry of list) {
      expect(entry).toHaveProperty("character");
      expect(entry).toHaveProperty("meanings");
      expect(entry).toHaveProperty("onReadings");
      expect(entry).toHaveProperty("kunReadings");
    }
  });

  test("entries have grade, strokeCount, and frequency fields", async () => {
    const entry = await getKanji(db, "水");
    expect(entry).not.toBeNull();

    expect("grade" in entry!).toBe(true);
    expect("strokeCount" in entry!).toBe(true);
    expect("frequency" in entry!).toBe(true);

    expect(
      typeof entry!.grade === "number" || entry!.grade === null
    ).toBe(true);
    expect(
      typeof entry!.strokeCount === "number" || entry!.strokeCount === null
    ).toBe(true);
    expect(
      typeof entry!.frequency === "number" || entry!.frequency === null
    ).toBe(true);
  });

  test("parseKanjiResult returns null for missing readings", async () => {
    const allKanji = await adapter.getAllAsync<{
      character: string;
      on_readings: string | null;
      kun_readings: string | null;
    }>(
      "SELECT character, on_readings, kun_readings FROM kanji WHERE on_readings IS NULL OR kun_readings IS NULL LIMIT 1"
    );

    if (allKanji.length > 0) {
      const entry = await getKanji(db, allKanji[0].character);
      expect(entry).not.toBeNull();

      if (allKanji[0].on_readings === null) {
        expect(entry!.onReadings).toBeNull();
      }
      if (allKanji[0].kun_readings === null) {
        expect(entry!.kunReadings).toBeNull();
      }
    }
  });
});
