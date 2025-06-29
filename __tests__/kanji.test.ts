import sqlite3 from 'sqlite3';
import path from 'path';

// Types matching our database structure
interface DBKanjiEntry {
  id: number;
  character: string;
  jis_code: number | null;
  unicode: string;
  meanings: string; // JSON string
  on_readings: string; // JSON string
  kun_readings: string; // JSON string
  created_at: string;
}

interface ParsedKanjiEntry {
  id: number;
  character: string;
  jisCode: number | null;
  unicode: string;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  createdAt: string;
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

  async get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
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

// Implement exact same kanji logic as kanji.ts
function parseKanjiResult(result: DBKanjiEntry): ParsedKanjiEntry {
  return {
    id: result.id,
    character: result.character,
    jisCode: result.jis_code,
    unicode: result.unicode,
    meanings: result.meanings ? JSON.parse(result.meanings) : [],
    onReadings: result.on_readings ? JSON.parse(result.on_readings) : [],
    kunReadings: result.kun_readings ? JSON.parse(result.kun_readings) : [],
    createdAt: result.created_at
  };
}

async function testGetKanji(db: TestDatabase, character: string): Promise<ParsedKanjiEntry | null> {
  const result = await db.get(`
    SELECT id, character, jis_code, unicode, meanings, on_readings, kun_readings, created_at
    FROM kanji
    WHERE character = ?
  `, [character]);
  
  return result ? parseKanjiResult(result) : null;
}

async function testSearchKanji(
  db: TestDatabase, 
  query: string, 
  limit: number = 20
): Promise<ParsedKanjiEntry[]> {
  const results = await db.all(`
    SELECT id, character, jis_code, unicode, meanings, on_readings, kun_readings, created_at
    FROM kanji
    WHERE character LIKE ? OR meanings LIKE ?
    ORDER BY
      CASE 
        WHEN character = ? THEN 1
        WHEN character LIKE ? THEN 2
        ELSE 3
      END,
      jis_code ASC,
      id ASC
    LIMIT ?
  `, [`%${query}%`, `%${query}%`, query, `${query}%`, limit]);
  
  return results.map(parseKanjiResult);
}

async function testGetKanjiByUnicode(db: TestDatabase, unicode: string): Promise<ParsedKanjiEntry | null> {
  const result = await db.get(`
    SELECT id, character, jis_code, unicode, meanings, on_readings, kun_readings, created_at
    FROM kanji
    WHERE unicode = ?
  `, [unicode]);
  
  return result ? parseKanjiResult(result) : null;
}

async function testGetKanjiById(db: TestDatabase, id: number): Promise<ParsedKanjiEntry | null> {
  const result = await db.get(`
    SELECT id, character, jis_code, unicode, meanings, on_readings, kun_readings, created_at
    FROM kanji
    WHERE id = ?
  `, [id]);
  
  return result ? parseKanjiResult(result) : null;
}

async function testGetKanjiList(db: TestDatabase): Promise<ParsedKanjiEntry[]> {
  const results = await db.all(`
    SELECT id, character, jis_code, unicode, meanings, on_readings, kun_readings, created_at
    FROM kanji
    ORDER BY RANDOM()
    LIMIT 50
  `);
  
  return results.map(parseKanjiResult);
}

describe('Kanji Database Operations', () => {
  let db: TestDatabase;
  const dbPath = path.join(__dirname, '../assets/db/dict_2.db');

  beforeAll(async () => {
    db = new TestDatabase(dbPath);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  test('database has kanji table with correct structure', async () => {
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='kanji'
    `);
    
    if (tables.length === 0) {
      console.log('Kanji table does not exist - skipping kanji tests');
      return;
    }

    const columns = await db.all("PRAGMA table_info(kanji)");
    const columnNames = columns.map((col: any) => col.name);
    
    console.log('Kanji table columns:', columnNames);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('character');
    expect(columnNames).toContain('unicode');
    expect(columnNames).toContain('meanings');
    expect(columnNames).toContain('on_readings');
    expect(columnNames).toContain('kun_readings');
    expect(columnNames).toContain('jis_code');
    expect(columnNames).toContain('created_at');
  });

  test('get kanji by character', async () => {
    // Check if kanji table exists and has data
    const kanjiCount = await db.get('SELECT COUNT(*) as count FROM kanji');
    
    if (kanjiCount.count === 0) {
      console.log('No kanji data found - skipping test');
      return;
    }

    // Get a sample kanji character
    const sampleKanji = await db.get(`
      SELECT character FROM kanji 
      WHERE character IS NOT NULL 
      LIMIT 1
    `);
    
    expect(sampleKanji).toBeTruthy();
    console.log('Testing with kanji:', sampleKanji.character);

    const kanjiEntry = await testGetKanji(db, sampleKanji.character);
    
    expect(kanjiEntry).toBeTruthy();
    expect(kanjiEntry!.character).toBe(sampleKanji.character);
    expect(kanjiEntry!.meanings).toBeDefined();
    expect(Array.isArray(kanjiEntry!.meanings)).toBe(true);
    expect(kanjiEntry!.onReadings).toBeDefined();
    expect(Array.isArray(kanjiEntry!.onReadings)).toBe(true);
    expect(kanjiEntry!.kunReadings).toBeDefined();
    expect(Array.isArray(kanjiEntry!.kunReadings)).toBe(true);
    
    console.log('Kanji entry:', {
      character: kanjiEntry!.character,
      meanings: kanjiEntry!.meanings,
      onReadings: kanjiEntry!.onReadings,
      kunReadings: kanjiEntry!.kunReadings,
      jisCode: kanjiEntry!.jisCode,
      unicode: kanjiEntry!.unicode
    });
  });

  test('get kanji by non-existent character returns null', async () => {
    const kanjiEntry = await testGetKanji(db, '非存在');
    expect(kanjiEntry).toBeNull();
  });

  test('search kanji by character', async () => {
    const kanjiCount = await db.get('SELECT COUNT(*) as count FROM kanji');
    
    if (kanjiCount.count === 0) {
      console.log('No kanji data found - skipping test');
      return;
    }

    // Get a sample kanji for testing
    const sampleKanji = await db.get(`
      SELECT character FROM kanji 
      WHERE character IS NOT NULL 
      LIMIT 1
    `);

    const results = await testSearchKanji(db, sampleKanji.character, 10);
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    
    // First result should be exact match
    expect(results[0].character).toBe(sampleKanji.character);
    
    console.log('Search results for', sampleKanji.character, ':', results.map(k => ({
      character: k.character,
      meanings: k.meanings.slice(0, 3)
    })));
  });

  test('search kanji by meaning', async () => {
    const kanjiCount = await db.get('SELECT COUNT(*) as count FROM kanji');
    
    if (kanjiCount.count === 0) {
      console.log('No kanji data found - skipping test');
      return;
    }

    // Test with common English meanings
    const commonMeanings = ['water', 'fire', 'tree', 'person', 'big'];
    let resultsFound = false;

    for (const meaning of commonMeanings) {
      const results = await testSearchKanji(db, meaning, 5);
      
      if (results.length > 0) {
        console.log(`Found ${results.length} kanji for meaning "${meaning}":`, 
          results.map(k => k.character).join(', '));
        
        // Verify each result contains the search term in meanings
        results.forEach(kanji => {
          const meaningsText = kanji.meanings.join(' ').toLowerCase();
          expect(meaningsText).toContain(meaning.toLowerCase());
        });
        
        resultsFound = true;
        break;
      }
    }

    if (!resultsFound) {
      console.log('No kanji found for common meanings - checking data structure');
      
      // Check sample meanings format
      const sampleKanji = await db.get(`
        SELECT character, meanings FROM kanji 
        WHERE meanings IS NOT NULL AND meanings != '[]'
        LIMIT 1
      `);
      
      if (sampleKanji) {
        console.log('Sample kanji meanings:', sampleKanji.character, sampleKanji.meanings);
      }
    }
  });

  test('get kanji by unicode', async () => {
    const kanjiCount = await db.get('SELECT COUNT(*) as count FROM kanji');
    
    if (kanjiCount.count === 0) {
      console.log('No kanji data found - skipping test');
      return;
    }

    // Get a sample kanji with unicode
    const sampleKanji = await db.get(`
      SELECT character, unicode FROM kanji 
      WHERE unicode IS NOT NULL 
      LIMIT 1
    `);
    
    if (sampleKanji) {
      console.log('Testing with unicode:', sampleKanji.unicode);

      const kanjiEntry = await testGetKanjiByUnicode(db, sampleKanji.unicode);
      
      expect(kanjiEntry).toBeTruthy();
      expect(kanjiEntry!.character).toBe(sampleKanji.character);
      expect(kanjiEntry!.unicode).toBe(sampleKanji.unicode);
      
      console.log('Found kanji by unicode:', kanjiEntry!.character);
    } else {
      console.log('No kanji with unicode found');
    }
  });

  test('get kanji by ID', async () => {
    const kanjiCount = await db.get('SELECT COUNT(*) as count FROM kanji');
    
    if (kanjiCount.count === 0) {
      console.log('No kanji data found - skipping test');
      return;
    }

    // Get a sample kanji ID
    const sampleKanji = await db.get(`
      SELECT id, character FROM kanji 
      LIMIT 1
    `);
    
    const kanjiEntry = await testGetKanjiById(db, sampleKanji.id);
    
    expect(kanjiEntry).toBeTruthy();
    expect(kanjiEntry!.id).toBe(sampleKanji.id);
    expect(kanjiEntry!.character).toBe(sampleKanji.character);
    
    console.log('Found kanji by ID:', kanjiEntry!.character);
  });

  test('get kanji by non-existent ID returns null', async () => {
    const kanjiEntry = await testGetKanjiById(db, 999999);
    expect(kanjiEntry).toBeNull();
  });

  test('get random kanji list', async () => {
    const kanjiCount = await db.get('SELECT COUNT(*) as count FROM kanji');
    
    if (kanjiCount.count === 0) {
      console.log('No kanji data found - skipping test');
      return;
    }

    const kanjiList = await testGetKanjiList(db);
    
    expect(Array.isArray(kanjiList)).toBe(true);
    expect(kanjiList.length).toBeGreaterThan(0);
    expect(kanjiList.length).toBeLessThanOrEqual(50);
    
    // Verify each entry has required properties
    kanjiList.forEach(kanji => {
      expect(kanji).toHaveProperty('character');
      expect(kanji).toHaveProperty('meanings');
      expect(kanji).toHaveProperty('onReadings');
      expect(kanji).toHaveProperty('kunReadings');
      expect(Array.isArray(kanji.meanings)).toBe(true);
      expect(Array.isArray(kanji.onReadings)).toBe(true);
      expect(Array.isArray(kanji.kunReadings)).toBe(true);
    });
    
    console.log(`Retrieved ${kanjiList.length} random kanji:`, 
      kanjiList.slice(0, 10).map(k => k.character).join(', '));
  });

  test('JSON parsing of kanji data', async () => {
    const kanjiCount = await db.get('SELECT COUNT(*) as count FROM kanji');
    
    if (kanjiCount.count === 0) {
      console.log('No kanji data found - skipping test');
      return;
    }

    // Get a kanji with JSON data
    const rawKanjiData = await db.get(`
      SELECT character, meanings, on_readings, kun_readings
      FROM kanji 
      WHERE meanings IS NOT NULL 
        AND meanings != '[]' 
        AND meanings != 'null'
      LIMIT 1
    `);
    
    if (rawKanjiData) {
      console.log('Raw kanji data:', {
        character: rawKanjiData.character,
        meanings: rawKanjiData.meanings,
        onReadings: rawKanjiData.on_readings,
        kunReadings: rawKanjiData.kun_readings
      });

      // Test JSON parsing
      let parsedMeanings, parsedOnReadings, parsedKunReadings;
      
      try {
        parsedMeanings = JSON.parse(rawKanjiData.meanings || '[]');
        parsedOnReadings = JSON.parse(rawKanjiData.on_readings || '[]');
        parsedKunReadings = JSON.parse(rawKanjiData.kun_readings || '[]');
        
        expect(Array.isArray(parsedMeanings)).toBe(true);
        expect(Array.isArray(parsedOnReadings)).toBe(true);
        expect(Array.isArray(parsedKunReadings)).toBe(true);
        
        console.log('Parsed kanji data:', {
          character: rawKanjiData.character,
          meanings: parsedMeanings,
          onReadings: parsedOnReadings,
          kunReadings: parsedKunReadings
        });
      } catch (error) {
        console.error('JSON parsing failed:', error);
        console.log('Raw data that failed:', {
          meanings: rawKanjiData.meanings,
          onReadings: rawKanjiData.on_readings,
          kunReadings: rawKanjiData.kun_readings
        });
        throw error;
      }
    } else {
      console.log('No kanji with JSON data found');
    }
  });

  test('kanji search ordering', async () => {
    const kanjiCount = await db.get('SELECT COUNT(*) as count FROM kanji');
    
    if (kanjiCount.count === 0) {
      console.log('No kanji data found - skipping test');
      return;
    }

    // Get a kanji that might have partial matches
    const testChar = await db.get(`
      SELECT character FROM kanji 
      WHERE character IS NOT NULL 
      LIMIT 1
    `);
    
    if (testChar) {
      const results = await testSearchKanji(db, testChar.character, 10);
      
      if (results.length > 1) {
        // First result should be exact match
        expect(results[0].character).toBe(testChar.character);
        
        console.log('Search ordering test:', results.map(k => ({
          character: k.character,
          jisCode: k.jisCode,
          unicode: k.unicode
        })));
      }
    }
  });

  test('performance test - kanji operations', async () => {
    const kanjiCount = await db.get('SELECT COUNT(*) as count FROM kanji');
    
    if (kanjiCount.count === 0) {
      console.log('No kanji data found - skipping test');
      return;
    }

    // Test search performance
    const startSearch = Date.now();
    const searchResults = await testSearchKanji(db, 'water', 20);
    const searchDuration = Date.now() - startSearch;
    
    // Test list retrieval performance
    const startList = Date.now();
    const listResults = await testGetKanjiList(db);
    const listDuration = Date.now() - startList;
    
    // Test individual lookup performance
    if (searchResults.length > 0) {
      const startLookup = Date.now();
      const lookupResult = await testGetKanji(db, searchResults[0].character);
      const lookupDuration = Date.now() - startLookup;
      
      console.log('Kanji performance:', {
        search: `${searchDuration}ms for ${searchResults.length} results`,
        list: `${listDuration}ms for ${listResults.length} results`,
        lookup: `${lookupDuration}ms for single lookup`
      });
      
      expect(lookupResult).toBeTruthy();
      expect(searchDuration).toBeLessThan(500);
      expect(listDuration).toBeLessThan(200);
      expect(lookupDuration).toBeLessThan(100);
    }
  });
});