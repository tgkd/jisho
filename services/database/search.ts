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
  isSingleKanjiCharacter,
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

const MATCH_RANK = Object.freeze({
  EXACT: 1,
  PREFIX: 2,
  CONTAINS: 3,
});

const SUB_RANK = Object.freeze({
  EXACT: Object.freeze({
    HIRAGANA: 1,
    READING: 2,
    WORD: 3,
    KANJI: 4,
  }),
  PREFIX: Object.freeze({
    HIRAGANA: 5,
    READING: 6,
    WORD: 7,
    KANJI: 8,
  }),
  CONTAINS: Object.freeze({
    HIRAGANA: 9,
    READING: 10,
    WORD: 11,
    KANJI: 12,
  }),
  DEFAULT: 99,
});


/**
 * Creates a deterministic cache key for search results.
 * @param query - Original user query string
 * @param limit - Maximum number of results requested
 * @param withMeanings - Whether meanings should be included in the response
 */
function buildSearchCacheKey(
  query: string,
  limit: number,
  withMeanings: boolean
): string {
  return `${query}::${limit}::${withMeanings ? "1" : "0"}`;
}

/**
 * Retrieves a cached search result if present and not expired.
 * Cached results are frozen on insert and shared by reference; consumers
 * must treat them as immutable.
 */
function getCachedSearchResult(
  cacheKey: string
): SearchDictionaryResult | undefined {
  const cached = searchResultCache.get(cacheKey);
  if (!cached) {
    return undefined;
  }

  if (Date.now() - cached.timestamp > SEARCH_CACHE_TTL_MS) {
    searchResultCache.delete(cacheKey);
    return undefined;
  }

  return cached.result;
}

/**
 * Stores a search result in the cache. The result is frozen so that
 * callers reading the shared instance cannot accidentally mutate it.
 * Eviction relies on Map insertion order — the first key is the oldest.
 */
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

  searchResultCache.set(cacheKey, {
    timestamp: Date.now(),
    result,
  });
}

/**
 * Determines whether the provided query exceeds predefined complexity limits.
 * @param query - Query string with whitespace preserved
 */
function isQueryTooComplex(query: string): boolean {
  const normalized = query.trim();
  if (normalized.length > MAX_QUERY_LENGTH) {
    return true;
  }

  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  return tokenCount > MAX_QUERY_TOKENS;
}

/**
 * Batches meaning lookups for dictionary entries, respecting cancellation requests.
 * @param db - SQLite database connection instance
 * @param words - Dictionary entries requiring meanings
 * @param signal - Optional abort signal for cooperative cancellation
 * @returns Map keyed by word identifier containing associated meanings
 * @throws Error when the fetch is cancelled or database retries are exhausted
 */
async function fetchMeanings(
  db: SQLiteDatabase,
  words: DBDictEntry[],
  signal?: AbortSignal
): Promise<Map<number, WordMeaning[]>> {
  const meaningsMap = new Map<number, WordMeaning[]>();

  if (words.length === 0) return meaningsMap;

  // Check for cancellation
  if (signal?.aborted) {
    throw new Error("Fetch cancelled");
  }

  // Single batched query instead of N individual queries
  const wordIds = words.map((w) => w.id);
  const placeholders = wordIds.map(() => "?").join(",");

  const meanings = await retryDatabaseOperation(() =>
    db.getAllAsync<DBWordMeaning>(
      `
    SELECT id, word_id, meaning, part_of_speech, field, misc, info
    FROM meanings
    WHERE word_id IN (${placeholders})
    ORDER BY word_id
    `,
      wordIds
    )
  );

  // Check for cancellation after query
  if (signal?.aborted) {
    throw new Error("Fetch cancelled");
  }

  // Group meanings by word_id
  meanings.forEach((m) => {
    if (!meaningsMap.has(m.word_id)) {
      meaningsMap.set(m.word_id, []);
    }
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
 * Searches for entries containing a single kanji character.
 * Uses LIKE-based substring scan because the words_fts virtual table is
 * built with the default unicode61 tokenizer, which treats CJK runs as
 * single tokens — a phrase match on `kanji:"水"` would only fire when
 * the kanji column equals "水" exactly and would miss every compound.
 */
async function searchBySingleKanji(
  db: SQLiteDatabase,
  kanji: string,
  options: { limit: number }
): Promise<DBDictEntry[]> {
  const containsPattern = `%${kanji}%`;

  return await retryDatabaseOperation(() =>
    db.getAllAsync<DBDictEntry>(
      `
      WITH matched AS (
        SELECT
          w.*,
          CASE
            WHEN w.word = ? OR w.kanji = ? THEN ${MATCH_RANK.EXACT}
            ELSE ${MATCH_RANK.CONTAINS}
          END AS match_rank,
          length(w.word) AS word_length
        FROM words w
        WHERE w.word = ? OR w.kanji LIKE ?
      ),
      deduped AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY word, reading
            ORDER BY match_rank, word_length
          ) AS row_num
        FROM matched
      )
      SELECT * FROM deduped
      WHERE row_num = 1
      ORDER BY match_rank, word_length
      LIMIT ?
      `,
      [kanji, kanji, kanji, containsPattern, options.limit]
    )
  );
}

/**
 * Performs an FTS-based dictionary search prioritising exact and prefix matches.
 * @param db - SQLite database connection instance
 * @param query - Normalised search query forms
 * @param options - Search options including maximum number of rows
 * @returns Ranked dictionary entries matching the FTS expression
 */
async function searchByFTS(
  db: SQLiteDatabase,
  query: SearchQuery,
  options: { limit: number }
): Promise<DBDictEntry[]> {
  try {
    const matchExpression = buildFtsMatchExpression(query);
    const hiraganaQuery = query.hiragana || query.original;
    const originalQuery = query.original;

    return await retryDatabaseOperation(() =>
      db.getAllAsync<DBDictEntry>(
        `
        WITH params(q, orig) AS (SELECT ?, ?),
        ranked AS (
          SELECT w.*, f.rank as fts_rank,
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
                f.rank,
                length(w.word)
            ) as row_num
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
          fts_rank,
          length(word)
        LIMIT ?
        `,
        [hiraganaQuery, originalQuery, matchExpression, options.limit]
      )
    );
  } catch (error) {
    console.error("FTS search failed:", error);
    return [];
  }
}


/**
 * Searches dictionary meanings via the meanings_fts virtual table when
 * available, falling back to a LIKE-based scan for legacy DBs that have
 * not yet been migrated.
 */
async function searchByEnglish(
  db: SQLiteDatabase,
  query: string,
  limit: number
): Promise<DBDictEntry[]> {
  const normalizedQuery = query.toLowerCase().trim();

  if (normalizedQuery.length === 0) return [];

  if (await meaningsFtsAvailable(db)) {
    const ftsResults = await searchByEnglishFts(db, normalizedQuery, limit);
    if (ftsResults.length > 0) {
      return ftsResults;
    }
  }

  return await searchByEnglishLike(db, normalizedQuery, limit);
}

const meaningsFtsCheckByDb = new WeakMap<SQLiteDatabase, Promise<boolean>>();

function meaningsFtsAvailable(db: SQLiteDatabase): Promise<boolean> {
  const cached = meaningsFtsCheckByDb.get(db);
  if (cached) return cached;

  const check = db
    .getFirstAsync<{ name: string } | null>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='meanings_fts'"
    )
    .then((row) => row !== null && row !== undefined)
    .catch(() => false);

  meaningsFtsCheckByDb.set(db, check);
  return check;
}

function buildEnglishMatchExpression(query: string): string {
  const tokens = query
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/gi, ""))
    .filter((token) => token.length > 0);

  if (tokens.length === 0) return `"${query.replace(/"/g, '""')}"`;

  return tokens.map((token) => `"${token}"*`).join(" ");
}

async function searchByEnglishFts(
  db: SQLiteDatabase,
  normalizedQuery: string,
  limit: number
): Promise<DBDictEntry[]> {
  const matchExpression = buildEnglishMatchExpression(normalizedQuery);
  const exactPrefix = `${normalizedQuery}%`;

  try {
    return await retryDatabaseOperation(() =>
      db.getAllAsync<DBDictEntry>(
        `
        WITH matches AS (
          SELECT
            m.word_id AS word_id,
            MIN(
              CASE
                WHEN LOWER(m.meaning) = ? THEN ${MATCH_RANK.EXACT}
                WHEN LOWER(m.meaning) LIKE ? THEN ${MATCH_RANK.PREFIX}
                ELSE ${MATCH_RANK.CONTAINS}
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
            length(w.word) AS word_length,
            ROW_NUMBER() OVER (
              PARTITION BY w.word, w.reading
              ORDER BY mt.match_rank, length(w.word), w.position
            ) AS row_num
          FROM matches mt
          JOIN words w ON w.id = mt.word_id
        )
        SELECT * FROM ranked
        WHERE row_num = 1
        ORDER BY match_rank, word_length, position
        LIMIT ?
        `,
        [normalizedQuery, exactPrefix, matchExpression, limit]
      )
    );
  } catch (error) {
    console.warn("English FTS search failed, falling back to LIKE:", error);
    return [];
  }
}

async function searchByEnglishLike(
  db: SQLiteDatabase,
  normalizedQuery: string,
  limit: number
): Promise<DBDictEntry[]> {
  const containsPattern = `%${normalizedQuery}%`;

  return await retryDatabaseOperation(() =>
    db.getAllAsync<DBDictEntry>(
      `
      WITH english_matches AS (
        SELECT DISTINCT
          w.*,
          CASE
            WHEN LOWER(m.meaning) = ? THEN ${MATCH_RANK.EXACT}
            WHEN LOWER(m.meaning) LIKE ? THEN ${MATCH_RANK.PREFIX}
            ELSE ${MATCH_RANK.CONTAINS}
          END AS match_rank,
          length(w.word) AS word_length
        FROM words w
        JOIN meanings m ON w.id = m.word_id
        WHERE LOWER(m.meaning) LIKE ?
      ),
      deduped AS (
        SELECT
          w.*,
          m.match_rank,
          m.word_length,
          ROW_NUMBER() OVER (
            PARTITION BY w.word, w.reading
            ORDER BY m.match_rank, m.word_length, w.position
          ) AS row_num
        FROM words w
        JOIN english_matches m ON w.id = m.id
      )
      SELECT * FROM deduped
      WHERE row_num = 1
      ORDER BY match_rank, word_length, position
      LIMIT ?
      `,
      [normalizedQuery, `${normalizedQuery}%`, containsPattern, limit]
    )
  );
}

/**
 * Executes tiered fallback searches for Japanese queries using exact, prefix, and contains logic.
 * @param db - SQLite database connection instance
 * @param processedQuery - Search query with script variations
 * @param limit - Maximum number of results to return
 * @returns Array of dictionary entries ordered by match tier and sub-ranking
 */
async function searchByTiers(
  db: SQLiteDatabase,
  processedQuery: SearchQuery,
  limit: number
): Promise<DBDictEntry[]> {
  // Build search conditions for all query variations
  const searchTerms: string[] = [];
  [
    processedQuery.original,
    processedQuery.hiragana,
    processedQuery.katakana,
    processedQuery.romaji,
  ].forEach((term) => {
    if (term && !searchTerms.includes(term)) {
      searchTerms.push(term);
    }
  });

  if (searchTerms.length === 0) return [];

  const termsCte = searchTerms
    .map((_, index) => (index === 0 ? "SELECT ? AS term" : "SELECT ?"))
    .join(" UNION ALL ");

  const tieredQuery = `
    WITH search_terms(term) AS (
      ${termsCte}
    ),
    candidate_matches AS (
      SELECT
        w.id,
        w.word,
        w.reading,
        w.reading_hiragana,
        w.kanji,
        w.position,
        CASE
          WHEN w.word = st.term OR w.reading = st.term OR w.reading_hiragana = st.term OR w.kanji = st.term THEN ${MATCH_RANK.EXACT}
          WHEN w.word LIKE st.term || '%' OR w.reading LIKE st.term || '%' OR w.reading_hiragana LIKE st.term || '%' OR w.kanji LIKE st.term || '%' THEN ${MATCH_RANK.PREFIX}
          ELSE ${MATCH_RANK.CONTAINS}
        END AS match_rank,
        CASE
          WHEN w.reading_hiragana = st.term THEN ${SUB_RANK.EXACT.HIRAGANA}
          WHEN w.reading = st.term THEN ${SUB_RANK.EXACT.READING}
          WHEN w.word = st.term THEN ${SUB_RANK.EXACT.WORD}
          WHEN w.kanji = st.term THEN ${SUB_RANK.EXACT.KANJI}
          WHEN w.reading_hiragana LIKE st.term || '%' THEN ${SUB_RANK.PREFIX.HIRAGANA}
          WHEN w.reading LIKE st.term || '%' THEN ${SUB_RANK.PREFIX.READING}
          WHEN w.word LIKE st.term || '%' THEN ${SUB_RANK.PREFIX.WORD}
          WHEN w.kanji LIKE st.term || '%' THEN ${SUB_RANK.PREFIX.KANJI}
          WHEN w.reading_hiragana LIKE '%' || st.term || '%' THEN ${SUB_RANK.CONTAINS.HIRAGANA}
          WHEN w.reading LIKE '%' || st.term || '%' THEN ${SUB_RANK.CONTAINS.READING}
          WHEN w.word LIKE '%' || st.term || '%' THEN ${SUB_RANK.CONTAINS.WORD}
          WHEN w.kanji LIKE '%' || st.term || '%' THEN ${SUB_RANK.CONTAINS.KANJI}
          ELSE ${SUB_RANK.DEFAULT}
        END AS sub_rank,
        length(w.word) AS word_length
      FROM words w
      JOIN search_terms st
      WHERE
        w.word = st.term OR w.reading = st.term OR w.reading_hiragana = st.term OR w.kanji = st.term OR
        w.word LIKE st.term || '%' OR w.reading LIKE st.term || '%' OR w.reading_hiragana LIKE st.term || '%' OR w.kanji LIKE st.term || '%' OR
        w.word LIKE '%' || st.term || '%' OR w.reading LIKE '%' || st.term || '%' OR w.reading_hiragana LIKE '%' || st.term || '%' OR w.kanji LIKE '%' || st.term || '%'
    ),
    deduped AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY id
          ORDER BY match_rank, sub_rank, word_length, position
        ) AS row_num
      FROM candidate_matches
    )
    SELECT id, word, reading, reading_hiragana, kanji, position
    FROM deduped
    WHERE row_num = 1
    ORDER BY match_rank, sub_rank, word_length, position
    LIMIT ?
  `;

  return await retryDatabaseOperation(() =>
    db.getAllAsync<DBDictEntry>(tieredQuery, [...searchTerms, limit])
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

    // Check for cancellation
    if (signal?.aborted) {
      throw new Error("Search cancelled");
    }

    const trimmedQuery = query.trim();
    const processedQuery = processSearchQuery(trimmedQuery);
    const cacheKey = buildSearchCacheKey(trimmedQuery, limit, withMeanings);

    if (signal?.aborted) {
      throw new Error("Search cancelled");
    }

    if (isQueryTooComplex(trimmedQuery)) {
      return createEmptyResult("Query is too long or complex to process");
    }

    const cached = getCachedSearchResult(cacheKey);
    if (cached) {
      return cached;
    }

    // For Latin text (no Japanese characters), try English search first, then Japanese as fallback
    const isLatinText =
      !wanakana.isJapanese(trimmedQuery) &&
      /^[a-zA-Z\s\-'.,!?]+$/.test(trimmedQuery);

    if (isLatinText) {
      if (signal?.aborted) throw new Error("Search cancelled");
      const englishResults = await searchByEnglish(db, trimmedQuery, limit);

      // If English search found results, return them
      if (englishResults.length > 0) {
        if (signal?.aborted) throw new Error("Search cancelled");
        const meanings = withMeanings
          ? await fetchMeanings(db, englishResults, signal)
          : new Map();
        const result = formatSearchResults(englishResults, meanings);
        if (!result.error) {
          setCachedSearchResult(cacheKey, result);
        }
        return result;
      }

      // If no English results, continue to Japanese search (treat as potential romaji)
    }

    // Fast path for single kanji
    if (isSingleKanjiCharacter(trimmedQuery)) {
      if (signal?.aborted) throw new Error("Search cancelled");
      const results = await searchBySingleKanji(db, trimmedQuery, { limit });
      if (signal?.aborted) throw new Error("Search cancelled");
      const meanings = withMeanings
        ? await fetchMeanings(db, results, signal)
        : new Map();
      const result = formatSearchResults(results, meanings);
      if (!result.error) {
        setCachedSearchResult(cacheKey, result);
      }
      return result;
    }

    // FTS first; if it doesn't fill the limit, backfill with tiered substring
    // search. FTS handles exact/prefix; tiered fills in CONTAINS-tier matches
    // that FTS can't reach because unicode61 tokenizes CJK runs as single
    // tokens (e.g. 月曜日 is one token, so "曜日" can't prefix-match it).
    if (signal?.aborted) throw new Error("Search cancelled");
    const ftsResults = await searchByFTS(db, processedQuery, { limit });

    let mergedResults: DBDictEntry[] = ftsResults;
    if (ftsResults.length < limit) {
      if (signal?.aborted) throw new Error("Search cancelled");
      const tieredResults = await searchByTiers(db, processedQuery, limit);
      if (ftsResults.length === 0) {
        mergedResults = tieredResults;
      } else {
        const seenIds = new Set(ftsResults.map((w) => w.id));
        const additions = tieredResults.filter((w) => !seenIds.has(w.id));
        mergedResults = [...ftsResults, ...additions].slice(0, limit);
      }
    }

    if (signal?.aborted) throw new Error("Search cancelled");
    const meanings = withMeanings
      ? await fetchMeanings(db, mergedResults, signal)
      : new Map();
    const result = formatSearchResults(mergedResults, meanings);
    if (!result.error) {
      setCachedSearchResult(cacheKey, result);
    }

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
