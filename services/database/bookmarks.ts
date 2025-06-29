import { SQLiteDatabase } from "expo-sqlite";
import { DBDictEntry, DictionaryEntry } from "./types";

export async function getBookmarks(
  db: SQLiteDatabase
): Promise<Array<DictionaryEntry & { meaning?: string }>> {
  try {
    const res = await db.getAllAsync<DBDictEntry & { meaning?: string }>(
      `SELECT words.*,
          (SELECT meaning FROM meanings WHERE word_id = words.id LIMIT 1) as meaning
       FROM words
       JOIN bookmarks ON bookmarks.word_id = words.id
       ORDER BY bookmarks.created_at DESC`
    );

    return res.map((w) => ({
      ...w,
      readingHiragana: w.reading_hiragana,
    }));
  } catch (error) {
    console.error("Error getting bookmarks:", error);
    return [];
  }
}

export async function isBookmarked(
  db: SQLiteDatabase,
  wordId: number
): Promise<boolean> {
  const result = await db.getFirstAsync(
    "SELECT id FROM bookmarks WHERE word_id = ?",
    [wordId]
  );
  return !!result;
}

export async function addBookmark(db: SQLiteDatabase, wordId: number) {
  await db.runAsync(
    "INSERT INTO bookmarks (word_id, created_at) VALUES (?, ?)",
    [wordId, new Date().toISOString()]
  );
}

export async function removeBookmark(db: SQLiteDatabase, wordId: number) {
  await db.runAsync("DELETE FROM bookmarks WHERE word_id = ?", [wordId]);
}

export async function clearBookmarks(db: SQLiteDatabase): Promise<boolean> {
  try {
    await db.runAsync("DELETE FROM bookmarks");
    return true;
  } catch (error) {
    console.error("Failed to clear bookmarks:", error);
    return false;
  }
}