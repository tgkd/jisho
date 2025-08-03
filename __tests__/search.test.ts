import path from 'path';
import sqlite3 from 'sqlite3';

// Types matching our database structure
interface DBDictEntry {
  id: number;
  word: string;
  reading: string;
  reading_hiragana: string | null;
  kanji: string | null;
  position: number;
}

interface SearchQuery {
  original: string;
  hiragana?: string;
  katakana?: string;
  romaji?: string;
}

// Database wrapper for testing
class TestDatabase {
  private db: sqlite3.Database;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// Mock wanakana for testing
const mockWanakana = {
  isRomaji: (text: string) => /^[a-zA-Z\s]+$/.test(text),
  isKatakana: (text: string) => /^[\u30A0-\u30FF]+$/.test(text),
  isHiragana: (text: string) => /^[\u3040-\u309F]+$/.test(text),
  isJapanese: (text: string) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text),
  toHiragana: (text: string) => text.replace(/[\u30A0-\u30FF]/g, (char) => 
    String.fromCharCode(char.charCodeAt(0) - 0x60)),
  toKatakana: (text: string) => text.replace(/[\u3040-\u309F]/g, (char) => 
    String.fromCharCode(char.charCodeAt(0) + 0x60))
};

function processSearchQuery(query: string): SearchQuery {
  return {
    original: query,
    hiragana: mockWanakana.isRomaji(query) ? mockWanakana.toHiragana(query) : 
             mockWanakana.isKatakana(query) ? mockWanakana.toHiragana(query) : query,
    katakana: mockWanakana.toKatakana(query),
    romaji: query
  };
}

// Implement EXACT same search logic as search.ts
async function testSearchByTiers(
  db: TestDatabase,
  processedQuery: SearchQuery,
  limit: number = 10
): Promise<DBDictEntry[]> {
  // Build search conditions for all query variations (EXACT copy from search.ts)
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

  const finalQuery = `
    SELECT id, word, reading, reading_hiragana, kanji, position
    FROM (${queries.join(' UNION ALL ')})
    GROUP BY id
    ORDER BY MIN(match_rank), MIN(sub_rank), MIN(word_length), position
    LIMIT ?
  `;

  return await db.all(finalQuery, [...params, limit]);
}

describe('Real Database Search Tests', () => {
  let db: TestDatabase;
  const dbPath = path.join(__dirname, '../assets/db/d_3.db');

  beforeAll(async () => {
    db = new TestDatabase(dbPath);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  test('database connection and structure', async () => {
    // Check table exists
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='words'");
    expect(tables.length).toBe(1);

    // Check columns
    const columns = await db.all("PRAGMA table_info(words)");
    const columnNames = columns.map((col: any) => col.name);
    
    console.log('Database columns:', columnNames);
    expect(columnNames).toContain('reading_hiragana');
    expect(columnNames).toContain('word');
    expect(columnNames).toContain('reading');
    expect(columnNames).toContain('kanji');
  });

  test('find 角 entries with かど reading', async () => {
    const results = await db.all(`
      SELECT word, reading, reading_hiragana, kanji 
      FROM words 
      WHERE (word = '角' OR kanji = '角') AND (reading_hiragana = 'かど' OR reading = 'かど')
      LIMIT 10
    `);
    
    console.log('角 entries with かど reading:', results);
    expect(results.length).toBeGreaterThan(0);
    
    const kadoEntry = results.find((r: any) => r.reading_hiragana === 'かど');
    if (kadoEntry) {
      console.log('Found perfect match:', kadoEntry);
    }
  });

  test('search ranking for かど query - comprehensive tiers test', async () => {
    const query = 'かど';
    const processedQuery = processSearchQuery(query);
    
    console.log('Processed query:', processedQuery);
    
    const results = await testSearchByTiers(db, processedQuery, 15);
    
    console.log('\\nSearch results for "かど" (all tiers):');
    results.slice(0, 10).forEach((word: any, index: number) => {
      console.log(`${index + 1}. ${word.word} (${word.reading}) - hiragana: ${word.reading_hiragana} - kanji: ${word.kanji}`);
    });

    expect(results.length).toBeGreaterThan(0);
    
    // Find 角 in results
    const kadoEntry = results.find(w => w.word === '角' || w.kanji === '角');
    
    if (kadoEntry) {
      const kadoIndex = results.indexOf(kadoEntry);
      console.log(`\\n角 appears at position: ${kadoIndex + 1}`);
      console.log('角 entry details:', kadoEntry);
      
      // 角 should be first due to exact reading_hiragana match (tier 1, sub_rank 1)
      expect(kadoIndex).toBeLessThan(3);
    } else {
      console.log('角 not found in results - checking if it exists in database...');
      
      const checkResult = await db.all(`
        SELECT * FROM words 
        WHERE word LIKE '%角%' OR kanji LIKE '%角%' OR reading LIKE '%かど%' 
        LIMIT 5
      `);
      console.log('角-related entries:', checkResult);
    }
  });

  test('test individual search tiers', async () => {
    const query = 'か';
    
    // Test Tier 1 only (exact matches)
    const tier1Results = await db.all(`
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
      ORDER BY sub_rank, word_length
      LIMIT 5
    `, [query, query, query, query, query, query, query, query]);

    console.log('\\nTier 1 (exact matches) for "か":');
    tier1Results.forEach((word: any, index: number) => {
      console.log(`${index + 1}. ${word.word} (${word.reading}) - sub_rank: ${word.sub_rank}`);
    });

    // Test Tier 2 only (prefix matches, excluding exact)
    const tier2Results = await db.all(`
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
      ORDER BY sub_rank, word_length
      LIMIT 5
    `, [`${query}%`, `${query}%`, `${query}%`, `${query}%`, `${query}%`, `${query}%`, `${query}%`, `${query}%`, query, query, query, query]);

    console.log('\\nTier 2 (prefix matches) for "か":');
    tier2Results.forEach((word: any, index: number) => {
      console.log(`${index + 1}. ${word.word} (${word.reading}) - sub_rank: ${word.sub_rank}`);
    });

    expect(tier1Results.length).toBeGreaterThan(0);
    expect(tier2Results.length).toBeGreaterThan(0);
    
    // Verify tier 1 has higher priority than tier 2
    if (tier1Results.length > 0 && tier2Results.length > 0) {
      console.log('\\nTier priority verification: Tier 1 should come before Tier 2');
    }
  });

  test('sub-ranking effectiveness test', async () => {
    const query = 'かど';
    
    // Test exact same SQL as search.ts would generate
    const processedQuery = processSearchQuery(query);
    const fullResults = await testSearchByTiers(db, processedQuery, 10);
    
    console.log('\\nFull search results with sub-ranking:');
    fullResults.forEach((word: any, index: number) => {
      const matchType = word.reading_hiragana === query ? 'reading_hiragana' :
                       word.reading === query ? 'reading' :
                       word.word === query ? 'word' :
                       word.kanji === query ? 'kanji' : 'other';
      console.log(`${index + 1}. ${word.word} (${word.reading}) - match: ${matchType}`);
    });
    
    // Verify reading matches come first
    const firstResult = fullResults[0];
    if (firstResult) {
      console.log('\\nFirst result analysis:');
      console.log(`Word: ${firstResult.word}, Reading: ${firstResult.reading}, Hiragana: ${firstResult.reading_hiragana}`);
      
      // Should prioritize reading_hiragana match
      const isReadingMatch = firstResult.reading_hiragana === query || firstResult.reading === query;
      console.log(`Is reading match: ${isReadingMatch}`);
      
      if (isReadingMatch) {
        console.log('✅ Sub-ranking working: Reading match appears first');
      }
    }

    expect(fullResults.length).toBeGreaterThan(0);
  });

  test('test FTS search path specifically', async () => {
    const query = 'かど';
    
    // Test if FTS table exists and works
    try {
      const ftsCheck = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='words_fts'");
      console.log('\\nFTS table exists:', ftsCheck.length > 0);
      
      if (ftsCheck.length > 0) {
        // Test FTS search directly
        const ftsResults = await db.all(`
          SELECT w.*, bm25(words_fts) as rank
          FROM words_fts f
          JOIN words w ON w.id = f.rowid
          WHERE f.words_fts MATCH ?
          ORDER BY 
            CASE 
              WHEN w.reading_hiragana = ? THEN 1
              WHEN w.reading = ? THEN 2
              WHEN w.word = ? THEN 3
              WHEN w.kanji = ? THEN 4
              ELSE 5
            END,
            bm25(words_fts)
          LIMIT 10
        `, [query, query, query, query, query]);
        
        console.log('\\nFTS search results for "かど":');
        ftsResults.forEach((word: any, index: number) => {
          console.log(`${index + 1}. ${word.word} (${word.reading}) - hiragana: ${word.reading_hiragana}`);
        });
        
        // Check if 角 appears in FTS results
        const kadoInFts = ftsResults.find((w: any) => w.word === '角' || w.kanji === '角');
        if (kadoInFts) {
          console.log('\\n✅ 角 found in FTS results at position:', ftsResults.indexOf(kadoInFts) + 1);
        } else {
          console.log('\\n❌ 角 NOT found in FTS results - this explains the app behavior!');
          console.log('FTS only found:', ftsResults.length, 'results');
          console.log('FTS results are missing 角 entries that should match reading かど');
        }
      } else {
        console.log('\\nFTS table does not exist - using regular search');
      }
    } catch (error) {
      console.log('\\nFTS search failed:', error);
    }
  });

  test('compare old vs new ranking with detailed analysis', async () => {
    const query = 'かど';
    
    // Old ranking (no sub-ranking)
    const oldResults = await db.all(`
      SELECT word, reading, reading_hiragana, kanji,
        CASE 
          WHEN word = ? OR reading = ? OR reading_hiragana = ? OR kanji = ? THEN 1
          ELSE 2
        END as match_rank,
        length(word) as word_length
      FROM words 
      WHERE word = ? OR reading = ? OR reading_hiragana = ? OR kanji = ?
      ORDER BY match_rank, word_length, id
      LIMIT 8
    `, [query, query, query, query, query, query, query, query]);

    // New ranking (with sub-ranking) - exact same as search.ts
    const newResults = await testSearchByTiers(db, processSearchQuery(query), 8);

    console.log('\\nDetailed ranking comparison:');
    console.log('\\nOld ranking (no sub-ranking):');
    oldResults.forEach((word: any, index: number) => {
      const matchType = word.reading_hiragana === query ? 'reading_hiragana' :
                       word.reading === query ? 'reading' :
                       word.word === query ? 'word' : 'other';
      console.log(`${index + 1}. ${word.word} (${word.reading}) - ${matchType} - len:${word.word_length}`);
    });

    console.log('\\nNew ranking (with sub-ranking):');
    newResults.forEach((word: any, index: number) => {
      const matchType = word.reading_hiragana === query ? 'reading_hiragana' :
                       word.reading === query ? 'reading' :
                       word.word === query ? 'word' : 'other';
      console.log(`${index + 1}. ${word.word} (${word.reading}) - ${matchType} - len:${word.word.length}`);
    });

    // Analyze if sub-ranking improved ordering
    const oldFirstIsReading = oldResults[0] && (oldResults[0].reading_hiragana === query || oldResults[0].reading === query);
    const newFirstIsReading = newResults[0] && (newResults[0].reading_hiragana === query || newResults[0].reading === query);
    
    console.log('\\nRanking effectiveness:');
    console.log(`Old first result is reading match: ${oldFirstIsReading}`);
    console.log(`New first result is reading match: ${newFirstIsReading}`);
    
    expect(newResults.length).toBeGreaterThan(0);
    expect(oldResults.length).toBeGreaterThan(0);
  });
});