import { SQLiteDatabase } from "expo-sqlite";
import { DBKanji, KanjiEntry } from "./types";

function parseKanjiResult(result: DBKanji): KanjiEntry {
  const onReadings = result.on_readings
    ? JSON.parse(result.on_readings)
    : null;
  const kunReadings = result.kun_readings
    ? JSON.parse(result.kun_readings)
    : null;
  const meanings = result.meanings ? JSON.parse(result.meanings) : null;

  return {
    id: result.id,
    character: result.character,
    jis_code: result.jis_code,
    unicode: result.unicode,
    grade: result.grade,
    strokeCount: result.stroke_count,
    frequency: result.frequency,
    created_at: result.created_at,
    onReadings,
    kunReadings,
    meanings,
  };
}

export async function getKanji(
  db: SQLiteDatabase,
  character: string
): Promise<KanjiEntry | null> {
  try {
    const result = await db.getFirstAsync<DBKanji>(
      "SELECT * FROM kanji WHERE character = ?",
      [character]
    );

    if (!result) {
      return null;
    }

    return parseKanjiResult(result);
  } catch (error) {
    console.error("Failed to get kanji data:", error);
    return null;
  }
}

export async function searchKanji(
  db: SQLiteDatabase,
  query: string,
  limit: number = 20
): Promise<KanjiEntry[]> {
  try {
    const results = await db.getAllAsync<DBKanji>(
      `SELECT * FROM kanji
       WHERE character LIKE ? OR meanings LIKE ?
       ORDER BY id
       LIMIT ?`,
      [`%${query}%`, `%${query}%`, limit]
    );

    return results.map(parseKanjiResult);
  } catch (error) {
    console.error("Failed to search kanji:", error);
    return [];
  }
}

export async function getKanjiByUnicode(
  db: SQLiteDatabase,
  unicode: string
): Promise<KanjiEntry | null> {
  try {
    const result = await db.getFirstAsync<DBKanji>(
      "SELECT * FROM kanji WHERE unicode = ?",
      [unicode]
    );

    if (!result) {
      return null;
    }

    return parseKanjiResult(result);
  } catch (error) {
    console.error("Failed to get kanji by unicode:", error);
    return null;
  }
}

export async function getKanjiById(
  db: SQLiteDatabase,
  id: number
): Promise<KanjiEntry | null> {
  try {
    const result = await db.getFirstAsync<DBKanji>(
      "SELECT * FROM kanji WHERE id = ?",
      [id]
    );

    if (!result) {
      return null;
    }

    return parseKanjiResult(result);
  } catch (error) {
    console.error("Failed to get kanji by id:", error);
    return null;
  }
}

export function getKanjiList(db: SQLiteDatabase): Promise<KanjiEntry[]> {
  return db
    .getAllAsync<DBKanji>("SELECT * FROM kanji ORDER BY RANDOM() LIMIT 50")
    .then((results) => {
      return results.map(parseKanjiResult);
    });
}