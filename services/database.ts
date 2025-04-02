import * as FileSystem from "expo-file-system";
import { SQLiteDatabase } from "expo-sqlite";
import { Alert } from "react-native";
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
  example_id: string;
  tokens?: string;
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

type DBChat = {
  id: number;
  request: string;
  response: string;
  created_at: string;
};

export type Chat = Omit<DBChat, "created_at"> & {
  createdAt: string;
};

type DBAudio = {
  id: number;
  file_path: string;
  word_id: number;
  example_id: number;
  audio_data: string;
  created_at: string;
};

export type AudioFile = {
  id: number;
  filePath: string;
  audioData: string;
};

type DBKanji = {
  id: number;
  character: string;
  jis_code: number | null;
  unicode: string | null;
  on_readings: string | null;
  kun_readings: string | null;
  meanings: string | null;
  created_at: string;
};

export type KanjiEntry = Omit<
  DBKanji,
  "on_readings" | "kun_readings" | "meanings"
> & {
  onReadings: string[] | null;
  kunReadings: string[] | null;
  meanings: string[] | null;
};

interface SearchQuery {
  original: string;
  hiragana?: string;
  katakana?: string;
  romaji?: string;
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 10;

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

    if (currentDbVersion < 6) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS chats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request TEXT NOT NULL,
          response TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);
      `);

      await db.execAsync(`PRAGMA user_version = 6`);
      currentDbVersion = 6;
    }

    if (currentDbVersion < 7) {
      try {
        await db.execAsync(`PRAGMA user_version = 7`);
        currentDbVersion = 7;
      } catch (error) {
        console.error("Error migrating to version 7:", error);
      }
    }

    if (currentDbVersion < 8) {
      try {
        // Make sure to create the table first before any other operations
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS audio_blobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            word_id INTEGER NOT NULL,
            example_id INTEGER,
            audio_data BLOB NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (word_id) REFERENCES words (id),
            FOREIGN KEY (example_id) REFERENCES examples (id)
          );
        `);

        // Then create indices
        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_audio_word_id ON audio_blobs(word_id);
          CREATE INDEX IF NOT EXISTS idx_audio_example_id ON audio_blobs(example_id);
        `);

        await db.execAsync(`PRAGMA user_version = 8`);
        currentDbVersion = 8;
        console.log("Successfully migrated to version 8");
      } catch (error) {
        console.error("Error migrating to version 8:", error);
      }
    }

    if (currentDbVersion < 9) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS kanji (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character TEXT NOT NULL,
            jis_code INTEGER,
            unicode TEXT,
            on_readings TEXT,
            kun_readings TEXT,
            meanings TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
      await db.execAsync(`PRAGMA user_version = 9`);
      currentDbVersion = 9;
    }

    if (currentDbVersion < 10) {
      await db.execAsync(`

        CREATE VIRTUAL TABLE IF NOT EXISTS words_fts USING fts5(
          word,
          reading,
          reading_hiragana,
          kanji,
          content='words',
          content_rowid='id'
        );

        CREATE TRIGGER IF NOT EXISTS words_ai AFTER INSERT ON words BEGIN
          INSERT INTO words_fts(rowid, word, reading, reading_hiragana, kanji)
          VALUES (new.id, new.word, new.reading, new.reading_hiragana, new.kanji);
        END;

        CREATE TRIGGER IF NOT EXISTS words_ad AFTER DELETE ON words BEGIN
          INSERT INTO words_fts(words_fts, rowid, word, reading, reading_hiragana, kanji)
          VALUES('delete', old.id, old.word, old.reading, old.reading_hiragana, old.kanji);
        END;

        CREATE TRIGGER IF NOT EXISTS words_au AFTER UPDATE ON words BEGIN
          INSERT INTO words_fts(words_fts, rowid, word, reading, reading_hiragana, kanji)
          VALUES('delete', old.id, old.word, old.reading, old.reading_hiragana, old.kanji);
          INSERT INTO words_fts(rowid, word, reading, reading_hiragana, kanji)
          VALUES (new.id, new.word, new.reading, new.reading_hiragana, new.kanji);
        END;
        `);
      await db.execAsync(`PRAGMA user_version = 10`);
      currentDbVersion = 10;
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
  const result: SearchQuery = {
    original: query,
    romaji: wanakana.isJapanese(query) ? wanakana.toRomaji(query) : undefined
  };

  // Handle romaji to kana conversions
  if (wanakana.isRomaji(query)) {
    result.hiragana = wanakana.toHiragana(query);
    result.katakana = wanakana.toKatakana(query);
  }
  // Handle kana to kana conversions
  else if (wanakana.isHiragana(query)) {
    result.katakana = wanakana.toKatakana(query);
  }
  else if (wanakana.isKatakana(query)) {
    result.hiragana = wanakana.toHiragana(query);
  }
  // Handle mixed input (can contain kanji)
  else if (wanakana.isJapanese(query)) {
    const hiragana = wanakana.toHiragana(query);
    const katakana = wanakana.toKatakana(query);

    if (hiragana !== query) result.hiragana = hiragana;
    if (katakana !== query) result.katakana = katakana;
  }

  return result;
}

function tokenizeJp(text: string) {
  const tokens = wanakana.tokenize(text);

  return tokens.map((t) => (typeof t === "string" ? t : t.value));
}

interface SearchDictionaryOptions {
  withMeanings?: boolean;
  limit?: number;
  minQueryLength?: number;
}

interface SearchDictionaryResult {
  words: DictionaryEntry[];
  meanings: Map<number, WordMeaning[]>;
  error?: string;
}

function buildWhereClause(processedQuery: SearchQuery): {
  whereClauses: string[];
  params: string[];
} {
  const whereClauses: string[] = [];
  const params: string[] = [];

  // Original query search
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

  // Hiragana search
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

  // Katakana search
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

  return { whereClauses, params };
}

async function searchByTokens(
  db: SQLiteDatabase,
  query: string,
  limit: number = 30
): Promise<DBDictEntry[]> {
  const tokens = tokenizeJp(query);
  if (tokens.length === 0) return [];

  const tokenWhereClauses: string[] = [];
  const tokenParams: string[] = [];

  for (const token of tokens) {
    if (token.length < 2) continue;

    // Get all possible forms of the token
    const variations = [token];
    if (wanakana.isRomaji(token)) {
      // Handle romaji input by converting to hiragana and katakana
      variations.push(wanakana.toHiragana(token));
      variations.push(wanakana.toKatakana(token));
    } else if (wanakana.isHiragana(token)) {
      variations.push(wanakana.toKatakana(token));
    } else if (wanakana.isKatakana(token)) {
      variations.push(wanakana.toHiragana(token));
    }

    const tokenMatches = variations.map(v => `(
      word LIKE ? OR
      reading LIKE ? OR
      reading_hiragana LIKE ? OR
      kanji LIKE ?
    )`);

    tokenWhereClauses.push(`(${tokenMatches.join(" OR ")})`);

    variations.forEach(v => {
      tokenParams.push(`%${v}%`, `%${v}%`, `%${v}%`, `%${v}%`);
    });
  }

  if (tokenWhereClauses.length === 0) return [];

  return await db.getAllAsync<DBDictEntry>(
    `
    WITH matches AS (
      SELECT
        w.*,
        MIN(
          CASE
            WHEN w.word = ? OR w.kanji = ? THEN 1
            WHEN w.reading = ? OR w.reading_hiragana = ? THEN 2
            WHEN w.word LIKE ? OR w.kanji LIKE ? THEN 3
            WHEN w.reading LIKE ? OR w.reading_hiragana LIKE ? THEN 4
            ELSE 5
          END
        ) as match_rank,
        MIN(length(w.word)) as word_length
      FROM words w
      WHERE ${tokenWhereClauses.join(" OR ")}
      GROUP BY w.id
    )
    SELECT w.*
    FROM words w
    JOIN matches m ON w.id = m.id
    ORDER BY
      m.match_rank,
      m.word_length,
      w.position
    LIMIT ?
    `,
    [
      // Exact match ranking params
      query, query, query, query,
      // Prefix match ranking params
      `${query}%`, `${query}%`, `${query}%`, `${query}%`,
      // Token search params
      ...tokenParams,
      // Limit
      limit
    ]
  );
}

async function fetchMeanings(
  db: SQLiteDatabase,
  words: DBDictEntry[]
): Promise<Map<number, WordMeaning[]>> {
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

  return meaningsMap;
}

export async function searchDictionary(
  db: SQLiteDatabase,
  query: string,
  options: SearchDictionaryOptions = {}
): Promise<SearchDictionaryResult> {
  const { withMeanings = true, limit = 50, minQueryLength = 1 } = options;

  try {
    // Input validation
    if (!query || query.trim().length < minQueryLength) {
      return {
        words: [],
        meanings: new Map(),
        error: `Query must be at least ${minQueryLength} character(s) long`,
      };
    }

    const searchTerms: string[] = [];
    const processedQuery = processSearchQuery(query.trim());

    // Ensure we have non-undefined values for SQLite params
    const hiraganaValue = processedQuery.hiragana || "";
    const katakanaValue = processedQuery.katakana || "";

    if (wanakana.isRomaji(query)) {
      const hiragana = wanakana.toHiragana(query);
      const katakana = wanakana.toKatakana(query);

      // Build search terms for romaji input with proper FTS5 syntax
      searchTerms.push(
        // Exact matches
        `reading:${hiragana}`,
        `reading_hiragana:${hiragana}`,
        `reading:${katakana}`,
        `word:${katakana}`,

        // Prefix matches (supported in FTS5)
        `reading:${hiragana}* OR reading_hiragana:${hiragana}*`,
        `reading:${katakana}* OR word:${katakana}*`,

        // Don't use infix matches with asterisks in the middle - not supported in FTS5

        // Kanji matches
        `kanji:${katakana} OR kanji:${katakana}*`
      );
    } else {
      // Build search terms for regular input
      searchTerms.push(
        // Exact matches
        `word:${query} OR reading:${query} OR kanji:${query}`,

        // Prefix matches (supported in FTS5)
        `word:${query}* OR reading:${query}* OR kanji:${query}*`

        // Removed infix searches with asterisks in the middle
      );

      // Add Japanese script variations
      if (hiraganaValue) {
        searchTerms.push(
          // Direct matches
          `reading:${hiraganaValue} OR reading_hiragana:${hiraganaValue}`,

          // Prefix matches (supported in FTS5)
          `reading:${hiraganaValue}* OR reading_hiragana:${hiraganaValue}*`,

          // Removed infix searches with asterisks in the middle

          // In case hiragana appears in kanji field
          `kanji:${hiraganaValue} OR kanji:${hiraganaValue}*`
        );
      }

      if (katakanaValue) {
        searchTerms.push(
          // Direct matches
          `reading:${katakanaValue} OR word:${katakanaValue}`,

          // Prefix matches (supported in FTS5)
          `reading:${katakanaValue}* OR word:${katakanaValue}*`,

          // Removed infix searches with asterisks in the middle

          // In case katakana appears in kanji field
          `kanji:${katakanaValue} OR kanji:${katakanaValue}*`
        );
      }
    }

    // Build main search query
    let words = await db.getAllAsync<DBDictEntry>(
      `
      WITH matches AS (
        SELECT w.*, bm25(words_fts) as rank
        FROM words_fts f
        JOIN words w ON w.id = f.rowid
        WHERE f.words_fts MATCH ?
        ORDER BY rank
      )
      SELECT DISTINCT w.*
      FROM words w
      JOIN matches m ON w.id = m.id
      WHERE length(w.word) >= ${Math.min(query.length, 2)}
      GROUP BY w.word
      ORDER BY
        CASE
          WHEN w.word = ? OR w.reading = ? OR w.reading_hiragana = ? OR w.kanji = ? THEN 1
          WHEN w.word LIKE ? OR w.reading LIKE ? OR w.reading_hiragana LIKE ? OR w.kanji LIKE ? THEN 2
          ELSE m.rank + 3
        END,
        CASE
          WHEN w.word = ? OR w.kanji = ? THEN 1
          WHEN w.reading = ? OR w.reading_hiragana = ? THEN 2
          ELSE 3
        END,
        length(w.word)
      LIMIT ?
      `,
      [
        searchTerms.join(" OR "),
        // For primary exact matches - use appropriate form based on input type with fallback to original query
        wanakana.isRomaji(query) ? hiraganaValue : query,
        wanakana.isRomaji(query) ? hiraganaValue : query,
        wanakana.isRomaji(query) ? hiraganaValue : query,
        wanakana.isRomaji(query) ? hiraganaValue : query,
        // For prefix matches - use appropriate form based on input type
        wanakana.isRomaji(query) ? `${hiraganaValue}%` : `${query}%`,
        wanakana.isRomaji(query) ? `${hiraganaValue}%` : `${query}%`,
        wanakana.isRomaji(query) ? `${hiraganaValue}%` : `${query}%`,
        wanakana.isRomaji(query) ? `${hiraganaValue}%` : `${query}%`,
        // For secondary ranking (prioritize kanji and word matches)
        wanakana.isRomaji(query) ? hiraganaValue : query,
        wanakana.isRomaji(query) ? hiraganaValue : query,
        wanakana.isRomaji(query) ? hiraganaValue : query,
        wanakana.isRomaji(query) ? hiraganaValue : query,
        limit
      ]
    );

    // If no results from primary search and romaji input, try with katakana
    if (words.length === 0 && wanakana.isRomaji(query) && katakanaValue) {
      words = await db.getAllAsync<DBDictEntry>(
        `
        WITH matches AS (
          SELECT w.*, bm25(words_fts) as rank
          FROM words_fts f
          JOIN words w ON w.id = f.rowid
          WHERE f.words_fts MATCH ?
          ORDER BY rank
        )
        SELECT DISTINCT w.*
        FROM words w
        JOIN matches m ON w.id = m.id
        WHERE length(w.word) >= ${Math.min(query.length, 2)}
        GROUP BY w.word
        ORDER BY
          CASE
            WHEN w.word = ? OR w.reading = ? OR w.kanji = ? THEN 1
            WHEN w.word LIKE ? OR w.reading LIKE ? OR w.kanji LIKE ? THEN 2
            ELSE m.rank + 3
          END,
          length(w.word)
        LIMIT ?
        `,
        [
          // Fixed FTS5 query syntax - no double quotes
          `word:${katakanaValue} OR reading:${katakanaValue} OR kanji:${katakanaValue}`,
          katakanaValue,
          katakanaValue,
          katakanaValue,
          `${katakanaValue}%`,
          `${katakanaValue}%`,
          `${katakanaValue}%`,
          limit
        ]
      );
    }

    // Fallback token search if still no results
    if (words.length === 0) {
      // Try token search for any input type
      words = await searchByTokens(db, query);
    }

    const entries: DictionaryEntry[] = words.map((word) => ({
      ...word,
      readingHiragana: word.reading_hiragana,
    }));

    const meanings = withMeanings ? await fetchMeanings(db, words) : new Map();

    return {
      words: entries,
      meanings,
    };
  } catch (error) {
    console.error("Search error:", error);
    return {
      words: [],
      meanings: new Map(),
      error: "An error occurred while searching the dictionary",
    };
  }
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

function dbWordToDictEntry(word: DBDictEntry): DictionaryEntry {
  return {
    ...word,
    readingHiragana: word.reading_hiragana || null,
  };
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
      const examples = await getWordExamples(db, dbWordToDictEntry(word));

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
        examples,
      };
    }

    return {
      word: dbWordToDictEntry(word),
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

export async function getWordExamples(
  db: SQLiteDatabase,
  word: DictionaryEntry
): Promise<ExampleSentence[]> {
  try {
    const id = word.id;
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
      return examplesByWordId.map((e) => ({
        ...e,
        japaneseText: e.japanese_text,
        englishText: e.english_text,
        exampleId: e.example_id || null,
      }));
    }

    const examplesByText = await db.getAllAsync<DBExampleSentence>(
      `
    SELECT id, japanese_text, english_text, tokens, example_id
    FROM examples
    WHERE japanese_text LIKE ?
    ORDER BY length(japanese_text)
    LIMIT 5
    `,
      [`%${word.word}%`]
    );

    return examplesByText.map((e) => ({
      ...e,
      japaneseText: e.japanese_text,
      englishText: e.english_text,
      exampleId: e.example_id || null,
    }));
  } catch (error) {
    console.error("Failed to get examples:", error);
    return [];
  }
}
export async function resetDatabase(db: SQLiteDatabase): Promise<void> {
  try {
    console.log("Starting database reset process...");

    // Step 1: Drop all tables and reset user_version
    await db.execAsync(`
      DROP TABLE IF EXISTS meanings;
      DROP TABLE IF EXISTS words;
      DROP TABLE IF EXISTS examples;
      DROP TABLE IF EXISTS edict_fts;
      DROP TABLE IF EXISTS edict_meanings;
      DROP TABLE IF EXISTS edict_entries;
      DROP TABLE IF EXISTS bookmarks;
      DROP TABLE IF EXISTS history;
      DROP TABLE IF EXISTS chats;
      DROP TABLE IF EXISTS audio_blobs;
      DROP TABLE IF EXISTS kanji;
    `);

    await db.execAsync(`PRAGMA user_version = 0`);

    // Step 2: Close the database connection
    await db.closeAsync();

    // Step 3: Delete the physical database file and related files to force a complete reinitialize
    const dbDirectory = FileSystem.documentDirectory + "SQLite/";
    const dbPath = dbDirectory + "jisho_2.db";
    const walPath = dbPath + "-wal";
    const shmPath = dbPath + "-shm";

    const fileExists = await FileSystem.getInfoAsync(dbPath);
    if (fileExists.exists) {
      console.log("Deleting database file...");
      await FileSystem.deleteAsync(dbPath, { idempotent: true });
    }

    // Delete WAL and SHM files if they exist
    const walExists = await FileSystem.getInfoAsync(walPath);
    if (walExists.exists) {
      await FileSystem.deleteAsync(walPath, { idempotent: true });
    }

    const shmExists = await FileSystem.getInfoAsync(shmPath);
    if (shmExists.exists) {
      await FileSystem.deleteAsync(shmPath, { idempotent: true });
    }

    console.log(
      "Database files deleted. The app will now recreate the database from the asset on restart."
    );

    // Alert the user that they need to restart the app
    // You'll need to decide how to display this message based on your UI
    Alert.alert(
      "Database Reset",
      "The database has been reset. Please restart the app to recreate the database.",
      [{ text: "OK" }]
    );
    return;
  } catch (error) {
    console.error("Error during database reset:", error);
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

export async function getChats(
  db: SQLiteDatabase,
  limit = 50,
  offset = 0
): Promise<Chat[]> {
  try {
    const chats = await db.getAllAsync<DBChat>(
      `SELECT * FROM chats ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return chats.map((c) => ({
      ...c,
      createdAt: c.created_at,
    }));
  } catch (error) {
    console.error("Failed to get chats:", error);
    return [];
  }
}

export async function addChat(
  db: SQLiteDatabase,
  request: string,
  response: string
): Promise<Chat | null> {
  try {
    const res = await db.runAsync(
      "INSERT INTO chats (request, response, created_at) VALUES (?, ?, ?)",
      [request, response, new Date().toISOString()]
    );
    const createdChat = await db.getFirstAsync<DBChat>(
      "SELECT * FROM chats WHERE id = ?",
      [res.lastInsertRowId]
    );
    return createdChat
      ? {
          ...createdChat,
          createdAt: createdChat.created_at,
        }
      : null;
  } catch (error) {
    console.error("Failed to add chat:", error);
    return null;
  }
}

export async function removeChatById(
  db: SQLiteDatabase,
  chatId: number
): Promise<boolean> {
  try {
    await db.runAsync("DELETE FROM chats WHERE id = ?", [chatId]);
    return true;
  } catch (error) {
    console.error("Failed to remove chat:", error);
    return false;
  }
}

export async function clearChats(db: SQLiteDatabase): Promise<boolean> {
  try {
    await db.runAsync("DELETE FROM chats");
    return true;
  } catch (error) {
    console.error("Failed to clear chats:", error);
    return false;
  }
}

export async function saveAudioFile(
  db: SQLiteDatabase,
  wordId: number,
  exampleId: number,
  filePath: string
): Promise<number | null> {
  try {
    const fileBlob = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const result = await db.runAsync(
      "INSERT INTO audio_blobs (file_path, word_id, example_id, audio_data, created_at) VALUES (?, ?, ?, ?, ?)",
      [filePath, wordId, exampleId, fileBlob, new Date().toISOString()]
    );

    return result.lastInsertRowId;
  } catch (error) {
    console.error("Failed to save audio file:", error);
    return null;
  }
}

export async function getAudioFile(
  db: SQLiteDatabase,
  wordId: number,
  exampleId: number
): Promise<AudioFile | null> {
  try {
    const result = await db.getFirstAsync<DBAudio>(
      "SELECT id, file_path, audio_data FROM audio_blobs WHERE word_id = ? AND example_id = ? ORDER BY created_at DESC LIMIT 1",
      [wordId, exampleId]
    );

    if (result) {
      const filePath = await audioFileBlobToFileUrl({
        audioData: result.audio_data,
        id: result.id,
        filePath: result.file_path,
      });

      if (!filePath) {
        console.error("Failed to convert audio file blob to URL");
        return null;
      }

      return {
        filePath,
        id: result.id,
        audioData: result.audio_data,
      };
    }

    return null;
  } catch (error) {
    console.error("Failed to get audio file:", error);
    return null;
  }
}

async function audioFileBlobToFileUrl(
  audioFile: AudioFile
): Promise<string | null> {
  try {
    const tempDir = FileSystem.cacheDirectory + "audio/";
    const tempPath = tempDir + `audio-${audioFile.id}.mp3`;
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true }).catch(
      () => {}
    );
    const fileInfo = await FileSystem.getInfoAsync(tempPath);
    if (!fileInfo.exists) {
      await FileSystem.writeAsStringAsync(tempPath, audioFile.audioData, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    return tempPath;
  } catch (error) {
    console.error("Failed to convert audio file blob to URL:", error);
    return null;
  }
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

    // Parse string arrays from DB
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
      created_at: result.created_at,
      onReadings,
      kunReadings,
      meanings,
    };
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

    return results.map((result) => {
      // Parse string arrays from DB
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
        created_at: result.created_at,
        onReadings,
        kunReadings,
        meanings,
      };
    });
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

    // Parse string arrays from DB
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
      created_at: result.created_at,
      onReadings,
      kunReadings,
      meanings,
    };
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

    // Parse string arrays from DB
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
      created_at: result.created_at,
      onReadings,
      kunReadings,
      meanings,
    };
  } catch (error) {
    console.error("Failed to get kanji by id:", error);
    return null;
  }
}

export function getKanjiList(db: SQLiteDatabase): Promise<KanjiEntry[]> {
  return db
    .getAllAsync<DBKanji>("SELECT * FROM kanji ORDER BY RANDOM() LIMIT 50")
    .then((results) => {
      return results.map((result) => {
        // Parse string arrays from DB
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
          created_at: result.created_at,
          onReadings,
          kunReadings,
          meanings,
        };
      });
    });
}
