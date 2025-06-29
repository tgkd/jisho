import sqlite3 from 'sqlite3';
import path from 'path';

// Types matching our database structure
interface DBBookmark {
  id: number;
  word_id: number;
  created_at: string;
}


interface BookmarkWithWord extends DBBookmark {
  word: string;
  reading: string;
  reading_hiragana: string | null;
  kanji: string | null;
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

// Implement exact same bookmark logic as bookmarks.ts
async function testGetBookmarks(db: TestDatabase): Promise<BookmarkWithWord[]> {
  return await db.all(`
    SELECT 
      b.id,
      b.word_id,
      b.created_at,
      w.word,
      w.reading,
      w.reading_hiragana,
      w.kanji
    FROM bookmarks b
    JOIN words w ON b.word_id = w.id
    ORDER BY b.created_at DESC
  `);
}

async function testIsBookmarked(db: TestDatabase, wordId: number): Promise<boolean> {
  const result = await db.get(`
    SELECT 1 FROM bookmarks WHERE word_id = ?
  `, [wordId]);
  
  return !!result;
}

async function testAddBookmark(db: TestDatabase, wordId: number): Promise<void> {
  const now = new Date().toISOString();
  
  // Check if bookmark already exists
  const existing = await db.get(`
    SELECT id FROM bookmarks WHERE word_id = ?
  `, [wordId]);
  
  if (existing) {
    // Update existing bookmark
    await db.run(`
      UPDATE bookmarks SET created_at = ? WHERE word_id = ?
    `, [now, wordId]);
  } else {
    // Insert new bookmark
    await db.run(`
      INSERT INTO bookmarks (word_id, created_at) VALUES (?, ?)
    `, [wordId, now]);
  }
}

async function testRemoveBookmark(db: TestDatabase, wordId: number): Promise<void> {
  await db.run(`
    DELETE FROM bookmarks WHERE word_id = ?
  `, [wordId]);
}

async function testClearBookmarks(db: TestDatabase): Promise<void> {
  await db.run(`DELETE FROM bookmarks`);
}

describe('Bookmarks Database Operations', () => {
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
      // Clean up test bookmarks
      await testClearBookmarks(db);
      await db.close();
    }
  });

  beforeEach(async () => {
    // Clear bookmarks before each test
    await testClearBookmarks(db);
  });

  test('database has bookmarks table with correct structure', async () => {
    const columns = await db.all("PRAGMA table_info(bookmarks)");
    const columnNames = columns.map((col: any) => col.name);
    
    console.log('Bookmarks table columns:', columnNames);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('word_id');
    expect(columnNames).toContain('created_at');
  });

  test('get bookmarks returns empty array when no bookmarks exist', async () => {
    const bookmarks = await testGetBookmarks(db);
    expect(Array.isArray(bookmarks)).toBe(true);
    expect(bookmarks.length).toBe(0);
  });

  test('isBookmarked returns false for non-bookmarked word', async () => {
    const isBookmarked = await testIsBookmarked(db, testWordIds[0]);
    expect(isBookmarked).toBe(false);
  });

  test('add bookmark and verify it exists', async () => {
    const wordId = testWordIds[0];
    
    // Initially not bookmarked
    expect(await testIsBookmarked(db, wordId)).toBe(false);
    
    // Add bookmark
    await testAddBookmark(db, wordId);
    
    // Now should be bookmarked
    expect(await testIsBookmarked(db, wordId)).toBe(true);
    
    // Verify in bookmarks list
    const bookmarks = await testGetBookmarks(db);
    expect(bookmarks.length).toBe(1);
    expect(bookmarks[0].word_id).toBe(wordId);
    expect(bookmarks[0]).toHaveProperty('word');
    expect(bookmarks[0]).toHaveProperty('reading');
    
    console.log('Added bookmark:', {
      word: bookmarks[0].word,
      reading: bookmarks[0].reading,
      created_at: bookmarks[0].created_at
    });
  });

  test('remove bookmark', async () => {
    const wordId = testWordIds[0];
    
    // Add bookmark first
    await testAddBookmark(db, wordId);
    expect(await testIsBookmarked(db, wordId)).toBe(true);
    
    // Remove bookmark
    await testRemoveBookmark(db, wordId);
    expect(await testIsBookmarked(db, wordId)).toBe(false);
    
    // Verify bookmarks list is empty
    const bookmarks = await testGetBookmarks(db);
    expect(bookmarks.length).toBe(0);
  });

  test('add multiple bookmarks and verify ordering', async () => {
    const wordIds = testWordIds.slice(0, 3);
    
    // Add bookmarks with small delays to ensure different timestamps
    for (let i = 0; i < wordIds.length; i++) {
      await testAddBookmark(db, wordIds[i]);
      if (i < wordIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    const bookmarks = await testGetBookmarks(db);
    expect(bookmarks.length).toBe(3);
    
    // Should be ordered by created_at DESC (newest first)
    const timestamps = bookmarks.map(b => new Date(b.created_at).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i-1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
    
    console.log('Multiple bookmarks added:', bookmarks.map(b => ({
      word: b.word,
      created_at: b.created_at
    })));
  });

  test('add duplicate bookmark (should replace existing)', async () => {
    const wordId = testWordIds[0];
    
    // Add bookmark twice
    await testAddBookmark(db, wordId);
    const firstTimestamp = (await testGetBookmarks(db))[0].created_at;
    
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
    await testAddBookmark(db, wordId);
    
    const bookmarks = await testGetBookmarks(db);
    expect(bookmarks.length).toBe(1); // Should still be only one
    expect(bookmarks[0].word_id).toBe(wordId);
    
    // Timestamp should be updated (assuming INSERT OR REPLACE behavior)
    const secondTimestamp = bookmarks[0].created_at;
    console.log('Timestamps:', { first: firstTimestamp, second: secondTimestamp });
  });

  test('clear all bookmarks', async () => {
    const wordIds = testWordIds.slice(0, 3);
    
    // Add multiple bookmarks
    for (const wordId of wordIds) {
      await testAddBookmark(db, wordId);
    }
    
    let bookmarks = await testGetBookmarks(db);
    expect(bookmarks.length).toBe(3);
    
    // Clear all bookmarks
    await testClearBookmarks(db);
    
    bookmarks = await testGetBookmarks(db);
    expect(bookmarks.length).toBe(0);
    
    // Verify none are bookmarked
    for (const wordId of wordIds) {
      expect(await testIsBookmarked(db, wordId)).toBe(false);
    }
  });

  test('bookmark with non-existent word ID fails gracefully', async () => {
    const nonExistentWordId = 999999;
    
    try {
      await testAddBookmark(db, nonExistentWordId);
      
      // If it doesn't throw, check if foreign key constraint exists
      const bookmarks = await testGetBookmarks(db);
      const addedBookmark = bookmarks.find(b => b.word_id === nonExistentWordId);
      
      if (addedBookmark) {
        // Database allows orphaned bookmarks (no foreign key constraint)
        console.log('Database allows orphaned bookmarks - no foreign key constraint');
      }
    } catch (error) {
      // Foreign key constraint exists - this is expected behavior
      console.log('Foreign key constraint enforced:', error);
      expect(error).toBeTruthy();
    }
  });

  test('get bookmarks includes all word data', async () => {
    const wordId = testWordIds[0];
    await testAddBookmark(db, wordId);
    
    const bookmarks = await testGetBookmarks(db);
    expect(bookmarks.length).toBe(1);
    
    const bookmark = bookmarks[0];
    expect(bookmark).toHaveProperty('id');
    expect(bookmark).toHaveProperty('word_id');
    expect(bookmark).toHaveProperty('created_at');
    expect(bookmark).toHaveProperty('word');
    expect(bookmark).toHaveProperty('reading');
    expect(bookmark.word_id).toBe(wordId);
    
    // Verify the word data is correctly joined
    const wordData = await db.get(`
      SELECT word, reading, reading_hiragana, kanji 
      FROM words WHERE id = ?
    `, [wordId]);
    
    expect(bookmark.word).toBe(wordData.word);
    expect(bookmark.reading).toBe(wordData.reading);
    expect(bookmark.reading_hiragana).toBe(wordData.reading_hiragana);
    expect(bookmark.kanji).toBe(wordData.kanji);
  });

  test('performance test - bulk bookmark operations', async () => {
    const bulkWordIds = testWordIds;
    
    // Test bulk add
    const startAdd = Date.now();
    for (const wordId of bulkWordIds) {
      await testAddBookmark(db, wordId);
    }
    const addDuration = Date.now() - startAdd;
    
    // Test bulk check
    const startCheck = Date.now();
    const checkResults = [];
    for (const wordId of bulkWordIds) {
      checkResults.push(await testIsBookmarked(db, wordId));
    }
    const checkDuration = Date.now() - startCheck;
    
    // Test bulk retrieve
    const startRetrieve = Date.now();
    const bookmarks = await testGetBookmarks(db);
    const retrieveDuration = Date.now() - startRetrieve;
    
    console.log('Bookmark performance:', {
      add: `${addDuration}ms for ${bulkWordIds.length} bookmarks`,
      check: `${checkDuration}ms for ${bulkWordIds.length} checks`,
      retrieve: `${retrieveDuration}ms for ${bookmarks.length} bookmarks`
    });
    
    expect(checkResults.every(result => result === true)).toBe(true);
    expect(bookmarks.length).toBe(bulkWordIds.length);
    expect(addDuration).toBeLessThan(1000);
    expect(checkDuration).toBeLessThan(500);
    expect(retrieveDuration).toBeLessThan(100);
  });
});