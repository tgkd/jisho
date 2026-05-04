import { SQLiteDatabase } from "expo-sqlite";
import * as wanakana from "wanakana";
import {
  DBDictEntry,
  DBWordMeaning,
  SearchDictionaryOptions,
  SearchDictionaryResult,
  SearchQuery,
  WordMeaning,
} from "./types";
import {
  buildFtsMatchExpression,
  createEmptyResult,
  formatSearchResults,
  processSearchQuery,
  retryDatabaseOperation,
} from "./utils";

const SEARCH_CACHE_TTL_MS = 30_000;
const SEARCH_CACHE_MAX_ENTRIES = 100;
const MAX_QUERY_LENGTH = 64;
const MAX_QUERY_TOKENS = 8;

type CachedSearchEntry = {
  timestamp: number;
  result: SearchDictionaryResult;
};

const searchResultCache = new Map<string, CachedSearchEntry>();

function buildSearchCacheKey(
  query: string,
  limit: number,
  withMeanings: boolean
): string {
  return `${query}::${limit}::${withMeanings ? "1" : "0"}`;
}

function getCachedSearchResult(
  cacheKey: string
): SearchDictionaryResult | undefined {
  const cached = searchResultCache.get(cacheKey);
  if (!cached) return undefined;
  if (Date.now() - cached.timestamp > SEARCH_CACHE_TTL_MS) {
    searchResultCache.delete(cacheKey);
    return undefined;
  }
  return cached.result;
}

function setCachedSearchResult(
  cacheKey: string,
  result: SearchDictionaryResult
): void {
  if (searchResultCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = searchResultCache.keys().next().value;
    if (oldestKey !== undefined) {
      searchResultCache.delete(oldestKey);
    }
  }

  Object.freeze(result.words);
  result.meanings.forEach((meanings) => Object.freeze(meanings));
  Object.freeze(result.meanings);
  Object.freeze(result);

  searchResultCache.set(cacheKey, { timestamp: Date.now(), result });
}

function isQueryTooComplex(query: string): boolean {
  const normalized = query.trim();
  if (normalized.length > MAX_QUERY_LENGTH) return true;
  return normalized.split(/\s+/).filter(Boolean).length > MAX_QUERY_TOKENS;
}

async function fetchMeanings(
  db: SQLiteDatabase,
  words: DBDictEntry[],
  signal?: AbortSignal
): Promise<Map<number, WordMeaning[]>> {
  const meaningsMap = new Map<number, WordMeaning[]>();
  if (words.length === 0) return meaningsMap;
  if (signal?.aborted) throw new Error("Fetch cancelled");

  const wordIds = words.map((w) => w.id);
  const placeholders = wordIds.map(() => "?").join(",");

  const meanings = await retryDatabaseOperation(() =>
    db.getAllAsync<DBWordMeaning>(
      `SELECT id, word_id, meaning, part_of_speech, field, misc, info
       FROM meanings
       WHERE word_id IN (${placeholders})
       ORDER BY word_id`,
      wordIds
    )
  );

  if (signal?.aborted) throw new Error("Fetch cancelled");

  meanings.forEach((m) => {
    if (!meaningsMap.has(m.word_id)) meaningsMap.set(m.word_id, []);
    meaningsMap.get(m.word_id)!.push({
      id: m.id,
      meaning: m.meaning,
      field: m.field,
      misc: m.misc,
      info: m.info,
      wordId: m.word_id,
      partOfSpeech: m.part_of_speech || null,
    });
  });

  return meaningsMap;
}

/**
 * Single FTS query handling exact, prefix, and substring matches uniformly.
 * The words_fts table indexes a search_ngrams column built at import time
 * with unigram/bigram/trigram tokens of CJK runs, so phrase match on a
 * single kanji like "曜" finds all compounds containing it. Ranking is by
 * exact-match boost, then JMdict priority_rank (15.5% of entries have it),
 * then FTS bm25 rank, then surface length.
 */
async function searchByJapanese(
  db: SQLiteDatabase,
  query: SearchQuery,
  limit: number
): Promise<DBDictEntry[]> {
  const matchExpression = buildFtsMatchExpression(query);
  const hira = query.hiragana || query.original;
  const orig = query.original;

  return retryDatabaseOperation(() =>
    db.getAllAsync<DBDictEntry>(
      `
      WITH params(q, orig) AS (SELECT ?, ?),
      ranked AS (
        SELECT w.*, f.rank AS fts_rank,
          ROW_NUMBER() OVER (
            PARTITION BY w.word, w.reading
            ORDER BY
              CASE
                WHEN w.word = p.q OR w.reading = p.q OR w.reading_hiragana = p.q OR w.kanji = p.q
                  OR w.word = p.orig OR w.kanji = p.orig THEN 0
                WHEN w.word LIKE p.q || '%' OR w.reading LIKE p.q || '%' OR w.reading_hiragana LIKE p.q || '%' OR w.kanji LIKE p.q || '%'
                  OR w.word LIKE p.orig || '%' OR w.kanji LIKE p.orig || '%' THEN 1
                ELSE 2
              END,
              w.priority_rank,
              f.rank,
              length(w.word)
          ) AS row_num
        FROM words_fts f
        JOIN words w ON w.id = f.rowid
        CROSS JOIN params p
        WHERE f.words_fts MATCH ?
      )
      SELECT * FROM ranked
      CROSS JOIN params p
      WHERE row_num = 1
      ORDER BY
        CASE
          WHEN word = p.q OR reading = p.q OR reading_hiragana = p.q OR kanji = p.q
            OR word = p.orig OR kanji = p.orig THEN 0
          WHEN word LIKE p.q || '%' OR reading LIKE p.q || '%' OR reading_hiragana LIKE p.q || '%' OR kanji LIKE p.q || '%'
            OR word LIKE p.orig || '%' OR kanji LIKE p.orig || '%' THEN 1
          ELSE 2
        END,
        priority_rank,
        fts_rank,
        length(word)
      LIMIT ?
      `,
      [hira, orig, matchExpression, limit]
    )
  );
}

function buildEnglishMatchExpression(query: string): string {
  const tokens = query
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/gi, ""))
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return `"${query.replace(/"/g, '""')}"`;
  return tokens.map((token) => `"${token}"*`).join(" ");
}

async function searchByEnglish(
  db: SQLiteDatabase,
  query: string,
  limit: number
): Promise<DBDictEntry[]> {
  const normalizedQuery = query.toLowerCase().trim();
  if (normalizedQuery.length === 0) return [];

  const matchExpression = buildEnglishMatchExpression(normalizedQuery);
  const exactPrefix = `${normalizedQuery}%`;

  return retryDatabaseOperation(() =>
    db.getAllAsync<DBDictEntry>(
      `
      WITH matches AS (
        SELECT
          m.word_id AS word_id,
          MIN(
            CASE
              WHEN LOWER(m.meaning) = ? THEN 1
              WHEN LOWER(m.meaning) LIKE ? THEN 2
              ELSE 3
            END
          ) AS match_rank
        FROM meanings_fts f
        JOIN meanings m ON m.id = f.rowid
        WHERE f.meaning MATCH ?
        GROUP BY m.word_id
      ),
      ranked AS (
        SELECT
          w.*,
          mt.match_rank,
          ROW_NUMBER() OVER (
            PARTITION BY w.word, w.reading
            ORDER BY mt.match_rank, w.priority_rank, length(w.word), w.position
          ) AS row_num
        FROM matches mt
        JOIN words w ON w.id = mt.word_id
      )
      SELECT * FROM ranked
      WHERE row_num = 1
      ORDER BY match_rank, priority_rank, length(word), position
      LIMIT ?
      `,
      [normalizedQuery, exactPrefix, matchExpression, limit]
    )
  );
}

export async function searchDictionary(
  db: SQLiteDatabase,
  query: string,
  options: SearchDictionaryOptions = {}
): Promise<SearchDictionaryResult> {
  const {
    withMeanings = true,
    limit = 50,
    minQueryLength = 1,
    signal,
  } = options;

  try {
    if (!query || query.trim().length < minQueryLength) {
      return createEmptyResult(
        `Query must be at least ${minQueryLength} character(s) long`
      );
    }

    if (signal?.aborted) throw new Error("Search cancelled");

    const trimmedQuery = query.trim();
    if (isQueryTooComplex(trimmedQuery)) {
      return createEmptyResult("Query is too long or complex to process");
    }

    const cacheKey = buildSearchCacheKey(trimmedQuery, limit, withMeanings);
    const cached = getCachedSearchResult(cacheKey);
    if (cached) return cached;

    const isLatinText =
      !wanakana.isJapanese(trimmedQuery) &&
      /^[a-zA-Z\s\-'.,!?]+$/.test(trimmedQuery);

    let results: DBDictEntry[];

    if (isLatinText) {
      if (signal?.aborted) throw new Error("Search cancelled");
      const englishResults = await searchByEnglish(db, trimmedQuery, limit);
      if (englishResults.length > 0) {
        results = englishResults;
      } else {
        // No English meanings matched; fall through to Japanese (treats input
        // as potential romaji, which processSearchQuery will convert).
        const processedQuery = processSearchQuery(trimmedQuery);
        if (signal?.aborted) throw new Error("Search cancelled");
        results = await searchByJapanese(db, processedQuery, limit);
      }
    } else {
      const processedQuery = processSearchQuery(trimmedQuery);
      if (signal?.aborted) throw new Error("Search cancelled");
      results = await searchByJapanese(db, processedQuery, limit);
    }

    if (signal?.aborted) throw new Error("Search cancelled");
    const meanings = withMeanings
      ? await fetchMeanings(db, results, signal)
      : new Map();
    const result = formatSearchResults(results, meanings);
    if (!result.error) setCachedSearchResult(cacheKey, result);
    return result;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Search cancelled" || signal?.aborted)
    ) {
      const abortError = new Error("Search cancelled");
      abortError.name = "AbortError";
      throw abortError;
    }
    console.error("Search error:", error);
    return createEmptyResult(
      "An error occurred while searching the dictionary"
    );
  }
}
