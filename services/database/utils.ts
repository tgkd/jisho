import { DATABASE_NAME } from "@/constants/Database";
import { Directory, File, Paths } from "expo-file-system";
import { SQLiteDatabase } from "expo-sqlite";
import { Alert } from "react-native";
import * as wanakana from "wanakana";
import { DBDictEntry, DictionaryEntry, SearchDictionaryResult, SearchQuery, WordMeaning } from "./types";

export function processSearchQuery(query: string): SearchQuery {
  const result: SearchQuery = {
    original: query,
    romaji: wanakana.isJapanese(query) ? wanakana.toRomaji(query) : undefined,
  };

  if (wanakana.isRomaji(query)) {
    result.hiragana = wanakana.toHiragana(query);
    result.katakana = wanakana.toKatakana(query);
  } else if (wanakana.isHiragana(query)) {
    result.katakana = wanakana.toKatakana(query);
  } else if (wanakana.isKatakana(query)) {
    result.hiragana = wanakana.toHiragana(query);
  } else if (wanakana.isJapanese(query)) {
    const hiragana = wanakana.toHiragana(query);
    const katakana = wanakana.toKatakana(query);

    if (hiragana !== query) result.hiragana = hiragana;
    if (katakana !== query) result.katakana = katakana;
  }

  return result;
}

export function tokenizeJp(text: string) {
  const tokens = wanakana.tokenize(text);
  return tokens.map((t) => (typeof t === "string" ? t : t.value));
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

export function isSingleKanjiCharacter(query: string): boolean {
  return (
    query.length === 1 &&
    !wanakana.isHiragana(query) &&
    !wanakana.isKatakana(query) &&
    wanakana.isJapanese(query)
  );
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

export async function resetDatabase(db: SQLiteDatabase): Promise<void> {
  try {
    console.log("Starting database reset process...");

    await db.execAsync(`
      DROP TABLE IF EXISTS meanings;
      DROP TABLE IF EXISTS words;
      DROP TABLE IF EXISTS examples;
      DROP TABLE IF EXISTS edict_fts;
      DROP TABLE IF EXISTS edict_meanings;
      DROP TABLE IF EXISTS edict_entries;
      DROP TABLE IF EXISTS history;
      DROP TABLE IF EXISTS audio_blobs;
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
