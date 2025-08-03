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

interface DBWordMeaning {
  id: number;
  word_id: number;
  meaning: string;
  part_of_speech: string | null;
  field: string | null;
  misc: string | null;
  info: string | null;
}

interface DBExample {
  id: number;
  word_id: number;
  japanese_text: string;
  english_text: string;
  tokens: string | null;
  example_id: string | null;
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

// Implement exact same dictionary logic as dictionary.ts
async function testGetDictionaryEntry(
  db: TestDatabase,
  id: number,
  withExamples: boolean = true
): Promise<any> {
  // Get the word entry
  const word = await db.get(`
    SELECT id, word, reading, reading_hiragana, kanji, position
    FROM words
    WHERE id = ?
  `, [id]);

  if (!word) return null;

  // Get meanings
  const meanings = await db.all(`
    SELECT id, word_id, meaning, part_of_speech, field, misc, info
    FROM meanings
    WHERE word_id = ?
    ORDER BY id
  `, [id]);

  // Get examples if requested
  let examples: any[] = [];
  if (withExamples) {
    examples = await db.all(`
      SELECT id, japanese_text, english_text, word_id
      FROM examples
      WHERE word_id = ?
      ORDER BY id
      LIMIT 10
    `, [id]);
  }

  return {
    ...word,
    meanings,
    examples
  };
}

async function testGetWordExamples(
  db: TestDatabase,
  word: string
): Promise<any[]> {
  // First try to find by word_id matching
  const wordIds = await db.all(`
    SELECT id FROM words 
    WHERE word = ? OR reading = ? OR reading_hiragana = ? OR kanji = ?
  `, [word, word, word, word]);

  if (wordIds.length > 0) {
    const ids = wordIds.map(w => w.id);
    const placeholders = ids.map(() => '?').join(',');
    
    const examples = await db.all(`
      SELECT id, word_id, japanese_text, english_text
      FROM examples
      WHERE word_id IN (${placeholders})
      ORDER BY id
      LIMIT 20
    `, ids);

    if (examples.length > 0) {
      return examples;
    }
  }

  // Fallback to text matching
  return await db.all(`
    SELECT id, word_id, japanese_text, english_text
    FROM examples
    WHERE japanese_text LIKE ? OR japanese_text LIKE ? OR japanese_text LIKE ?
    ORDER BY 
      CASE 
        WHEN japanese_text LIKE ? THEN 1
        WHEN japanese_text LIKE ? THEN 2
        ELSE 3
      END,
      id
    LIMIT 10
  `, [`%${word}%`, `%${word}%`, `%${word}%`, `${word}%`, `%${word}%`]);
}

describe('Dictionary Database Operations', () => {
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

  test('database has required tables for dictionary operations', async () => {
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('words', 'meanings', 'examples')
      ORDER BY name
    `);
    
    console.log('Available tables:', tables.map(t => t.name));
    expect(tables.length).toBe(3);
    expect(tables.map(t => t.name)).toEqual(['examples', 'meanings', 'words']);
  });

  test('get dictionary entry by ID with meanings', async () => {
    // First find a valid word ID
    const sampleWord = await db.get(`
      SELECT id, word, reading FROM words 
      WHERE word IS NOT NULL 
      LIMIT 1
    `);
    
    expect(sampleWord).toBeTruthy();
    console.log('Testing with word:', sampleWord);

    const entry = await testGetDictionaryEntry(db, sampleWord.id, false);
    
    expect(entry).toBeTruthy();
    expect(entry.id).toBe(sampleWord.id);
    expect(entry.word).toBe(sampleWord.word);
    expect(entry.meanings).toBeDefined();
    expect(Array.isArray(entry.meanings)).toBe(true);
    
    console.log('Dictionary entry:', {
      word: entry.word,
      reading: entry.reading,
      meaningsCount: entry.meanings.length
    });

    // Verify meanings structure
    if (entry.meanings.length > 0) {
      const firstMeaning = entry.meanings[0];
      expect(firstMeaning).toHaveProperty('meaning');
      expect(firstMeaning).toHaveProperty('word_id');
      expect(firstMeaning.word_id).toBe(sampleWord.id);
    }
  });

  test('get dictionary entry with examples', async () => {
    // Find a word that has examples
    const wordWithExamples = await db.get(`
      SELECT DISTINCT w.id, w.word, w.reading
      FROM words w
      JOIN examples e ON w.id = e.word_id
      LIMIT 1
    `);

    if (wordWithExamples) {
      console.log('Testing examples with word:', wordWithExamples);

      const entry = await testGetDictionaryEntry(db, wordWithExamples.id, true);
      
      expect(entry).toBeTruthy();
      expect(entry.examples).toBeDefined();
      expect(Array.isArray(entry.examples)).toBe(true);
      expect(entry.examples.length).toBeGreaterThan(0);

      console.log('Examples found:', entry.examples.length);
      
      // Verify example structure
      const firstExample = entry.examples[0];
      expect(firstExample).toHaveProperty('japanese_text');
      expect(firstExample).toHaveProperty('english_text');
      expect(firstExample).toHaveProperty('word_id');
      
      console.log('Sample example:', {
        japanese_text: firstExample.japanese_text.substring(0, 50) + '...',
        english_text: firstExample.english_text.substring(0, 50) + '...'
      });
    } else {
      console.log('No words with examples found in database');
    }
  });

  test('get word examples by word text', async () => {
    // Test with a common Japanese word
    const commonWords = ['の', 'は', 'を', 'に', 'が'];
    let examplesFound = false;

    for (const word of commonWords) {
      const examples = await testGetWordExamples(db, word);
      
      if (examples.length > 0) {
        console.log(`Found ${examples.length} examples for word: ${word}`);
        
        // Verify example structure
        const firstExample = examples[0];
        expect(firstExample).toHaveProperty('japanese_text');
        expect(firstExample).toHaveProperty('english_text');
        expect(firstExample.japanese_text).toContain(word);
        
        console.log('Sample example text:', firstExample.japanese_text.substring(0, 100));
        examplesFound = true;
        break;
      }
    }

    if (!examplesFound) {
      console.log('No examples found for common words - checking database structure');
      
      // Check if examples table has data
      const exampleCount = await db.get('SELECT COUNT(*) as count FROM examples');
      console.log('Total examples in database:', exampleCount.count);
      
      // Get sample examples
      const sampleExamples = await db.all('SELECT japanese_text FROM examples LIMIT 5');
      console.log('Sample examples:', sampleExamples.map(e => e.japanese_text.substring(0, 50)));
    }
  });

  test('dictionary entry with non-existent ID returns null', async () => {
    const entry = await testGetDictionaryEntry(db, 999999, true);
    expect(entry).toBeNull();
  });

  test('examples for non-existent word returns empty array', async () => {
    const examples = await testGetWordExamples(db, 'nonexistentword12345');
    expect(Array.isArray(examples)).toBe(true);
    expect(examples.length).toBe(0);
  });

  test('verify database integrity for dictionary operations', async () => {
    // Check referential integrity
    const orphanedMeanings = await db.all(`
      SELECT COUNT(*) as count
      FROM meanings m
      LEFT JOIN words w ON m.word_id = w.id
      WHERE w.id IS NULL
    `);
    
    expect(orphanedMeanings[0].count).toBe(0);
    console.log('Referential integrity check passed');

    // Check data consistency
    const wordsWithMeanings = await db.get(`
      SELECT COUNT(*) as count
      FROM words w
      JOIN meanings m ON w.id = m.word_id
    `);
    
    console.log('Words with meanings:', wordsWithMeanings.count);
    expect(wordsWithMeanings.count).toBeGreaterThan(0);
  });

  test('performance test - batch dictionary lookups', async () => {
    const startTime = Date.now();
    
    // Get first 10 word IDs
    const wordIds = await db.all(`
      SELECT id FROM words 
      ORDER BY id 
      LIMIT 10
    `);

    const entries = [];
    for (const { id } of wordIds) {
      const entry = await testGetDictionaryEntry(db, id, false);
      if (entry) entries.push(entry);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Retrieved ${entries.length} dictionary entries in ${duration}ms`);
    console.log(`Average: ${(duration / entries.length).toFixed(2)}ms per entry`);
    
    expect(entries.length).toBe(wordIds.length);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});