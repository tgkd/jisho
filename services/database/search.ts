import { SQLiteDatabase } from "expo-sqlite";
import * as wanakana from "wanakana";
import {
  DBDictEntry,
  DBWordMeaning, SearchDictionaryOptions,
  SearchDictionaryResult, SearchQuery, WordMeaning
} from "./types";
import {
  buildFtsMatchExpression, createEmptyResult,
  formatSearchResults, dbWordToDictEntry,
  isSingleKanjiCharacter, processSearchQuery
} from "./utils";

// Retry helper for database operations
async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 50
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      const isDatabaseLocked = error instanceof Error &&
        (error.message.includes('database is locked') ||
         error.message.includes('SQLITE_BUSY'));

      if (isLastAttempt || !isDatabaseLocked) {
        throw error;
      }

      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error('Retry limit exceeded');
}

// Helper type for raw word data from normalized tables
interface RawWordData {
  id: number;
  entry_id: number;
  frequency_score: number;
  kanji: string | null;
  reading: string | null;
  romaji: string | null;
}

// Convert normalized word data to legacy DBDictEntry format
function buildDictEntry(rawData: RawWordData): DBDictEntry {
  return {
    id: rawData.id,
    word: rawData.kanji || rawData.reading || '',
    reading: rawData.reading || '',
    reading_hiragana: rawData.reading || null,
    kanji: rawData.kanji,
    position: rawData.entry_id // Use entry_id as position for compatibility
  };
}

async function fetchMeanings(
  db: SQLiteDatabase,
  words: DBDictEntry[],
  signal?: AbortSignal
): Promise<Map<number, WordMeaning[]>> {
  const meaningsMap = new Map<number, WordMeaning[]>();

  if (words.length === 0) return meaningsMap;

  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Fetch cancelled');
  }

  // Single batched query using the new normalized schema
  const wordIds = words.map(w => w.id);
  const placeholders = wordIds.map(() => '?').join(',');

  const meanings = await retryDatabaseOperation(() =>
    db.getAllAsync<DBWordMeaning>(
    `
    SELECT
      ws.id,
      ws.word_id,
      wg.gloss as meaning,
      ws.parts_of_speech as part_of_speech,
      ws.field_tags as field,
      ws.misc_tags as misc,
      ws.info
    FROM word_senses ws
    JOIN word_glosses wg ON ws.id = wg.sense_id
    WHERE ws.word_id IN (${placeholders})
    ORDER BY ws.word_id, ws.sense_order, wg.gloss_order
    `,
    wordIds
    )
  );

  // Check for cancellation after query
  if (signal?.aborted) {
    throw new Error('Fetch cancelled');
  }

  // Group meanings by word_id and parse JSON fields
  meanings.forEach((m) => {
    if (!meaningsMap.has(m.word_id)) {
      meaningsMap.set(m.word_id, []);
    }

    // Parse JSON fields safely
    let partOfSpeech: string | null = null;
    try {
      const parsedPos = JSON.parse(m.part_of_speech || '[]');
      partOfSpeech = Array.isArray(parsedPos) && parsedPos.length > 0 ? parsedPos.join(', ') : null;
    } catch {
      partOfSpeech = m.part_of_speech;
    }

    let field: string | null = null;
    try {
      const parsedField = JSON.parse(m.field || '[]');
      field = Array.isArray(parsedField) && parsedField.length > 0 ? parsedField.join(', ') : null;
    } catch {
      field = m.field;
    }

    let misc: string | null = null;
    try {
      const parsedMisc = JSON.parse(m.misc || '[]');
      misc = Array.isArray(parsedMisc) && parsedMisc.length > 0 ? parsedMisc.join(', ') : null;
    } catch {
      misc = m.misc;
    }

    meaningsMap.get(m.word_id)!.push({
      id: m.id,
      meaning: m.meaning,
      field: field,
      misc: misc,
      info: m.info,
      wordId: m.word_id,
      partOfSpeech: partOfSpeech,
    });
  });

  return meaningsMap;
}

async function searchBySingleKanji(
  db: SQLiteDatabase,
  kanji: string,
  options: { limit: number }
): Promise<DBDictEntry[]> {
  const rawResults = await retryDatabaseOperation(() =>
    db.getAllAsync<RawWordData>(`
      WITH matched_words AS (
      SELECT DISTINCT
        w.id,
        w.entry_id,
        w.frequency_score,
        wk.kanji,
        wr.reading,
        wr.romaji,
        CASE
          WHEN COALESCE(wk.kanji, wr.reading) = ? THEN 1
          WHEN wk.kanji = ? THEN 2
          WHEN wk.kanji LIKE ? THEN 3
          ELSE 4
        END as match_rank,
        length(COALESCE(wk.kanji, wr.reading)) as word_length
      FROM words w
      LEFT JOIN word_kanji wk ON w.id = wk.word_id
      LEFT JOIN word_readings wr ON w.id = wr.word_id
      WHERE wk.kanji LIKE ? OR COALESCE(wk.kanji, wr.reading) = ?
    ),
    deduped AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(kanji, reading), reading
          ORDER BY match_rank, word_length
        ) as row_num
      FROM matched_words
    )
    SELECT id, entry_id, frequency_score, kanji, reading, romaji FROM deduped
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
    ])
  );

  return rawResults.map(buildDictEntry);
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

    const rawResults = await retryDatabaseOperation(() =>
      db.getAllAsync<RawWordData>(
        `
        WITH matches AS (
      SELECT DISTINCT
        w.id,
        w.entry_id,
        w.frequency_score,
        f.kanji,
        f.reading,
        '' as romaji,
        bm25(words_fts_jp) as rank
      FROM words_fts_jp f
      JOIN words w ON w.id = f.word_id
      WHERE f.words_fts_jp MATCH ?
      ORDER BY rank
    ),
    deduped AS (
      SELECT
        m.*,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(m.kanji, m.reading), m.reading
          ORDER BY
            CASE
              WHEN m.reading = ? OR m.reading = ? OR m.kanji = ? THEN 1
              WHEN m.reading LIKE ? OR m.kanji LIKE ? THEN 2
              ELSE m.rank + 3
            END,
            length(COALESCE(m.kanji, m.reading))
        ) as row_num
      FROM matches m
      WHERE length(COALESCE(m.kanji, m.reading)) >= ${Math.min(originalQuery.length, 2)}
    )
    SELECT id, entry_id, frequency_score, kanji, reading, romaji FROM deduped
    WHERE row_num = 1
    ORDER BY
      CASE
        WHEN reading = ? OR kanji = ? THEN 1
        WHEN reading LIKE ? OR kanji LIKE ? THEN 2
        ELSE rank + 3
      END,
      CASE
        WHEN reading = ? THEN 1
        WHEN reading = ? THEN 2
        WHEN COALESCE(kanji, reading) = ? THEN 3
        WHEN kanji = ? THEN 4
        ELSE 5
      END,
      length(COALESCE(kanji, reading))
    LIMIT ?
    `,
    [
      matchExpression,
      hiraganaQuery,
      hiraganaQuery,
      hiraganaQuery,
      `${hiraganaQuery}%`,
      `${hiraganaQuery}%`,
      hiraganaQuery,
      hiraganaQuery,
      `${hiraganaQuery}%`,
      `${hiraganaQuery}%`,
      hiraganaQuery,
      hiraganaQuery,
      hiraganaQuery,
      hiraganaQuery,
      options.limit
      ]
      )
    );

    return rawResults.map(buildDictEntry);
  } catch (error) {
    console.error("FTS search failed:", error);
    return [];
  }
}

async function searchByEnglish(
  db: SQLiteDatabase,
  query: string,
  limit: number
): Promise<DBDictEntry[]> {
  const normalizedQuery = query.toLowerCase().trim();

  if (normalizedQuery.length === 0) return [];

  const rawResults = await retryDatabaseOperation(() =>
    db.getAllAsync<RawWordData>(
    `
    WITH english_matches AS (
      SELECT DISTINCT
        w.id,
        w.entry_id,
        w.frequency_score,
        wk.kanji,
        wr.reading,
        wr.romaji,
        CASE
          WHEN LOWER(wg.gloss) = ? THEN 1
          WHEN LOWER(wg.gloss) LIKE ? THEN 2
          WHEN LOWER(wg.gloss) LIKE ? THEN 3
          ELSE 4
        END as match_rank,
        length(COALESCE(wk.kanji, wr.reading)) as word_length
      FROM words w
      LEFT JOIN word_kanji wk ON w.id = wk.word_id
      LEFT JOIN word_readings wr ON w.id = wr.word_id
      JOIN word_senses ws ON w.id = ws.word_id
      JOIN word_glosses wg ON ws.id = wg.sense_id
      WHERE LOWER(wg.gloss) LIKE ?
    ),
    deduped AS (
      SELECT
        m.*,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(m.kanji, m.reading), m.reading
          ORDER BY
            m.match_rank,
            m.word_length,
            m.entry_id
        ) as row_num
      FROM english_matches m
    )
    SELECT id, entry_id, frequency_score, kanji, reading, romaji FROM deduped
    WHERE row_num = 1
    ORDER BY
      match_rank,
      word_length,
      entry_id
    LIMIT ?
    `,
    [
      normalizedQuery,           // Exact match
      `${normalizedQuery}%`,     // Starts with
      `%${normalizedQuery}%`,    // Contains
      `%${normalizedQuery}%`,    // General filter
      limit
    ]
    )
  );

  return rawResults.map(buildDictEntry);
}

async function searchByTiers(
  db: SQLiteDatabase,
  processedQuery: SearchQuery,
  limit: number
): Promise<DBDictEntry[]> {
  // Build search conditions for all query variations
  const searchTerms: string[] = [];
  [processedQuery.original, processedQuery.hiragana, processedQuery.katakana, processedQuery.romaji].forEach(term => {
    if (term && !searchTerms.includes(term)) {
      searchTerms.push(term);
    }
  });

  if (searchTerms.length === 0) return [];

  // Use UNION ALL for better performance than complex CTE
  const queries: string[] = [];
  const params: string[] = [];

  // Tier 1: Exact matches with sub-ranking
  searchTerms.forEach(term => {
    queries.push(`
      SELECT DISTINCT
        w.id, w.entry_id, w.frequency_score, wk.kanji, wr.reading, wr.romaji,
        1 as match_rank,
        length(COALESCE(wk.kanji, wr.reading)) as word_length,
        CASE
          WHEN wr.reading = ? THEN 1
          WHEN wr.reading = ? THEN 2
          WHEN COALESCE(wk.kanji, wr.reading) = ? THEN 3
          WHEN wk.kanji = ? THEN 4
          ELSE 5
        END as sub_rank
      FROM words w
      LEFT JOIN word_kanji wk ON w.id = wk.word_id
      LEFT JOIN word_readings wr ON w.id = wr.word_id
      WHERE COALESCE(wk.kanji, wr.reading) = ? OR wr.reading = ? OR wk.kanji = ?
    `);
    params.push(term, term, term, term, term, term, term);
  });

  // Tier 2: Prefix matches with sub-ranking
  searchTerms.forEach(term => {
    queries.push(`
      SELECT DISTINCT
        w.id, w.entry_id, w.frequency_score, wk.kanji, wr.reading, wr.romaji,
        2 as match_rank,
        length(COALESCE(wk.kanji, wr.reading)) as word_length,
        CASE
          WHEN wr.reading LIKE ? THEN 1
          WHEN wr.reading LIKE ? THEN 2
          WHEN COALESCE(wk.kanji, wr.reading) LIKE ? THEN 3
          WHEN wk.kanji LIKE ? THEN 4
          ELSE 5
        END as sub_rank
      FROM words w
      LEFT JOIN word_kanji wk ON w.id = wk.word_id
      LEFT JOIN word_readings wr ON w.id = wr.word_id
      WHERE (COALESCE(wk.kanji, wr.reading) LIKE ? OR wr.reading LIKE ? OR wk.kanji LIKE ?)
      AND NOT (COALESCE(wk.kanji, wr.reading) = ? OR wr.reading = ? OR wk.kanji = ?)
    `);
    params.push(`${term}%`, `${term}%`, `${term}%`, `${term}%`, `${term}%`, `${term}%`, `${term}%`, term, term, term);
  });

  // Tier 3: Contains matches with sub-ranking
  searchTerms.forEach(term => {
    queries.push(`
      SELECT DISTINCT
        w.id, w.entry_id, w.frequency_score, wk.kanji, wr.reading, wr.romaji,
        3 as match_rank,
        length(COALESCE(wk.kanji, wr.reading)) as word_length,
        CASE
          WHEN wr.reading LIKE ? THEN 1
          WHEN wr.reading LIKE ? THEN 2
          WHEN COALESCE(wk.kanji, wr.reading) LIKE ? THEN 3
          WHEN wk.kanji LIKE ? THEN 4
          ELSE 5
        END as sub_rank
      FROM words w
      LEFT JOIN word_kanji wk ON w.id = wk.word_id
      LEFT JOIN word_readings wr ON w.id = wr.word_id
      WHERE (COALESCE(wk.kanji, wr.reading) LIKE ? OR wr.reading LIKE ? OR wk.kanji LIKE ?)
      AND NOT (COALESCE(wk.kanji, wr.reading) LIKE ? OR wr.reading LIKE ? OR wk.kanji LIKE ?)
    `);
    params.push(`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `${term}%`, `${term}%`, `${term}%`);
  });

  const rawResults = await retryDatabaseOperation(() =>
    db.getAllAsync<RawWordData>(
      `
      WITH combined AS (${queries.join(' UNION ALL ')})
      SELECT id, entry_id, frequency_score, kanji, reading, romaji
      FROM combined
      GROUP BY id
      ORDER BY MIN(match_rank), MIN(sub_rank), MIN(word_length), entry_id
      LIMIT ?
    `,
    [...params, limit]
    )
  );

  return rawResults.map(buildDictEntry);
}


export async function searchDictionary(
  db: SQLiteDatabase,
  query: string,
  options: SearchDictionaryOptions = {}
): Promise<SearchDictionaryResult> {
  const { withMeanings = true, limit = 50, minQueryLength = 1, signal } = options;

  try {
    if (!query || query.trim().length < minQueryLength) {
      return createEmptyResult(`Query must be at least ${minQueryLength} character(s) long`);
    }

    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Search cancelled');
    }

    const trimmedQuery = query.trim();
    const processedQuery = processSearchQuery(trimmedQuery);

    // Determine if this is an English query (no Japanese characters)
    const isEnglishQuery = !wanakana.isJapanese(trimmedQuery) &&
                          /^[a-zA-Z\s\-'.,!?]+$/.test(trimmedQuery);

    // For English queries, search by meaning first (JP -> EN order)
    if (isEnglishQuery) {
      if (signal?.aborted) throw new Error('Search cancelled');
      const englishResults = await searchByEnglish(db, trimmedQuery, limit);
      if (signal?.aborted) throw new Error('Search cancelled');
      const meanings = withMeanings ? await fetchMeanings(db, englishResults, signal) : new Map();
      return formatSearchResults(englishResults.map(dbWordToDictEntry), meanings);
    }

    // Fast path for single kanji
    if (isSingleKanjiCharacter(trimmedQuery)) {
      if (signal?.aborted) throw new Error('Search cancelled');
      const results = await searchBySingleKanji(db, trimmedQuery, { limit });
      if (signal?.aborted) throw new Error('Search cancelled');
      const meanings = withMeanings ? await fetchMeanings(db, results, signal) : new Map();
      return formatSearchResults(results.map(dbWordToDictEntry), meanings);
    }

    // Try FTS first if available (but skip for short queries where reading matches are important)
    if (trimmedQuery.length > 2) {
      if (signal?.aborted) throw new Error('Search cancelled');
      const ftsResults = await searchByFTS(db, processedQuery, { limit });
      if (ftsResults.length > 0) {
        if (signal?.aborted) throw new Error('Search cancelled');
        const meanings = withMeanings ? await fetchMeanings(db, ftsResults, signal) : new Map();
        return formatSearchResults(ftsResults.map(dbWordToDictEntry), meanings);
      }
    }

    // Use optimized tiered search
    if (signal?.aborted) throw new Error('Search cancelled');
    const results = await searchByTiers(db, processedQuery, limit);
    if (signal?.aborted) throw new Error('Search cancelled');
    const meanings = withMeanings ? await fetchMeanings(db, results, signal) : new Map();

    return formatSearchResults(results.map(dbWordToDictEntry), meanings);
  } catch (error) {
    if (error instanceof Error && (error.message === 'Search cancelled' || signal?.aborted)) {
      const abortError = new Error('Search cancelled');
      abortError.name = 'AbortError';
      throw abortError;
    }
    console.error("Search error:", error);
    return createEmptyResult("An error occurred while searching the dictionary");
  }
}
