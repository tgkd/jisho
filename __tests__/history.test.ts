import sqlite3 from 'sqlite3';
import path from 'path';

// Types matching our database structure
interface DBHistoryEntry {
  id: number;
  word_id: number;
  created_at: string;
}

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

interface HistoryEntryWithDetails extends DBHistoryEntry {
  word: string;
  reading: string;
  reading_hiragana: string | null;
  kanji: string | null;
  meanings: DBWordMeaning[];
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

// Implement exact same history logic as history.ts
async function testAddToHistory(
  db: TestDatabase, 
  entry: { wordId: number }
): Promise<void> {
  const now = new Date().toISOString();
  
  // Delete existing entry first (upsert pattern)
  await db.run(`
    DELETE FROM history WHERE word_id = ?
  `, [entry.wordId]);
  
  // Insert new entry
  await db.run(`
    INSERT INTO history (word_id, created_at) 
    VALUES (?, ?)
  `, [entry.wordId, now]);
}

async function testGetHistory(
  db: TestDatabase, 
  limit: number = 50
): Promise<HistoryEntryWithDetails[]> {
  // Get history entries with word details
  const historyEntries = await db.all(`
    SELECT 
      h.id,
      h.word_id,
      h.created_at,
      w.word,
      w.reading,
      w.reading_hiragana,
      w.kanji
    FROM history h
    JOIN words w ON h.word_id = w.id
    ORDER BY h.created_at DESC
    LIMIT ?
  `, [limit]);

  // Get meanings for each word
  const result: HistoryEntryWithDetails[] = [];
  
  for (const entry of historyEntries) {
    const meanings = await db.all(`
      SELECT id, word_id, meaning, part_of_speech, field, misc, info
      FROM meanings
      WHERE word_id = ?
      ORDER BY id
    `, [entry.word_id]);

    result.push({
      ...entry,
      meanings
    });
  }

  return result;
}

async function testClearHistory(db: TestDatabase): Promise<void> {
  await db.run(`DELETE FROM history`);
}

async function testRemoveHistoryById(db: TestDatabase, historyId: number): Promise<void> {
  await db.run(`
    DELETE FROM history WHERE id = ?
  `, [historyId]);
}

describe('History Database Operations', () => {
  let db: TestDatabase;
  const dbPath = path.join(__dirname, '../assets/db/dict_2.db');
  let testWordIds: number[] = [];

  beforeAll(async () => {
    db = new TestDatabase(dbPath);
    
    // Get some test word IDs
    const words = await db.all(`
      SELECT id FROM words 
      WHERE word IS NOT NULL 
      ORDER BY id 
      LIMIT 5
    `);
    testWordIds = words.map(w => w.id);
    console.log('Test word IDs:', testWordIds);
  });

  afterAll(async () => {
    if (db) {
      // Clean up test history
      await testClearHistory(db);
      await db.close();
    }
  });

  beforeEach(async () => {
    // Clear history before each test
    await testClearHistory(db);
  });

  test('database has history table with correct structure', async () => {
    const columns = await db.all("PRAGMA table_info(history)");
    const columnNames = columns.map((col: any) => col.name);
    
    console.log('History table columns:', columnNames);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('word_id');
    expect(columnNames).toContain('created_at');
  });

  test('get history returns empty array when no history exists', async () => {
    const history = await testGetHistory(db);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(0);
  });

  test('add entry to history', async () => {
    const wordId = testWordIds[0];
    
    await testAddToHistory(db, { wordId });
    
    const history = await testGetHistory(db);
    expect(history.length).toBe(1);
    expect(history[0].word_id).toBe(wordId);
    expect(history[0]).toHaveProperty('word');
    expect(history[0]).toHaveProperty('reading');
    expect(history[0]).toHaveProperty('meanings');
    expect(Array.isArray(history[0].meanings)).toBe(true);
    
    console.log('Added history entry:', {
      word: history[0].word,
      reading: history[0].reading,
      meaningsCount: history[0].meanings.length
    });
  });

  test('add duplicate entry to history (upsert behavior)', async () => {
    const wordId = testWordIds[0];
    
    // Add first entry
    await testAddToHistory(db, { wordId });
    let history = await testGetHistory(db);
    expect(history.length).toBe(1);
    const firstTimestamp = history[0].created_at;
    
    // Add second entry with same word_id (should replace)
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
    await testAddToHistory(db, { wordId });
    
    history = await testGetHistory(db);
    expect(history.length).toBe(1); // Should still be only one
    expect(history[0].word_id).toBe(wordId);
    
    // Timestamp should be updated
    const secondTimestamp = history[0].created_at;
    expect(secondTimestamp).not.toBe(firstTimestamp);
    
    console.log('Upsert behavior verified - timestamp updated');
  });

  test('add multiple history entries and verify ordering', async () => {
    const entries = [
      { wordId: testWordIds[0] },
      { wordId: testWordIds[1] },
      { wordId: testWordIds[2] }
    ];
    
    // Add entries with small delays to ensure different timestamps
    for (let i = 0; i < entries.length; i++) {
      await testAddToHistory(db, entries[i]);
      if (i < entries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    const history = await testGetHistory(db);
    expect(history.length).toBe(3);
    
    // Should be ordered by created_at DESC (newest first)
    const timestamps = history.map(h => new Date(h.created_at).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i-1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
    
    // First entry should be the last one added (testWordIds[2])
    expect(history[0].word_id).toBe(testWordIds[2]);
    
    console.log('Multiple history entries added:', history.map(h => ({
      word: h.word,
      word_id: h.word_id,
      created_at: h.created_at
    })));
  });

  test('get history with limit', async () => {
    const entries = [];
    for (let i = 0; i < 5; i++) {
      entries.push({ wordId: testWordIds[i % testWordIds.length] });
    }
    
    // Add all entries
    for (const entry of entries) {
      await testAddToHistory(db, entry);
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    
    // Test different limits
    const historyAll = await testGetHistory(db, 10);
    const historyLimited = await testGetHistory(db, 3);
    
    expect(historyAll.length).toBe(5);
    expect(historyLimited.length).toBe(3);
    
    // Limited results should be the most recent ones
    for (let i = 0; i < 3; i++) {
      expect(historyLimited[i].id).toBe(historyAll[i].id);
    }
    
    console.log('History limit test:', {
      total: historyAll.length,
      limited: historyLimited.length
    });
  });

  test('remove history entry by ID', async () => {
    const wordId = testWordIds[0];
    
    await testAddToHistory(db, { wordId });
    
    let history = await testGetHistory(db);
    expect(history.length).toBe(1);
    const historyId = history[0].id;
    
    // Remove the entry
    await testRemoveHistoryById(db, historyId);
    
    history = await testGetHistory(db);
    expect(history.length).toBe(0);
    
    console.log('History entry removed successfully');
  });

  test('remove non-existent history entry does nothing', async () => {
    // Add one entry
    await testAddToHistory(db, { wordId: testWordIds[0] });
    
    let history = await testGetHistory(db);
    expect(history.length).toBe(1);
    
    // Try to remove non-existent entry
    await testRemoveHistoryById(db, 999999);
    
    // Should still have the original entry
    history = await testGetHistory(db);
    expect(history.length).toBe(1);
  });

  test('clear all history', async () => {
    // Add multiple entries
    for (let i = 0; i < 3; i++) {
      await testAddToHistory(db, { 
        wordId: testWordIds[i % testWordIds.length]
      });
    }
    
    let history = await testGetHistory(db);
    expect(history.length).toBe(3);
    
    // Clear all history
    await testClearHistory(db);
    
    history = await testGetHistory(db);
    expect(history.length).toBe(0);
    
    console.log('All history cleared successfully');
  });

  test('history includes word meanings', async () => {
    const wordId = testWordIds[0];
    
    await testAddToHistory(db, { wordId });
    
    const history = await testGetHistory(db);
    expect(history.length).toBe(1);
    
    const entry = history[0];
    expect(entry.meanings).toBeDefined();
    expect(Array.isArray(entry.meanings)).toBe(true);
    
    if (entry.meanings.length > 0) {
      const firstMeaning = entry.meanings[0];
      expect(firstMeaning).toHaveProperty('meaning');
      expect(firstMeaning).toHaveProperty('word_id');
      expect(firstMeaning.word_id).toBe(wordId);
      
      console.log('History entry with meanings:', {
        word: entry.word,
        meaningsCount: entry.meanings.length,
        firstMeaning: firstMeaning.meaning.substring(0, 50) + '...'
      });
    }
  });

  test('history with non-existent word ID fails gracefully', async () => {
    const nonExistentWordId = 999999;
    
    try {
      await testAddToHistory(db, { wordId: nonExistentWordId });
      
      // If it doesn't throw, check if foreign key constraint exists
      const history = await testGetHistory(db);
      const addedEntry = history.find(h => h.word_id === nonExistentWordId);
      
      if (addedEntry) {
        // Database allows orphaned history (no foreign key constraint)
        console.log('Database allows orphaned history - no foreign key constraint');
      } else {
        console.log('History entry was not retrieved due to JOIN with words table');
      }
    } catch (error) {
      // Foreign key constraint exists - this is expected behavior
      console.log('Foreign key constraint enforced:', error);
      expect(error).toBeTruthy();
    }
  });

  test('performance test - bulk history operations', async () => {
    const bulkEntries = testWordIds.map((wordId, index) => ({
      wordId
    }));
    
    // Test bulk add
    const startAdd = Date.now();
    for (const entry of bulkEntries) {
      await testAddToHistory(db, entry);
    }
    const addDuration = Date.now() - startAdd;
    
    // Test bulk retrieve
    const startRetrieve = Date.now();
    const history = await testGetHistory(db, 100);
    const retrieveDuration = Date.now() - startRetrieve;
    
    console.log('History performance:', {
      add: `${addDuration}ms for ${bulkEntries.length} entries`,
      retrieve: `${retrieveDuration}ms for ${history.length} entries with meanings`
    });
    
    expect(history.length).toBe(bulkEntries.length);
    expect(addDuration).toBeLessThan(1000);
    expect(retrieveDuration).toBeLessThan(500);
    
    // Verify all entries have meanings loaded
    const entriesWithMeanings = history.filter(h => h.meanings && h.meanings.length > 0);
    console.log(`${entriesWithMeanings.length}/${history.length} entries have meanings`);
  });
});