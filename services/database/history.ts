import { SQLiteDatabase } from "expo-sqlite";
import { DBHistoryEntry, DictionaryEntry, HistoryEntry } from "./types";

export async function addToHistory(db: SQLiteDatabase, entry: DictionaryEntry) {
  try {
    await db.runAsync("DELETE FROM history WHERE word_id = ?", [entry.id]);

    await db.runAsync(
      "INSERT INTO history (word_id, created_at) VALUES (?, ?)",
      [entry.id, new Date().toISOString()]
    );
  } catch (error) {
    console.error("Failed to add to history:", error);
  }
}

export async function getHistory(
  db: SQLiteDatabase,
  limit = 100
): Promise<HistoryEntry[]> {
  try {
    // First, check if history table exists at all
    try {
      await db.getFirstAsync("SELECT COUNT(*) FROM history LIMIT 1");
    } catch {
      console.warn("History table does not exist, returning empty history");
      return [];
    }

    // Check which schema we're dealing with
    let hasMeaningsTable = false;
    let hasWordGlossesTable = false;

    try {
      await db.getFirstAsync("SELECT COUNT(*) FROM meanings LIMIT 1");
      hasMeaningsTable = true;
      console.log("Found meanings table");
    } catch {
      try {
        await db.getFirstAsync("SELECT COUNT(*) FROM word_glosses LIMIT 1");
        hasWordGlossesTable = true;
      } catch {
        console.warn("Neither meanings nor word_glosses table found, will return history without meanings");
      }
    }

    let query: string;
    if (hasMeaningsTable) {
      // Old schema with meanings table
      query = `
        SELECT
          w.id,
          COALESCE(w.kanji, w.word) as word,
          w.reading,
          h.id as history_id,
          h.created_at,
          h.word_id,
          (SELECT m.meaning FROM meanings m WHERE m.word_id = w.id LIMIT 1) as meaning
        FROM words w
        INNER JOIN history h ON w.id = h.word_id
        ORDER BY h.created_at DESC
        LIMIT ?
      `;
    } else if (hasWordGlossesTable) {
      // New schema with word_glosses and word_senses
      query = `
        SELECT
          w.id,
          COALESCE(wk.kanji, wr.reading) as word,
          wr.reading,
          h.id as history_id,
          h.created_at,
          h.word_id,
          (SELECT wg.gloss FROM word_glosses wg
           INNER JOIN word_senses ws ON wg.sense_id = ws.id
           WHERE ws.word_id = w.id LIMIT 1) as meaning
        FROM words w
        INNER JOIN history h ON w.id = h.word_id
        LEFT JOIN word_kanji wk ON w.id = wk.word_id
        LEFT JOIN word_readings wr ON w.id = wr.word_id
        ORDER BY h.created_at DESC
        LIMIT ?
      `;
    } else {
      // Fallback: no meanings available
      query = `
        SELECT
          w.id,
          COALESCE(wk.kanji, wr.reading) as word,
          wr.reading,
          h.id as history_id,
          h.created_at,
          h.word_id,
          '' as meaning
        FROM words w
        INNER JOIN history h ON w.id = h.word_id
        LEFT JOIN word_kanji wk ON w.id = wk.word_id
        LEFT JOIN word_readings wr ON w.id = wr.word_id
        ORDER BY h.created_at DESC
        LIMIT ?
      `;
    }

    const result = await db.getAllAsync<
      DBHistoryEntry & { meaning?: string; history_id?: number }
    >(query, [limit]);

    return result.map((e) => ({
      id: e.history_id || e.id,
      word: e.word,
      reading: e.reading,
      createdAt: e.created_at,
      wordId: e.word_id,
      meaning: e.meaning || "",
    }));
  } catch (error) {
    console.error("Error in getHistory:", error);
    // Return empty array instead of crashing
    return [];
  }
}

export async function clearHistory(db: SQLiteDatabase) {
  await db.runAsync("DELETE FROM history");
}

export async function removeHistoryById(db: SQLiteDatabase, historyId: number) {
  try {
    await db.runAsync("DELETE FROM history WHERE id = ?", [historyId]);
    return true;
  } catch (error) {
    console.error("Failed to remove history item:", error);
    return false;
  }
}
