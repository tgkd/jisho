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
}

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

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 2;

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

  if (currentDbVersion === 1) {
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
        reading: word.reading.split(";"),
        reading_hiragana: word.reading_hiragana,
        kanji: word.kanji,
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
    reading: word.reading.split(";"),
    reading_hiragana: word.reading_hiragana,
    kanji: word.kanji,
    meanings,
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

  // Search in original Japanese text
  whereClauses.push(`japanese_text LIKE ?`);
  params.push(`%${processedQuery.original}%`);

  // If we have hiragana form, search with that too
  if (processedQuery.hiragana) {
    whereClauses.push(`japanese_text LIKE ?`);
    params.push(`%${processedQuery.hiragana}%`);
  }

  // If we have katakana form, search with that too
  if (processedQuery.katakana) {
    whereClauses.push(`japanese_text LIKE ?`);
    params.push(`%${processedQuery.katakana}%`);
  }

  // Search in token data for more accurate matching
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
