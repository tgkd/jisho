import { SQLiteDatabase } from "expo-sqlite";
import * as wanakana from "wanakana";
import { AiExample } from "./request";

type DBDictEntry = {
  id: number;
  word: string;
  reading: string;
  reading_hiragana: string | null;
  kanji: string | null;
  position: number;
};

export type DictionaryEntry = Omit<DBDictEntry, "reading_hiragana"> & {
  readingHiragana: string | null;
};

type DBExampleSentence = {
  id: number;
  japanese_text: string;
  english_text: string;
  tokens?: string;
  example_id?: string;
};

export type ExampleSentence = Omit<
  DBExampleSentence,
  "japanese_text" | "english_text" | "example_id"
> & {
  japaneseText: string;
  englishText: string;
  exampleId: string | null;
};

type DBWordMeaning = {
  id: number;
  word_id: number;
  meaning: string;
  part_of_speech: string | null;
  field: string | null;
  misc: string | null;
  info: string | null;
};

export type WordMeaning = Omit<DBWordMeaning, "word_id" | "part_of_speech"> & {
  wordId: number;
  partOfSpeech: string | null;
};

type DBHistoryEntry = {
  id: number;
  word_id: number;
  created_at: number;
  word: string;
  reading: string;
};

export type HistoryEntry = {
  id: number;
  wordId: number;
  createdAt: number;
  word: string;
  reading: string;
  meaning: string;
};

interface SearchQuery {
  original: string;
  hiragana?: string;
  katakana?: string;
  romaji?: string;
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 5;

  try {
    const versionResult = await db.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version"
    );
    let currentDbVersion = versionResult?.user_version ?? 0;

    console.log("DB: ", currentDbVersion, "TARGET: ", DATABASE_VERSION);

    if (currentDbVersion >= DATABASE_VERSION) {
      return;
    }

    if (currentDbVersion < 1) {
      await db.execAsync(`
        PRAGMA journal_mode = 'wal';

        CREATE TABLE IF NOT EXISTS words (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT,
          reading TEXT,
          reading_hiragana TEXT,
          kanji TEXT,
          position INTEGER
        );

        CREATE TABLE IF NOT EXISTS meanings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word_id INTEGER,
          meaning TEXT,
          part_of_speech TEXT,
          field TEXT,
          misc TEXT,
          info TEXT,
          FOREIGN KEY (word_id) REFERENCES words (id)
        );

        CREATE INDEX IF NOT EXISTS idx_word ON words(word);
        CREATE INDEX IF NOT EXISTS idx_reading ON words(reading);
        CREATE INDEX IF NOT EXISTS idx_position ON words(position);
        CREATE INDEX IF NOT EXISTS idx_kanji ON words(kanji);
      `);

      await db.execAsync(`PRAGMA user_version = 1`);
      currentDbVersion = 1;
    }

    if (currentDbVersion < 2) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS examples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          japanese_text TEXT,
          english_text TEXT,
          tokens TEXT,
          example_id TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_japanese_text ON examples(japanese_text);
      `);

      await db.execAsync(`PRAGMA user_version = 2`);
      currentDbVersion = 2;
    }

    if (currentDbVersion < 3) {
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY NOT NULL,
        word_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (word_id) REFERENCES words (id)
      );

          `);

      await db.execAsync(`PRAGMA user_version = 3`);
      currentDbVersion = 3;
    }

    if (currentDbVersion < 4) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS history (
          id INTEGER PRIMARY KEY NOT NULL,
          word_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (word_id) REFERENCES words (id)
        );`);

      await db.execAsync(`PRAGMA user_version = 4`);
      currentDbVersion = 4;
    }

    if (currentDbVersion < 5) {
      await db.execAsync(`
        ALTER TABLE examples ADD COLUMN word_id INTEGER;
        CREATE INDEX IF NOT EXISTS idx_example_word_id ON examples(word_id);
      `);

      await db.execAsync(`PRAGMA user_version = 5`);
      currentDbVersion = 5;
    }

    console.log(
      `Database migrations completed. Current version: ${currentDbVersion}`
    );
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}

function processSearchQuery(query: string): SearchQuery {
  const result: SearchQuery = { original: query };

  if (wanakana.isRomaji(query)) {
    result.hiragana = wanakana.toHiragana(query);
    result.katakana = wanakana.toKatakana(query);
  } else if (wanakana.isJapanese(query)) {
    result.romaji = wanakana.toRomaji(query);
    if (wanakana.isKatakana(query)) {
      result.hiragana = wanakana.toHiragana(query);
    } else if (wanakana.isHiragana(query)) {
      result.katakana = wanakana.toKatakana(query);
    }
  }

  return result;
}

export async function searchDictionary(
  db: SQLiteDatabase,
  query: string,
  withMeanings = true
): Promise<{
  words: DictionaryEntry[];
  meanings: Map<number, WordMeaning[]>;
}> {
  const processedQuery = processSearchQuery(query);
  const whereClauses: string[] = [];
  const params: string[] = [];

  whereClauses.push(`(
    word LIKE ? OR
    reading LIKE ? OR
    kanji LIKE ? OR
    word LIKE ? OR
    reading LIKE ? OR
    kanji LIKE ?
  )`);

  params.push(
    `${processedQuery.original}%`,
    `${processedQuery.original}%`,
    `${processedQuery.original}%`,
    `%${processedQuery.original}%`,
    `%${processedQuery.original}%`,
    `%${processedQuery.original}%`
  );

  // hiragana search
  if (processedQuery.hiragana) {
    whereClauses.push(`(
      word LIKE ? OR
      reading LIKE ? OR
      reading_hiragana LIKE ? OR
      word LIKE ? OR
      reading LIKE ? OR
      reading_hiragana LIKE ?
    )`);
    params.push(
      `${processedQuery.hiragana}%`,
      `${processedQuery.hiragana}%`,
      `${processedQuery.hiragana}%`,
      `%${processedQuery.hiragana}%`,
      `%${processedQuery.hiragana}%`,
      `%${processedQuery.hiragana}%`
    );
  }

  // katakana search
  if (processedQuery.katakana) {
    whereClauses.push(`(
      word LIKE ? OR
      reading LIKE ? OR
      word LIKE ? OR
      reading LIKE ?
    )`);
    params.push(
      `${processedQuery.katakana}%`,
      `${processedQuery.katakana}%`,
      `%${processedQuery.katakana}%`,
      `%${processedQuery.katakana}%`
    );
  }

  const words = await db.getAllAsync<DBDictEntry>(
    `
    SELECT * FROM words
    WHERE
      ${whereClauses.join(" OR ")}
      AND length(word) >= ${Math.min(query.length, 2)}
    GROUP BY word
    ORDER BY
      CASE
        WHEN word = ? THEN 1
        WHEN reading = ? THEN 2
        WHEN kanji = ? THEN 3
        WHEN word LIKE ? THEN 4
        WHEN reading LIKE ? THEN 5
        WHEN kanji LIKE ? THEN 6
        ELSE 7
      END,
      length(word)
    LIMIT 50
    `,
    [...params, query, query, query, `${query}%`, `${query}%`, `${query}%`]
  );

  let entries: DictionaryEntry[] = words.map((word) => ({
    ...word,
    readingHiragana: word.reading_hiragana,
  }));

  if (withMeanings) {
    const meaningsMap = new Map<number, WordMeaning[]>();
    await Promise.all(
      words.map(async (word) => {
        const meanings = await db.getAllAsync<DBWordMeaning>(
          `
        SELECT meaning, part_of_speech, field, misc, info
        FROM meanings
        WHERE word_id = ?
        `,
          [word.id]
        );

        meaningsMap.set(
          word.id,
          meanings.map((m) => ({
            ...m,
            wordId: word.id,
            partOfSpeech: m.part_of_speech || null,
          }))
        );
      })
    );

    return {
      words: entries,
      meanings: meaningsMap,
    };
  }

  return {
    words: entries,
    meanings: new Map(),
  };
}

export async function searchExamples(
  db: SQLiteDatabase,
  query: string,
  limit: number = 20,
  wordId?: number
): Promise<ExampleSentence[]> {
  // If wordId is provided, search by word_id first
  if (wordId !== undefined) {
    const examplesByWordId = await db.getAllAsync<DBExampleSentence>(
      `
      SELECT id, japanese_text, english_text, tokens, example_id
      FROM examples
      WHERE word_id = ?
      LIMIT ?
      `,
      [wordId, limit]
    );

    // If we found examples by word_id, return them
    if (examplesByWordId && examplesByWordId.length > 0) {
      return examplesByWordId.map((e) => ({
        ...e,
        japaneseText: e.japanese_text,
        englishText: e.english_text,
        exampleId: e.example_id || null,
      }));
    }
  }

  // Otherwise, fall back to text search
  const processedQuery = processSearchQuery(query);
  const whereClauses: string[] = [];
  const params: string[] = [];

  whereClauses.push(`japanese_text LIKE ?`);
  params.push(`%${processedQuery.original}%`);

  if (processedQuery.hiragana) {
    whereClauses.push(`japanese_text LIKE ?`);
    params.push(`%${processedQuery.hiragana}%`);
  }

  if (processedQuery.katakana) {
    whereClauses.push(`japanese_text LIKE ?`);
    params.push(`%${processedQuery.katakana}%`);
  }

  if (processedQuery.original) {
    whereClauses.push(`tokens LIKE ?`);
    params.push(`%${processedQuery.original}%`);
  }

  const examples = await db.getAllAsync<DBExampleSentence>(
    `
    SELECT id, japanese_text, english_text, tokens, example_id
    FROM examples
    WHERE ${whereClauses.join(" OR ")}
    LIMIT ?
    `,
    [...params, limit]
  );

  return examples.map((e) => ({
    ...e,
    japaneseText: e.japanese_text,
    englishText: e.english_text,
    exampleId: e.example_id || null,
  }));
}

async function addExample(
  wId: number,
  jt: string,
  et: string,
  db: SQLiteDatabase
) {
  try {
    await db.runAsync(
      "INSERT INTO examples (japanese_text, english_text, word_id) VALUES (?, ?, ?)",
      [jt, et, wId]
    );
  } catch (error) {
    console.error("Failed to add example:", error);
  }
}

export async function addExamplesList(
  wId: number,
  examples: AiExample[],
  db: SQLiteDatabase
) {
  await Promise.all(examples.map((e) => addExample(wId, e.jp, e.en, db)));
}

export async function getDictionaryEntry(
  db: SQLiteDatabase,
  id: number,
  withExamples: boolean
): Promise<{
  word: DictionaryEntry;
  meanings: WordMeaning[];
  examples: ExampleSentence[];
} | null> {
  try {
    const word = await db.getFirstAsync<DBDictEntry>(
      "SELECT * FROM words WHERE id = ?",
      [id]
    );

    if (!word) {
      return null;
    }

    const meanings = await db.getAllAsync<DBWordMeaning>(
      "SELECT * FROM meanings WHERE word_id = ?",
      [id]
    );

    if (withExamples) {
      const examplesByWordId = await db.getAllAsync<DBExampleSentence>(
        `
        SELECT id, japanese_text, english_text, tokens, example_id
        FROM examples
        WHERE word_id = ?
        ORDER BY length(japanese_text)
        LIMIT 5
        `,
        [id]
      );

      if (examplesByWordId && examplesByWordId.length > 0) {
        return {
          word: {
            ...word,
            readingHiragana: word?.reading_hiragana || null,
          },
          meanings: meanings.map((m) => ({
            ...m,
            wordId: id,
            partOfSpeech: m.part_of_speech || null,
          })),
          examples: examplesByWordId.map((e) => ({
            ...e,
            japaneseText: e.japanese_text,
            englishText: e.english_text,
            exampleId: e.example_id || null,
          })),
        };
      }

      // Fall back to text search
      const examples = await db.getAllAsync<DBExampleSentence>(
        `
        SELECT id, japanese_text, english_text, tokens, example_id
        FROM examples
        WHERE japanese_text LIKE ? OR japanese_text LIKE ?
        ORDER BY length(japanese_text)
        LIMIT 5
        `,
        [`%${word.word}%`, `%${word.reading}%`]
      );

      return {
        word: {
          ...word,
          readingHiragana: word?.reading_hiragana || null,
        },
        meanings: meanings.map((m) => ({
          ...m,
          wordId: id,
          partOfSpeech: m.part_of_speech || null,
        })),
        examples: examples.map((e) => ({
          ...e,
          japaneseText: e.japanese_text,
          englishText: e.english_text,
          exampleId: e.example_id || null,
        })),
      };
    }

    return {
      word: {
        ...word,
        readingHiragana: word?.reading_hiragana || null,
      },
      meanings: meanings.map((m) => ({
        ...m,
        wordId: id,
        partOfSpeech: m.part_of_speech || null,
      })),
      examples: [],
    };
  } catch (error) {
    console.error("Failed to get dictionary entry:", error);
    return null;
  }
}

export async function resetDatabase(db: SQLiteDatabase): Promise<void> {
  try {
    console.log("Dropping all tables...");

    await db.execAsync(`
      DROP TABLE IF EXISTS meanings;
      DROP TABLE IF EXISTS words;
      DROP TABLE IF EXISTS examples;
      DROP TABLE IF EXISTS edict_fts;
      DROP TABLE IF EXISTS edict_meanings;
      DROP TABLE IF EXISTS edict_entries;
      DROP TABLE IF EXISTS bookmarks;
      DROP TABLE IF EXISTS history;
    `);

    await db.execAsync(`PRAGMA user_version = 0`);

    console.log("Database reset complete");

    await migrateDbIfNeeded(db);
  } catch (error) {
    console.error("Error resetting database:", error);
    throw error;
  }
}

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
export interface SearchResults<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
}

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
