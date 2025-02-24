import { SQLiteDatabase } from "expo-sqlite";
import * as wanakana from "wanakana";

export interface DictionaryEntry {
  id: number;
  word: string;
  reading: string;
  reading_hiragana?: string;
  kanji?: string;
  meanings: Array<{
    meaning: string;
    part_of_speech: string | null;
    field: string | null;
    misc: string | null;
    info: string | null;
  }>;
}

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

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 1;

  const versionResult = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );
  let currentDbVersion = versionResult?.user_version ?? 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    console.log("Database is up-to-date", currentDbVersion);
    return;
  }

  if (currentDbVersion === 0) {
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

  console.log("Database migrated to version", currentDbVersion);
}

interface SearchQuery {
  original: string;
  hiragana?: string;
  katakana?: string;
  romaji?: string;
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
  query: string
): Promise<DictionaryEntry[]> {
  const processedQuery = processSearchQuery(query);
  const whereClauses: string[] = [];
  const params: string[] = [];

  // Add exact match conditions
  whereClauses.push(`(
    word LIKE ? OR
    reading LIKE ? OR
    kanji LIKE ? OR
    word LIKE ? OR
    reading LIKE ? OR
    kanji LIKE ?
  )`);
  // Add parameters for exact start matches and contained matches
  params.push(
    `${processedQuery.original}%`,
    `${processedQuery.original}%`,
    `${processedQuery.original}%`,
    `%${processedQuery.original}%`,
    `%${processedQuery.original}%`,
    `%${processedQuery.original}%`
  );

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
        reading: word.reading,
        reading_hiragana: word.reading_hiragana || undefined,
        kanji: word.kanji || undefined,
        meanings,
      };
    })
  );

  return entries;
}

export async function getDictionaryEntry(
  db: SQLiteDatabase,
  id: number
): Promise<DictionaryEntry | null> {
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

  return {
    id: word.id,
    word: word.word,
    reading: word.reading,
    reading_hiragana: word.reading_hiragana || undefined,
    kanji: word.kanji || undefined,
    meanings,
  };
}
