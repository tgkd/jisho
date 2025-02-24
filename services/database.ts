import { SQLiteDatabase } from "expo-sqlite";

export interface DictionaryEntry {
  id: number;
  word: string;
  reading: string;
  reading_hiragana?: string;
  kanji?: string;
  meanings: {
    meaning: string;
    partOfSpeech?: string;
    field?: string;
    misc?: string;
    info?: string;
  }[];
}

interface WordRow {
  id: number;
  word: string;
  reading: string;
  reading_hiragana: string | null;
  kanji: string | null;
  position: number;
}

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
}

export async function searchDictionary(
  db: SQLiteDatabase,
  query: string
): Promise<DictionaryEntry[]> {
  // First get matching words
  const words = await db.getAllAsync<WordRow>(
    `
    SELECT * FROM words
    WHERE word LIKE ?
    OR reading LIKE ?
    OR kanji LIKE ?
    LIMIT 50
  `,
    [`%${query}%`, `%${query}%`, `%${query}%`]
  );

  // Then get meanings for each word
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
        meanings: meanings.map((m) => ({
          meaning: m.meaning,
          partOfSpeech: m.part_of_speech || undefined,
          field: m.field || undefined,
          misc: m.misc || undefined,
          info: m.info || undefined,
        })),
      };
    })
  );

  return entries;
}

// Helper function to get a single entry by ID
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
    meanings: meanings.map((m) => ({
      meaning: m.meaning,
      partOfSpeech: m.part_of_speech || undefined,
      field: m.field || undefined,
      misc: m.misc || undefined,
      info: m.info || undefined,
    })),
  };
}
