import { SQLiteDatabase } from "expo-sqlite";
import * as wanakana from "wanakana";
import {
  DBDictEntry,
  DBWordMeaning,
  WordMeaning,
  SearchQuery,
  SearchDictionaryOptions,
  SearchDictionaryResult,
} from "./types";
import {
  processSearchQuery,
  tokenizeJp,
  createEmptyResult,
  formatSearchResults,
  isSingleKanjiCharacter,
  buildFtsMatchExpression,
} from "./utils";

async function searchByTokensDeduped(
  db: SQLiteDatabase,
  query: string,
  limit: number = 30
): Promise<DBDictEntry[]> {
  const tokens = tokenizeJp(query);
  if (tokens.length === 0) return [];

  const tokenWhereClauses: string[] = [];
  const tokenParams: string[] = [];

  // Add direct query match for the full input
  const queryVariations = [query];
  if (wanakana.isRomaji(query)) {
    queryVariations.push(wanakana.toHiragana(query));
    queryVariations.push(wanakana.toKatakana(query));
  } else if (wanakana.isHiragana(query)) {
    queryVariations.push(wanakana.toKatakana(query));
  } else if (wanakana.isKatakana(query)) {
    queryVariations.push(wanakana.toHiragana(query));
  } else if (wanakana.isJapanese(query)) {
    const hiragana = wanakana.toHiragana(query);
    const katakana = wanakana.toKatakana(query);
    if (hiragana !== query) queryVariations.push(hiragana);
    if (katakana !== query) queryVariations.push(katakana);
  }

  const fullQueryMatches = queryVariations.map(
    () => `(
    word LIKE ? OR
    reading LIKE ? OR
    reading_hiragana LIKE ? OR
    kanji LIKE ?
  )`
  );

  tokenWhereClauses.push(`(${fullQueryMatches.join(" OR ")})`);
  queryVariations.forEach((v) => {
    tokenParams.push(`%${v}%`, `%${v}%`, `%${v}%`, `%${v}%`);
  });

  for (const token of tokens) {
    if (token.length < 1) continue;

    const variations = [token];
    if (wanakana.isRomaji(token)) {
      variations.push(wanakana.toHiragana(token));
      variations.push(wanakana.toKatakana(token));
    } else if (wanakana.isHiragana(token)) {
      variations.push(wanakana.toKatakana(token));
    } else if (wanakana.isKatakana(token)) {
      variations.push(wanakana.toHiragana(token));
    }

    const tokenMatches = variations.map(
      () => `(
      word LIKE ? OR
      reading LIKE ? OR
      reading_hiragana LIKE ? OR
      kanji LIKE ?
    )`
    );

    tokenWhereClauses.push(`(${tokenMatches.join(" OR ")})`);

    variations.forEach((v) => {
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
    ),
    deduped AS (
      SELECT
        w.*,
        m.match_rank,
        m.word_length,
        ROW_NUMBER() OVER (
          PARTITION BY w.word, w.reading
          ORDER BY
            m.match_rank,
            m.word_length,
            w.position
        ) as row_num
      FROM words w
      JOIN matches m ON w.id = m.id
    )
    SELECT * FROM deduped
    WHERE row_num = 1
    ORDER BY
      match_rank,
      word_length,
      position
    LIMIT ?
    `,
    [
      query,
      query,
      query,
      query,
      `${query}%`,
      `${query}%`,
      `${query}%`,
      `${query}%`,
      ...tokenParams,
      limit,
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

async function searchBySingleKanji(
  db: SQLiteDatabase,
  kanji: string,
  options: { limit: number }
): Promise<DBDictEntry[]> {
  return db.getAllAsync<DBDictEntry>(`
    WITH matched_words AS (
      SELECT
        w.*,
        CASE
          WHEN w.word = ? THEN 1
          WHEN w.kanji = ? THEN 2
          WHEN w.kanji LIKE ? THEN 3
          ELSE 4
        END as match_rank,
        length(w.word) as word_length
      FROM words w
      WHERE w.kanji LIKE ? OR w.word = ?
    ),
    deduped AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY word, reading
          ORDER BY match_rank, word_length
        ) as row_num
      FROM matched_words
    )
    SELECT * FROM deduped
    WHERE row_num = 1
    ORDER BY match_rank, word_length
    LIMIT ?
  `, [
    kanji,
    kanji,
    `%${kanji}%`,
    `%${kanji}%`,
    kanji,
    options.limit
  ]);
}

async function searchByFTS(
  db: SQLiteDatabase,
  query: SearchQuery,
  options: { limit: number }
): Promise<DBDictEntry[]> {
  try {
    const matchExpression = buildFtsMatchExpression(query);
    const originalQuery = query.original;
    const hiraganaQuery = query.hiragana || originalQuery;

    return await db.getAllAsync<DBDictEntry>(
    `
    WITH matches AS (
      SELECT w.*, bm25(words_fts) as rank
      FROM words_fts f
      JOIN words w ON w.id = f.rowid
      WHERE f.words_fts MATCH ?
      ORDER BY rank
    ),
    deduped AS (
      SELECT
        w.*,
        m.rank,
        ROW_NUMBER() OVER (
          PARTITION BY w.word, w.reading
          ORDER BY
            CASE
              WHEN w.word = ? OR w.reading = ? OR w.reading_hiragana = ? OR w.kanji = ? THEN 1
              WHEN w.word LIKE ? OR w.reading LIKE ? OR w.reading_hiragana LIKE ? OR w.kanji LIKE ? THEN 2
              ELSE m.rank + 3
            END,
            length(w.word)
        ) as row_num
      FROM words w
      JOIN matches m ON w.id = m.id
      WHERE length(w.word) >= ${Math.min(originalQuery.length, 2)}
    )
    SELECT * FROM deduped
    WHERE row_num = 1
    ORDER BY
      CASE
        WHEN word = ? OR reading = ? OR reading_hiragana = ? OR kanji = ? THEN 1
        WHEN word LIKE ? OR reading LIKE ? OR reading_hiragana LIKE ? OR kanji LIKE ? THEN 2
        ELSE rank + 3
      END,
      length(word)
    LIMIT ?
    `,
    [
      matchExpression,
      hiraganaQuery,
      hiraganaQuery,
      hiraganaQuery,
      hiraganaQuery,
      `${hiraganaQuery}%`,
      `${hiraganaQuery}%`,
      `${hiraganaQuery}%`,
      `${hiraganaQuery}%`,
      hiraganaQuery,
      hiraganaQuery,
      hiraganaQuery,
      hiraganaQuery,
      `${hiraganaQuery}%`,
      `${hiraganaQuery}%`,
      `${hiraganaQuery}%`,
      `${hiraganaQuery}%`,
      options.limit
    ]
    );
  } catch (error) {
    console.error("FTS search failed:", error);
    return [];
  }
}

async function searchByTiers(
  db: SQLiteDatabase,
  processedQuery: SearchQuery,
  limit: number
): Promise<DBDictEntry[]> {
  const allResults: DBDictEntry[] = [];
  const seenIds = new Set<number>();

  // Tier 1: Exact matches (fastest - uses indexes)
  const exactResults = await searchExactMatches(db, processedQuery, Math.min(limit, 20));
  exactResults.forEach(result => {
    if (!seenIds.has(result.id)) {
      allResults.push(result);
      seenIds.add(result.id);
    }
  });

  // Tier 2: Prefix matches (fast - can use indexes)
  if (allResults.length < limit) {
    const prefixResults = await searchPrefixMatches(db, processedQuery, Math.min(limit - allResults.length, 30));
    prefixResults.forEach(result => {
      if (!seenIds.has(result.id)) {
        allResults.push(result);
        seenIds.add(result.id);
      }
    });
  }

  // Tier 3: Contains matches (slower)
  if (allResults.length < Math.min(limit, 10)) {
    const containsResults = await searchContainsMatches(db, processedQuery, Math.min(limit - allResults.length, 40));
    containsResults.forEach(result => {
      if (!seenIds.has(result.id)) {
        allResults.push(result);
        seenIds.add(result.id);
      }
    });
  }

  return allResults.slice(0, limit);
}

async function searchExactMatches(
  db: SQLiteDatabase,
  query: SearchQuery,
  limit: number
): Promise<DBDictEntry[]> {
  const conditions: string[] = [];
  const params: string[] = [];

  // Add exact match conditions
  [query.original, query.hiragana, query.katakana, query.romaji].forEach(term => {
    if (term) {
      conditions.push('word = ? OR reading = ? OR reading_hiragana = ? OR kanji = ?');
      params.push(term, term, term, term);
    }
  });

  if (conditions.length === 0) return [];

  return await db.getAllAsync<DBDictEntry>(
    `SELECT DISTINCT * FROM words WHERE ${conditions.join(' OR ')} ORDER BY position LIMIT ?`,
    [...params, limit]
  );
}

async function searchPrefixMatches(
  db: SQLiteDatabase,
  query: SearchQuery,
  limit: number
): Promise<DBDictEntry[]> {
  const conditions: string[] = [];
  const params: string[] = [];

  // Add prefix match conditions
  [query.original, query.hiragana, query.katakana].forEach(term => {
    if (term) {
      conditions.push('word LIKE ? OR reading LIKE ? OR reading_hiragana LIKE ? OR kanji LIKE ?');
      params.push(`${term}%`, `${term}%`, `${term}%`, `${term}%`);
    }
  });

  if (conditions.length === 0) return [];

  return await db.getAllAsync<DBDictEntry>(
    `SELECT DISTINCT * FROM words WHERE ${conditions.join(' OR ')} ORDER BY length(word), position LIMIT ?`,
    [...params, limit]
  );
}

async function searchContainsMatches(
  db: SQLiteDatabase,
  query: SearchQuery,
  limit: number
): Promise<DBDictEntry[]> {
  const conditions: string[] = [];
  const params: string[] = [];

  // Add contains match conditions  
  [query.original, query.hiragana, query.katakana].forEach(term => {
    if (term) {
      conditions.push('word LIKE ? OR reading LIKE ? OR reading_hiragana LIKE ? OR kanji LIKE ?');
      params.push(`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`);
    }
  });

  if (conditions.length === 0) return [];

  return await db.getAllAsync<DBDictEntry>(
    `SELECT DISTINCT * FROM words WHERE ${conditions.join(' OR ')} ORDER BY length(word), position LIMIT ?`,
    [...params, limit]
  );
}

export async function searchDictionary(
  db: SQLiteDatabase,
  query: string,
  options: SearchDictionaryOptions = {}
): Promise<SearchDictionaryResult> {
  const { withMeanings = true, limit = 50, minQueryLength = 1 } = options;

  try {
    if (!query || query.trim().length < minQueryLength) {
      return createEmptyResult(`Query must be at least ${minQueryLength} character(s) long`);
    }

    const processedQuery = processSearchQuery(query.trim());

    // Fast path for single kanji
    if (isSingleKanjiCharacter(query)) {
      const results = await searchBySingleKanji(db, query, { limit });
      const meanings = withMeanings ? await fetchMeanings(db, results) : new Map();
      return formatSearchResults(results, meanings);
    }

    // Try FTS first if available
    const ftsResults = await searchByFTS(db, processedQuery, { limit });
    if (ftsResults.length > 0) {
      const meanings = withMeanings ? await fetchMeanings(db, ftsResults) : new Map();
      return formatSearchResults(ftsResults, meanings);
    }

    // Use optimized tiered search
    const results = await searchByTiers(db, processedQuery, limit);
    const meanings = withMeanings ? await fetchMeanings(db, results) : new Map();

    return formatSearchResults(results, meanings);
  } catch (error) {
    console.error("Search error:", error);
    return createEmptyResult("An error occurred while searching the dictionary");
  }
}