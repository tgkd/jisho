import { SQLiteDatabase } from "expo-sqlite";
import * as wanakana from "wanakana";

export interface DictionaryEntry {
  id: number;
  word: string;
  reading: string[];
  reading_hiragana: string | null;
  kanji: string | null;
  meanings: Array<{
    meaning: string;
    part_of_speech: string | null;
    field: string | null;
    misc: string | null;
    info: string | null;
  }>;
  source?: string;
}

/* {
    id: "1",
    japanese_text: "彼は忙しい生活の中で家族と会うことがない。",
    english_text: "He doesn't see his family in his busy life.",
    tokens:
      "彼(かれ)[01] は 忙しい(いそがしい) 生活 の 中(なか) で(#2028980) 家族 と 会う[01] 事(こと){こと} が 無い{ない}",
    example_id: "303697_100000",
  } */

export interface ExampleSentence {
  id: number;
  japanese_text: string;
  english_text: string;
  tokens?: string;
  example_id?: string;
}

/* {
  id: "11",
  word: "仝",
  reading: "どう",
  reading_hiragana: "どう",
  kanji: "仝",
  position: "385",
};

*/
interface WordRow {
  id: number;
  word: string;
  reading: string;
  reading_hiragana: string | null;
  kanji: string | null;
  position: number;
}

/*
{
    "meaning": "dictionary of Chinese characters;kanji dictionary",
    "part_of_speech": "n",
    "field": "",
    "misc": "",
    "info": null
  },
*/

interface MeaningRow {
  meaning: string;
  part_of_speech: string | null;
  field: string | null;
  misc: string | null;
  info: string | null;
}

interface SearchQuery {
  original: string;
  hiragana?: string;
  katakana?: string;
  romaji?: string;
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 4;

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
        CREATE TABLE IF NOT EXISTS edict_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          japanese TEXT,
          reading TEXT
        );

        CREATE TABLE IF NOT EXISTS edict_meanings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER,
          part_of_speech TEXT,
          english_definition TEXT,
          FOREIGN KEY (entry_id) REFERENCES edict_entries (id)
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS edict_fts
        USING fts5(english_definition, meaning_id UNINDEXED);

        CREATE INDEX IF NOT EXISTS idx_edict_japanese ON edict_entries(japanese);
        CREATE INDEX IF NOT EXISTS idx_edict_reading ON edict_entries(reading);
        CREATE INDEX IF NOT EXISTS idx_edict_entry_id ON edict_meanings(entry_id);
      `);

      await db.execAsync(`PRAGMA user_version = 3`);
      currentDbVersion = 3;
    }

    if (currentDbVersion < 4) {
      await db.execAsync(`
            CREATE TABLE IF NOT EXISTS bookmarks (
              id INTEGER PRIMARY KEY,
              word_id INTEGER NOT NULL,
              date_added INTEGER NOT NULL,
              UNIQUE(word_id)
            );
          `);

      await db.execAsync(`PRAGMA user_version = 4`);
      currentDbVersion = 4;
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

export async function searchByEnglishWord(
  db: SQLiteDatabase,
  query: string
): Promise<DictionaryEntry[]> {
  const words = await db.getAllAsync<WordRow>(
    `
    SELECT DISTINCT words.* FROM words
    JOIN meanings ON meanings.word_id = words.id
    WHERE meanings.meaning LIKE ?
    ORDER BY length(words.word)
    LIMIT 50
    `,
    [`%${query}%`]
  );

  const entries: DictionaryEntry[] = await Promise.all(
    words.map(async (word) => {
      const meanings = await db.getAllAsync<MeaningRow>(
        `
        SELECT meaning, part_of_speech, field, misc, info
        FROM meanings
        WHERE word_id = ?
        `,
        [word.id]
      );

      return {
        id: word.id,
        word: word.word,
        reading: word.reading.split(";"),
        reading_hiragana: word.reading_hiragana,
        kanji: word.kanji,
        meanings,
      };
    })
  );

  const edictEntries = await db.getAllAsync<{
    id: number;
    japanese: string;
    reading: string;
    english_definition: string;
    part_of_speech: string;
    meaning_id: number;
  }>(
    `
    SELECT e.id, e.japanese, e.reading, m.english_definition, m.part_of_speech, m.id as meaning_id
    FROM edict_entries e
    JOIN edict_meanings m ON m.entry_id = e.id
    JOIN edict_fts fts ON fts.meaning_id = m.id
    WHERE edict_fts MATCH ?
    ORDER BY length(e.japanese)
    LIMIT 25
    `,
    [`"${query}"`]
  );

  const edictEntriesMap = new Map<
    number,
    {
      id: number;
      japanese: string;
      reading: string;
      meanings: Array<{
        meaning: string;
        part_of_speech: string | null;
        field: string | null;
        misc: string | null;
        info: string | null;
      }>;
    }
  >();

  for (const entry of edictEntries) {
    if (!edictEntriesMap.has(entry.id)) {
      edictEntriesMap.set(entry.id, {
        id: entry.id,
        japanese: entry.japanese,
        reading: entry.reading,
        meanings: [],
      });
    }

    const currentEntry = edictEntriesMap.get(entry.id)!;
    currentEntry.meanings.push({
      meaning: entry.english_definition,
      part_of_speech: entry.part_of_speech,
      field: null,
      misc: null,
      info: null,
    });
  }

  const edictResults: DictionaryEntry[] = Array.from(
    edictEntriesMap.values()
  ).map((entry) => ({
    id: entry.id + 1000000,
    word: entry.japanese,
    reading: entry.reading.split(";"),
    reading_hiragana: entry.reading,
    kanji: entry.japanese,
    meanings: entry.meanings,
    source: "edict",
  }));

  return [...entries, ...edictResults];
}

function uniqueBy<T extends { [key: string]: any }>(
  array: T[],
  key: string
): T[] {
  const seen = new Set();
  return array.filter((item) => {
    const k = key ? item[key] : item;
    return seen.has(k) ? false : seen.add(k);
  });
}

export async function searchDictionary(
  db: SQLiteDatabase,
  query: string
): Promise<DictionaryEntry[]> {
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

  const words = await db.getAllAsync<WordRow>(
    `
    SELECT DISTINCT * FROM words
    WHERE
      ${whereClauses.join(" OR ")}
      AND length(word) >= ${Math.min(query.length, 2)}
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

  const entries: DictionaryEntry[] = await Promise.all(
    words.map(async (word) => {
      const meanings = await db.getAllAsync<MeaningRow>(
        `
        SELECT meaning, part_of_speech, field, misc, info
        FROM meanings
        WHERE word_id = ?
        `,
        [word.id]
      );

      return {
        id: word.id,
        word: word.word,
        reading: word.reading.split(";"),
        reading_hiragana: word.reading_hiragana,
        kanji: word.kanji,
        meanings,
      };
    })
  );

  // Search in edict_entries table
  const edictWhereClauses: string[] = [];
  const edictParams: string[] = [];

  edictWhereClauses.push(`(
    japanese LIKE ? OR
    reading LIKE ? OR
    japanese LIKE ? OR
    reading LIKE ?
  )`);

  edictParams.push(
    `${processedQuery.original}%`,
    `${processedQuery.original}%`,
    `%${processedQuery.original}%`,
    `%${processedQuery.original}%`
  );

  if (processedQuery.hiragana) {
    edictWhereClauses.push(`(
      japanese LIKE ? OR
      reading LIKE ? OR
      japanese LIKE ? OR
      reading LIKE ?
    )`);
    edictParams.push(
      `${processedQuery.hiragana}%`,
      `${processedQuery.hiragana}%`,
      `%${processedQuery.hiragana}%`,
      `%${processedQuery.hiragana}%`
    );
  }

  if (processedQuery.katakana) {
    edictWhereClauses.push(`(
      japanese LIKE ? OR
      reading LIKE ? OR
      japanese LIKE ? OR
      reading LIKE ?
    )`);
    edictParams.push(
      `${processedQuery.katakana}%`,
      `${processedQuery.katakana}%`,
      `%${processedQuery.katakana}%`,
      `%${processedQuery.katakana}%`
    );
  }

  const edictEntries = await db.getAllAsync<{
    id: number;
    japanese: string;
    reading: string;
  }>(
    `
    SELECT DISTINCT id, japanese, reading
    FROM edict_entries
    WHERE
      ${edictWhereClauses.join(" OR ")}
      AND length(japanese) >= ${Math.min(query.length, 2)}
    ORDER BY
      CASE
        WHEN japanese = ? THEN 1
        WHEN reading = ? THEN 2
        WHEN japanese LIKE ? THEN 3
        WHEN reading LIKE ? THEN 4
        ELSE 5
      END,
      length(japanese)
    LIMIT 25
    `,
    [...edictParams, query, query, `${query}%`, `${query}%`]
  );

  if (edictEntries.length > 0) {
    const edictDictEntries = await Promise.all(
      edictEntries.map(async (entry) => {
        const meanings = await db.getAllAsync<{
          english_definition: string;
          part_of_speech: string | null;
        }>(
          `SELECT english_definition, part_of_speech FROM edict_meanings WHERE entry_id = ?`,
          [entry.id]
        );

        return {
          id: entry.id + 1000000,
          word: entry.japanese,
          reading: entry.reading.split(";"),
          reading_hiragana: entry.reading,
          kanji: entry.japanese,
          meanings: meanings.map((m) => ({
            meaning: m.english_definition,
            part_of_speech: m.part_of_speech,
            field: null,
            misc: null,
            info: null,
          })),
          source: "edict",
        } as DictionaryEntry;
      })
    );

    const result = uniqueBy([...entries, ...edictDictEntries], "word");

    return result;
  }

  return entries;
}

export async function getDictionaryEntry(
  db: SQLiteDatabase,
  id: number,
  withExamples: boolean = false
): Promise<
  DictionaryEntry | (DictionaryEntry & { examples: ExampleSentence[] }) | null
> {
  const word = await db.getFirstAsync<WordRow>(
    `
    SELECT * FROM words WHERE id = ?
  `,
    [id]
  );

  if (!word) return null;

  const meanings = await db.getAllAsync<MeaningRow>(
    `
    SELECT meaning, part_of_speech, field, misc, info
    FROM meanings
    WHERE word_id = ?
  `,
    [id]
  );

  if (!withExamples) {
    return {
      id: word.id,
      word: word.word,
      reading: word.reading.split(";"),
      reading_hiragana: word.reading_hiragana,
      kanji: word.kanji,
      meanings,
    };
  }

  const examples = await searchExamples(db, word.word, 5);

  return {
    id: word.id,
    word: word.word,
    reading: word.reading.split(";"),
    reading_hiragana: word.reading_hiragana,
    kanji: word.kanji,
    meanings,
    examples,
  };
}

export async function searchExamples(
  db: SQLiteDatabase,
  query: string,
  limit: number = 20
): Promise<ExampleSentence[]> {
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

  const examples = await db.getAllAsync<ExampleSentence>(
    `
    SELECT id, japanese_text, english_text, tokens, example_id
    FROM examples
    WHERE ${whereClauses.join(" OR ")}
    LIMIT ?
    `,
    [...params, limit]
  );

  return examples;
}

export async function getExampleById(
  db: SQLiteDatabase,
  id: number
): Promise<ExampleSentence | null> {
  const example = await db.getFirstAsync<ExampleSentence>(
    `
    SELECT id, japanese_text, english_text, tokens, example_id
    FROM examples
    WHERE id = ?
    `,
    [id]
  );

  return example;
}

export async function getEdictEntry(
  db: SQLiteDatabase,
  id: number
): Promise<DictionaryEntry | null> {
  const realId = id - 1000000;

  const entry = await db.getFirstAsync<{
    id: number;
    japanese: string;
    reading: string;
  }>(`SELECT id, japanese, reading FROM edict_entries WHERE id = ?`, [realId]);

  if (!entry) return null;

  const meanings = await db.getAllAsync<{
    english_definition: string;
    part_of_speech: string | null;
  }>(
    `SELECT english_definition, part_of_speech FROM edict_meanings WHERE entry_id = ?`,
    [realId]
  );

  return {
    id,
    word: entry.japanese,
    reading: entry.reading.split(";"),
    reading_hiragana: entry.reading,
    kanji: entry.japanese,
    meanings: meanings.map((m) => ({
      meaning: m.english_definition,
      part_of_speech: m.part_of_speech,
      field: null,
      misc: null,
      info: null,
    })),
    source: "edict",
  };
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
): Promise<DictionaryEntry[]> {
  try {
    const bookmarks = await db.getAllAsync<{
      word_id: number;
      date_added: number;
    }>(`SELECT word_id, date_added FROM bookmarks ORDER BY date_added DESC`);

    if (bookmarks.length === 0) {
      return [];
    }

    const entries: DictionaryEntry[] = [];

    for (const bookmark of bookmarks) {
      const id = bookmark.word_id;

      if (id >= 1000000) {
        const entry = await getEdictEntry(db, id);
        if (entry) entries.push(entry);
      } else {
        const entry = await getDictionaryEntry(db, id);
        if (entry) entries.push(entry);
      }
    }

    return entries;
  } catch (error) {
    console.error("Error getting bookmarks:", error);
    return [];
  }
}

export async function addBookmark(
  db: SQLiteDatabase,
  wordId: number
): Promise<boolean> {
  try {
    await db.runAsync(
      `
      INSERT OR REPLACE INTO bookmarks (word_id, date_added)
      VALUES (?, ?)
    `,
      [wordId, Date.now()]
    );

    return true;
  } catch (error) {
    console.error("Error adding bookmark:", error);
    return false;
  }
}

export async function removeBookmark(
  db: SQLiteDatabase,
  wordId: number
): Promise<boolean> {
  try {
    await db.runAsync(`DELETE FROM bookmarks WHERE word_id = ?`, [wordId]);

    return true;
  } catch (error) {
    console.error("Error removing bookmark:", error);
    return false;
  }
}

export async function isBookmarked(
  db: SQLiteDatabase,
  wordId: number
): Promise<boolean> {
  try {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM bookmarks WHERE word_id = ?`,
      [wordId]
    );

    return Boolean(result && result.count > 0);
  } catch (error) {
    console.error("Error checking bookmark status:", error);
    return false;
  }
}
