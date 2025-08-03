import * as FileSystem from "expo-file-system";
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

export function createRankingClause(
  wordField: string,
  readingField: string,
  hiraganaField: string,
  kanjiField: string
): string {
  return `
    CASE
      WHEN word = ${wordField} OR reading = ${readingField} OR reading_hiragana = ${hiraganaField} OR kanji = ${kanjiField} THEN 1
      WHEN word LIKE ${wordField} || '%' OR reading LIKE ${readingField} || '%' OR reading_hiragana LIKE ${hiraganaField} || '%' OR kanji LIKE ${kanjiField} || '%' THEN 2
      ELSE rank + 3
    END
  `;
}

export function createEmptyResult(error?: string): SearchDictionaryResult {
  return {
    words: [],
    meanings: new Map(),
    error,
  };
}

export function formatSearchResults(
  entries: DictionaryEntry[],
  meanings: Map<number, WordMeaning[]>
): SearchDictionaryResult {
  return {
    words: entries,
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
  const terms: string[] = [];

  terms.push(`"${query.original}"^2`);
  terms.push(`"${query.original}"*`);

  if (query.hiragana) {
    terms.push(`"${query.hiragana}"`, `"${query.hiragana}"*`);
  }

  if (query.katakana) {
    terms.push(`"${query.katakana}"`, `"${query.katakana}"*`);
  }

  if (query.romaji) {
    terms.push(`"${query.romaji}"`, `"${query.romaji}"*`);
  }

  return terms.join(" OR ");
}

export function createDeduplicationQuery(
  matchSubquery: string,
  rankingClause: string,
  minWordLength: number = 1
): string {
  return `
    WITH matches AS (
      ${matchSubquery}
    ),
    deduped AS (
      SELECT
        w.*,
        m.rank,
        ROW_NUMBER() OVER (
          PARTITION BY w.word, w.reading
          ORDER BY ${rankingClause}, length(w.word)
        ) as row_num
      FROM words w
      JOIN matches m ON w.id = m.id
      WHERE length(w.word) >= ${minWordLength}
    )
    SELECT * FROM deduped
    WHERE row_num = 1
    ORDER BY ${rankingClause}, length(word)
    LIMIT ?
  `;
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
      DROP TABLE IF EXISTS bookmarks;
      DROP TABLE IF EXISTS history;
      DROP TABLE IF EXISTS chats;
      DROP TABLE IF EXISTS audio_blobs;
      DROP TABLE IF EXISTS kanji;
    `);

    await db.execAsync(`PRAGMA user_version = 0`);
    await db.closeAsync();

    const dbDirectory = FileSystem.documentDirectory + "SQLite/";
    const dbPath = dbDirectory + "jisho_2.db";
    const walPath = dbPath + "-wal";
    const shmPath = dbPath + "-shm";

    const fileExists = await FileSystem.getInfoAsync(dbPath);
    if (fileExists.exists) {
      console.log("Deleting database file...");
      await FileSystem.deleteAsync(dbPath, { idempotent: true });
    }

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
