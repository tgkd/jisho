import { SQLiteDatabase } from "expo-sqlite";
import { DBHistoryEntry, DictionaryEntry, HistoryEntry, KanjiEntry } from "./types";

/**
 * Adds a word entry to search history
 */
export async function addToHistory(db: SQLiteDatabase, entry: DictionaryEntry) {
  try {
    await db.runAsync("DELETE FROM history WHERE entry_type = 'word' AND word_id = ?", [entry.id]);

    await db.runAsync(
      "INSERT INTO history (entry_type, word_id, created_at) VALUES (?, ?, ?)",
      ['word', entry.id, new Date().toISOString()]
    );
  } catch (error) {
    console.error("Failed to add word to history:", error);
  }
}

/**
 * Adds a kanji entry to search history
 */
export async function addKanjiToHistory(
  db: SQLiteDatabase,
  kanji: KanjiEntry
) {
  try {
    await db.runAsync("DELETE FROM history WHERE entry_type = 'kanji' AND kanji_id = ?", [kanji.id]);

    const meaning = kanji.meanings ? kanji.meanings.join(", ") : "";
    await db.runAsync(
      "INSERT INTO history (entry_type, kanji_id, kanji_character, kanji_meaning, created_at) VALUES (?, ?, ?, ?, ?)",
      ['kanji', kanji.id, kanji.character, meaning, new Date().toISOString()]
    );
  } catch (error) {
    console.error("Failed to add kanji to history:", error);
  }
}

/**
 * Retrieves search history for both words and kanji
 */
export async function getHistory(
  db: SQLiteDatabase,
  limit = 20,
  offset = 0
): Promise<HistoryEntry[]> {
  const result = await db.getAllAsync<
    DBHistoryEntry & { meaning?: string; history_id?: number }
  >(
    `
    SELECT
      h.id as history_id,
      h.entry_type,
      h.created_at,
      h.word_id,
      h.kanji_id,
      h.kanji_character,
      h.kanji_meaning,
      w.word,
      w.reading,
      (SELECT meaning FROM meanings WHERE word_id = w.id LIMIT 1) as meaning
    FROM history h
    LEFT JOIN words w ON h.word_id = w.id AND h.entry_type = 'word'
    ORDER BY h.created_at DESC
    LIMIT ? OFFSET ?
    `,
    [limit, offset]
  );

  return result.map((e): HistoryEntry => {
    if (e.entry_type === 'kanji') {
      return {
        id: e.history_id || e.id,
        entryType: 'kanji',
        createdAt: e.created_at,
        kanjiId: e.kanji_id!,
        character: e.kanji_character!,
        meaning: e.kanji_meaning || "",
      };
    } else {
      return {
        id: e.history_id || e.id,
        entryType: 'word',
        createdAt: e.created_at,
        wordId: e.word_id!,
        word: e.word!,
        reading: e.reading!,
        meaning: e.meaning || "",
      };
    }
  });
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
