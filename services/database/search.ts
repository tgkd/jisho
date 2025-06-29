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
  
  if (words.length === 0) return meaningsMap;

  // Single batched query instead of N individual queries
  const wordIds = words.map(w => w.id);
  const placeholders = wordIds.map(() => '?').join(',');
  
  const meanings = await db.getAllAsync<DBWordMeaning>(
    `
    SELECT id, word_id, meaning, part_of_speech, field, misc, info
    FROM meanings
    WHERE word_id IN (${placeholders})
    ORDER BY word_id
    `,
    wordIds
  );

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
      CASE 
        WHEN reading_hiragana = ? THEN 1
        WHEN reading = ? THEN 2
        WHEN word = ? THEN 3
        WHEN kanji = ? THEN 4
        ELSE 5
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
      hiraganaQuery,
      hiraganaQuery,
      hiraganaQuery,
      hiraganaQuery,
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
      SELECT DISTINCT *, 1 as match_rank, length(word) as word_length,
        CASE 
          WHEN reading_hiragana = ? THEN 1
          WHEN reading = ? THEN 2
          WHEN word = ? THEN 3
          WHEN kanji = ? THEN 4
          ELSE 5
        END as sub_rank
      FROM words 
      WHERE word = ? OR reading = ? OR reading_hiragana = ? OR kanji = ?
    `);
    params.push(term, term, term, term, term, term, term, term);
  });

  // Tier 2: Prefix matches with sub-ranking
  searchTerms.forEach(term => {
    queries.push(`
      SELECT DISTINCT *, 2 as match_rank, length(word) as word_length,
        CASE 
          WHEN reading_hiragana LIKE ? THEN 1
          WHEN reading LIKE ? THEN 2
          WHEN word LIKE ? THEN 3
          WHEN kanji LIKE ? THEN 4
          ELSE 5
        END as sub_rank
      FROM words 
      WHERE (word LIKE ? OR reading LIKE ? OR reading_hiragana LIKE ? OR kanji LIKE ?)
      AND NOT (word = ? OR reading = ? OR reading_hiragana = ? OR kanji = ?)
    `);
    params.push(`${term}%`, `${term}%`, `${term}%`, `${term}%`, `${term}%`, `${term}%`, `${term}%`, `${term}%`, term, term, term, term);
  });

  // Tier 3: Contains matches with sub-ranking
  searchTerms.forEach(term => {
    queries.push(`
      SELECT DISTINCT *, 3 as match_rank, length(word) as word_length,
        CASE 
          WHEN reading_hiragana LIKE ? THEN 1
          WHEN reading LIKE ? THEN 2
          WHEN word LIKE ? THEN 3
          WHEN kanji LIKE ? THEN 4
          ELSE 5
        END as sub_rank
      FROM words 
      WHERE (word LIKE ? OR reading LIKE ? OR reading_hiragana LIKE ? OR kanji LIKE ?)
      AND NOT (word LIKE ? OR reading LIKE ? OR reading_hiragana LIKE ? OR kanji LIKE ?)
    `);
    params.push(`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `${term}%`, `${term}%`, `${term}%`, `${term}%`);
  });

  return await db.getAllAsync<DBDictEntry>(
    `
    SELECT id, word, reading, reading_hiragana, kanji, position
    FROM (${queries.join(' UNION ALL ')})
    GROUP BY id
    ORDER BY MIN(match_rank), MIN(sub_rank), MIN(word_length), position
    LIMIT ?
    `,
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

    // Try FTS first if available (but skip for short queries where reading matches are important)
    if (query.trim().length > 2) {
      const ftsResults = await searchByFTS(db, processedQuery, { limit });
      if (ftsResults.length > 0) {
        const meanings = withMeanings ? await fetchMeanings(db, ftsResults) : new Map();
        return formatSearchResults(ftsResults, meanings);
      }
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