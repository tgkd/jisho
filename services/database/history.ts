import { SQLiteDatabase } from "expo-sqlite";
import { DBHistoryEntry, HistoryEntry, DictionaryEntry } from "./types";

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
  const result = await db.getAllAsync<
    DBHistoryEntry & { meaning?: string; history_id?: number }
  >(
    `
    SELECT
      w.id,
      w.word,
      w.reading,
      h.id as history_id,
      h.created_at,
      h.word_id,
      (SELECT meaning FROM meanings WHERE word_id = w.id LIMIT 1) as meaning
    FROM words w
    INNER JOIN history h ON w.id = h.word_id
    ORDER BY h.created_at DESC
    LIMIT ?
    `,
    [limit]
  );

  return result.map((e) => ({
    id: e.history_id || e.id,
    word: e.word,
    reading: e.reading,
    createdAt: e.created_at,
    wordId: e.word_id,
    meaning: e.meaning || "",
  }));
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