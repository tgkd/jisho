import * as SQLite from "expo-sqlite";
import * as wanakana from "wanakana";

// words table schema
// [{"id":"15307","word":"亜熱帯高圧帯","reading":"あねったいこうあつたい"}]

// meanings table schema
// [{"id":"14356","word_id":"5003","meaning":"to carry","part_of_speech":null,"tags":null}]

// examples table schema
// [{"id":"52","japanese":"彼は宝石を盗んだといわれている。","english":"He is alleged to have stolen the jewelry.#ID=303645_100052","parsed_tokens":"彼(かれ)[01] は 宝石 を 盗む{盗んだ} と言われる{といわれている}"}]

// bookmarks table schema
// [{"id":"1","word_id":"5003","created_at":"2021-09-01T00:00:00.000Z"}]

// history table schema
// [{"id":"1","word_id":"5003", "created_at":"2021-09-01T00:00:00.000Z"}]

export type DictionaryEntry =
  | {
      id: number;
      word: string;
      reading: string;
    }
  | {
      id: number;
      word: string;
      reading: string;
      meanings: MeaningEntry[];
    }
  | {
      id: number;
      word: string;
      reading: string;
      examples: ExampleEntry[];
    }
  | {
      id: number;
      word: string;
      reading: string;
      meanings: MeaningEntry[];
      examples: ExampleEntry[];
    };

export type MeaningEntry = {
  id: number;
  wordId: number;
  meaning: string;
  partOfSpeech: string;
  tags: string;
};

export type ExampleEntry = {
  id: number;
  japanese: string;
  english: string;
  parsedTokens: string;
};

type SearchQuery = {
  original: string;
  hiragana?: string;
  katakana?: string;
  romaji?: string;
};

export type HistoryEntry = DictionaryEntry & {
  createdAt: string;
  wordId: number;
};

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
  db: SQLite.SQLiteDatabase,
  query: string,
  withMeanings = false
): Promise<Array<DictionaryEntry>> {
  try {
    const text = query.trim();
    if (text.length === 0) {
      return [];
    }

    const sq = processSearchQuery(text);

    const exactSql = `
      SELECT DISTINCT w.*,
      CASE
        WHEN w.word = ? THEN 1
        WHEN w.reading LIKE ? THEN 2
        WHEN w.reading LIKE ? THEN 3
        WHEN w.reading LIKE ? THEN 4
        ELSE 5
      END as match_rank
      FROM words w
      WHERE
        (${sq.hiragana ? "w.word = ? OR " : ""} ${
      sq.katakana ? "w.word = ? OR " : ""
    } 0=1)
        OR w.reading LIKE ?
        OR w.reading LIKE ?
        OR w.reading LIKE ?
      ORDER BY match_rank ASC
      LIMIT 100
    `;

    const exactParams = [
      // Parameters for the CASE statement (match ranking)
      sq.hiragana || sq.katakana || "", // for word exact match
      `${sq.original}`, // reading equals exactly
      `${sq.original};%`, // reading starts with term followed by semicolon
      `%;${sq.original};%`, // reading contains term surrounded by semicolons

      // Parameters for the WHERE clause
      ...(sq.hiragana ? [sq.hiragana] : []), // word in hiragana if available
      ...(sq.katakana ? [sq.katakana] : []), // word in katakana if available

      `%${sq.original}%`, // reading contains original
      sq.hiragana ? `%${sq.hiragana}%` : `%${sq.original}%`, // reading contains hiragana
      sq.katakana ? `%${sq.katakana}%` : `%${sq.original}%`, // reading contains katakana
    ];

    console.log("Exact search:", exactSql, exactParams);

    let result = await db.getAllAsync<DictionaryEntry>(exactSql, exactParams);

    if (withMeanings) {
      const resWithMeanings = await Promise.all(
        result.map(async (entry) => {
          const meanings = await getMeanings(db, entry.id, 3);
          return { ...entry, meanings };
        })
      );
      return resWithMeanings;
    }

    return result;
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

export async function getMeanings(
  db: SQLite.SQLiteDatabase,
  wordId: number,
  limit?: number
): Promise<MeaningEntry[]> {
  try {
    const query = limit
      ? `
      SELECT DISTINCT id, word_id, meaning, part_of_speech, tags
      FROM (
        SELECT * FROM meanings
        WHERE word_id = ?
        GROUP BY meaning
      )
      LIMIT ?
    `
      : `
      SELECT DISTINCT id, word_id, meaning, part_of_speech, tags
      FROM (
        SELECT * FROM meanings
        WHERE word_id = ?
        GROUP BY meaning
      )
    `;

    const result = await db.getAllAsync<MeaningEntry>(
      query,
      limit ? [wordId, limit] : [wordId]
    );

    return result;
  } catch (error) {
    console.error("Failed to get meanings:", error);
    return [];
  }
}

export async function getExamples(
  db: SQLite.SQLiteDatabase,
  wordId: number
): Promise<ExampleEntry[]> {
  const result = await db.getAllAsync<ExampleEntry>(
    "SELECT * FROM examples WHERE word_id = ?",
    [wordId]
  );
  return result;
}

export async function getDictionaryEntry(
  db: SQLite.SQLiteDatabase,
  wordId: number,
  withMeanings = false,
  withExamples = false
): Promise<DictionaryEntry | null> {
  const word = await db.getFirstAsync<DictionaryEntry>(
    "SELECT * FROM words WHERE id = ?",
    [wordId]
  );

  if (!word) {
    return null;
  }

  if (withMeanings) {
    const meanings = await getMeanings(db, wordId);
    return { ...word, meanings };
  }

  if (withExamples) {
    const examples = await getExamples(db, wordId);
    return { ...word, examples };
  }

  return word;
}

export async function isBookmarked(
  db: SQLite.SQLiteDatabase,
  wordId: number
): Promise<boolean> {
  const result = await db.getFirstAsync(
    "SELECT id FROM bookmarks WHERE word_id = ?",
    [wordId]
  );
  return !!result;
}

export async function addBookmark(db: SQLite.SQLiteDatabase, wordId: number) {
  await db.runAsync(
    "INSERT INTO bookmarks (word_id, created_at) VALUES (?, ?)",
    [wordId, new Date().toISOString()]
  );
}

export async function removeBookmark(
  db: SQLite.SQLiteDatabase,
  wordId: number
) {
  await db.runAsync("DELETE FROM bookmarks WHERE word_id = ?", [wordId]);
}

export async function addToHistory(
  db: SQLite.SQLiteDatabase,
  entry: DictionaryEntry
) {
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
  db: SQLite.SQLiteDatabase,
  limit = 100
): Promise<HistoryEntry[]> {
  const result = await db.getAllAsync<{
    id: number;
    word: string;
    reading: string;
    created_at: string;
    word_id: number;
  }>(
    `
    SELECT w.*, h.created_at, h.word_id FROM words w
    INNER JOIN history h ON w.id = h.word_id
    ORDER BY h.created_at DESC
    LIMIT ?
  `,
    [limit]
  );

  return result.map((e) => ({
    word: e.word,
    reading: e.reading,
    id: e.id,
    createdAt: new Date(e.created_at).toISOString(),
    wordId: e.word_id,
  }));
}

export async function clearHistory(db: SQLite.SQLiteDatabase) {
  await db.runAsync("DELETE FROM history");
}

export async function removeHistoryById(
  db: SQLite.SQLiteDatabase,
  historyId: number
) {
  try {
    await db.runAsync("DELETE FROM history WHERE id = ?", [historyId]);
    return true;
  } catch (error) {
    console.error("Failed to remove history item:", error);
    return false;
  }
}

export async function migrateDbIfNeeded(db: SQLite.SQLiteDatabase) {
  const DATABASE_VERSION = 7;
  let u = await db.getFirstAsync<{
    user_version: number;
  }>("PRAGMA user_version");
  let currentDbVersion = u?.user_version || 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';

      -- Create words table
      CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY NOT NULL,
        word TEXT NOT NULL,
        reading TEXT NOT NULL
      );

      -- Create meanings table
      CREATE TABLE IF NOT EXISTS meanings (
        id INTEGER PRIMARY KEY NOT NULL,
        word_id INTEGER NOT NULL,
        meaning TEXT NOT NULL,
        part_of_speech TEXT,
        tags TEXT,
        FOREIGN KEY (word_id) REFERENCES words (id)
      );

      -- Create examples table
      CREATE TABLE IF NOT EXISTS examples (
        id INTEGER PRIMARY KEY NOT NULL,
        japanese TEXT NOT NULL,
        english TEXT NOT NULL,
        parsed_tokens TEXT
      );

      -- Create bookmarks table
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY NOT NULL,
        word_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (word_id) REFERENCES words (id)
      );

      -- Create history table
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY NOT NULL,
        word_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (word_id) REFERENCES words (id)
      );

      -- Create FTS table for meanings to enable full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS meanings_fts USING fts5(
        meaning,
        content='meanings',
        content_rowid='id'
      );

      -- Create triggers to keep FTS table in sync with meanings table
      CREATE TRIGGER meanings_ai AFTER INSERT ON meanings BEGIN
        INSERT INTO meanings_fts(rowid, meaning) VALUES (new.id, new.meaning);
      END;

      CREATE TRIGGER meanings_ad AFTER DELETE ON meanings BEGIN
        INSERT INTO meanings_fts(meanings_fts, rowid, meaning) VALUES('delete', old.id, old.meaning);
      END;

      CREATE TRIGGER meanings_au AFTER UPDATE ON meanings BEGIN
        INSERT INTO meanings_fts(meanings_fts, rowid, meaning) VALUES('delete', old.id, old.meaning);
        INSERT INTO meanings_fts(rowid, meaning) VALUES (new.id, new.meaning);
      END;

      -- Create indexes for better search performance
      CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
      CREATE INDEX IF NOT EXISTS idx_words_reading ON words(reading);
      CREATE INDEX IF NOT EXISTS idx_meanings_word_id ON meanings(word_id);

    `);
    currentDbVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
