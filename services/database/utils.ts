import { DATABASE_NAME } from "@/constants/Database";
import { Directory, File, Paths } from "expo-file-system";
import { SQLiteDatabase } from "expo-sqlite";
import { Alert } from "react-native";
import * as wanakana from "wanakana";
import { DBDictEntry, DictionaryEntry, SearchDictionaryResult, SearchQuery, WordMeaning } from "./types";

type ScriptType = "romaji" | "hiragana" | "katakana" | "japanese-mixed" | "other";

function detectScript(query: string): ScriptType {
  let hasRomaji = false;
  let hasHiragana = false;
  let hasKatakana = false;
  let hasKanji = false;

  for (let i = 0; i < query.length; i++) {
    const code = query.charCodeAt(i);

    if (code >= 0x3040 && code <= 0x309f) {
      hasHiragana = true;
    } else if (code >= 0x30a0 && code <= 0x30ff) {
      hasKatakana = true;
    } else if (code >= 0x4e00 && code <= 0x9fff) {
      hasKanji = true;
    } else if (
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a)
    ) {
      hasRomaji = true;
    }
  }

  const japaneseSignals = [hasHiragana, hasKatakana, hasKanji].filter(Boolean).length;

  if (japaneseSignals === 0 && hasRomaji) return "romaji";
  if (hasHiragana && !hasKatakana && !hasKanji) return "hiragana";
  if (hasKatakana && !hasHiragana && !hasKanji) return "katakana";
  if (japaneseSignals > 0) return "japanese-mixed";
  return "other";
}

export function processSearchQuery(query: string): SearchQuery {
  const script = detectScript(query);
  const result: SearchQuery = { original: query };

  switch (script) {
    case "romaji":
      result.hiragana = wanakana.toHiragana(query);
      result.katakana = wanakana.toKatakana(query);
      break;
    case "hiragana":
      result.katakana = wanakana.toKatakana(query);
      result.romaji = wanakana.toRomaji(query);
      break;
    case "katakana":
      result.hiragana = wanakana.toHiragana(query);
      result.romaji = wanakana.toRomaji(query);
      break;
    case "japanese-mixed": {
      result.romaji = wanakana.toRomaji(query);
      const hiragana = wanakana.toHiragana(query);
      const katakana = wanakana.toKatakana(query);
      if (hiragana !== query) result.hiragana = hiragana;
      if (katakana !== query) result.katakana = katakana;
      break;
    }
    case "other":
      break;
  }

  return result;
}

export function createEmptyResult(error?: string): SearchDictionaryResult {
  return {
    words: [],
    meanings: new Map(),
    error,
  };
}

export function formatSearchResults(
  entries: DBDictEntry[],
  meanings: Map<number, WordMeaning[]>
): SearchDictionaryResult {
  return {
    words: entries.map((word) => ({
      ...word,
      readingHiragana: word.reading_hiragana,
    })),
    meanings,
  };
}

export function buildFtsMatchExpression(query: SearchQuery): string {
  const escape = (s: string) => s.replace(/"/g, '""');
  const terms: string[] = [];

  const orig = escape(query.original);
  terms.push(`"${orig}"^2`);
  terms.push(`"${orig}"*`);

  if (query.hiragana) {
    const h = escape(query.hiragana);
    terms.push(`"${h}"`, `"${h}"*`);
  }

  if (query.katakana) {
    const k = escape(query.katakana);
    terms.push(`"${k}"`, `"${k}"*`);
  }

  if (query.romaji) {
    const r = escape(query.romaji);
    terms.push(`"${r}"`, `"${r}"*`);
  }

  return terms.join(" OR ");
}

export function dbWordToDictEntry(word: DBDictEntry): DictionaryEntry {
  return {
    ...word,
    readingHiragana: word.reading_hiragana || null,
  };
}

/**
 * Retries a database operation when SQLite reports the database is busy
 * or locked. Uses exponential backoff between attempts; non-lock errors
 * propagate immediately.
 */
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 50
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      const isDatabaseLocked =
        error instanceof Error &&
        (error.message.includes("database is locked") ||
          error.message.includes("SQLITE_BUSY"));

      if (isLastAttempt || !isDatabaseLocked) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.pow(2, i))
      );
    }
  }
  throw new Error("Retry limit exceeded");
}

export async function resetDatabase(db: SQLiteDatabase): Promise<void> {
  try {
    console.log("Starting database reset process...");

    await db.execAsync(`
      DROP TABLE IF EXISTS meanings;
      DROP TABLE IF EXISTS words;
      DROP TABLE IF EXISTS examples;
      DROP TABLE IF EXISTS history;
      DROP TABLE IF EXISTS practice_sessions;
      DROP TABLE IF EXISTS furigana;
      DROP TABLE IF EXISTS kanji;
    `);

    await db.execAsync(`PRAGMA user_version = 0`);
    await db.closeAsync();

    const sqliteDir = new Directory(Paths.document, "SQLite");
    const dbFile = new File(sqliteDir, DATABASE_NAME);
    const walFile = new File(sqliteDir, `${DATABASE_NAME}-wal`);
    const shmFile = new File(sqliteDir, `${DATABASE_NAME}-shm`);

    if (dbFile.exists) {
      console.log("Deleting database file...");
      dbFile.delete();
    }

    if (walFile.exists) {
      walFile.delete();
    }

    if (shmFile.exists) {
      shmFile.delete();
    }

    console.log(
      "Database files deleted. The app will now recreate the database from the asset on restart."
    );

    Alert.alert(
      "Database Reset",
      "The database has been reset. Please restart the app to recreate the database.",
      [{ text: "OK" }]
    );
    return;
  } catch (error) {
    console.error("Error during database reset:", error);
  }
}
