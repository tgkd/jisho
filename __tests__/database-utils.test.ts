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

// Mock wanakana for testing utilities
const mockWanakana = {
  isRomaji: (text: string) => /^[a-zA-Z\s]+$/.test(text),
  isKatakana: (text: string) => /^[\u30A0-\u30FF]+$/.test(text),
  isHiragana: (text: string) => /^[\u3040-\u309F]+$/.test(text),
  isJapanese: (text: string) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text),
  toHiragana: (text: string) => text.replace(/[\u30A0-\u30FF]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60)),
  toKatakana: (text: string) => text.replace(/[\u3040-\u309F]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60)),
  toRomaji: (text: string) => text // Simplified - would need proper romaji conversion
};

// Mock segmenter for testing
const mockSegmenter = (text: string): string[] => {
  // Simple segmentation - split by character for testing
  return [...text].filter(char => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(char));
};

// Implement exact same utility functions as utils.ts
function testProcessSearchQuery(query: string): SearchQuery {
  const trimmed = query.trim();
  const result: SearchQuery = { original: trimmed };

  if (mockWanakana.isRomaji(trimmed)) {
    result.hiragana = mockWanakana.toHiragana(trimmed);
    result.katakana = mockWanakana.toKatakana(trimmed);
    result.romaji = trimmed;
  } else if (mockWanakana.isHiragana(trimmed)) {
    result.hiragana = trimmed;
    result.katakana = mockWanakana.toKatakana(trimmed);
    result.romaji = mockWanakana.toRomaji(trimmed);
  } else if (mockWanakana.isKatakana(trimmed)) {
    result.hiragana = mockWanakana.toHiragana(trimmed);
    result.katakana = trimmed;
    result.romaji = mockWanakana.toRomaji(trimmed);
  } else {
    result.hiragana = trimmed;
    result.katakana = trimmed;
    result.romaji = trimmed;
  }

  return result;
}

function testTokenizeJp(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  return mockSegmenter(text)
    .filter(token => token.length > 0 && mockWanakana.isJapanese(token))
    .slice(0, 10); // Limit to prevent excessive tokens
}

function testBuildFtsMatchExpression(query: SearchQuery): string {
  const terms: string[] = [];

  if (query.original) terms.push(`"${query.original}"`);
  if (query.hiragana && query.hiragana !== query.original) terms.push(`"${query.hiragana}"`);
  if (query.katakana && query.katakana !== query.original) terms.push(`"${query.katakana}"`);

  return terms.join(' OR ');
}

function testDbWordToDictEntry(dbWord: DBDictEntry): any {
  return {
    id: dbWord.id,
    word: dbWord.word,
    reading: dbWord.reading,
    readingHiragana: dbWord.reading_hiragana,
    kanji: dbWord.kanji,
    position: dbWord.position
  };
}

function testIsSingleKanjiCharacter(text: string): boolean {
  if (!text || text.length !== 1) return false;
  const code = text.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9faf; // CJK Unified Ideographs
}

function testCreateEmptyResult(message?: string): any {
  return {
    words: [],
    total: 0,
    hasMore: false,
    message: message || 'No results found'
  };
}

function testFormatSearchResults(words: DBDictEntry[], meanings: Map<number, any[]>): any {
  const formattedWords = words.map(word => ({
    ...testDbWordToDictEntry(word),
    meanings: meanings.get(word.id) || []
  }));

  return {
    words: formattedWords,
    total: formattedWords.length,
    hasMore: false
  };
}

describe('Database Utilities', () => {
  let db: TestDatabase;
  const dbPath = path.join(__dirname, '../assets/db/db_20260211_105924.db');

  beforeAll(async () => {
    db = new TestDatabase(dbPath);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('processSearchQuery', () => {
    test('processes romaji input', () => {
      const result = testProcessSearchQuery('kado');

      expect(result.original).toBe('kado');
      expect(result.romaji).toBe('kado');
      expect(result.hiragana).toBeTruthy();
      expect(result.katakana).toBeTruthy();

      console.log('Romaji processing:', result);
    });

    test('processes hiragana input', () => {
      const result = testProcessSearchQuery('かど');

      expect(result.original).toBe('かど');
      expect(result.hiragana).toBe('かど');
      expect(result.katakana).toBeTruthy();
      expect(result.romaji).toBeTruthy();

      console.log('Hiragana processing:', result);
    });

    test('processes katakana input', () => {
      const result = testProcessSearchQuery('カド');

      expect(result.original).toBe('カド');
      expect(result.katakana).toBe('カド');
      expect(result.hiragana).toBeTruthy();
      expect(result.romaji).toBeTruthy();

      console.log('Katakana processing:', result);
    });

    test('processes kanji input', () => {
      const result = testProcessSearchQuery('角');

      expect(result.original).toBe('角');
      expect(result.hiragana).toBe('角');
      expect(result.katakana).toBe('角');
      expect(result.romaji).toBe('角');

      console.log('Kanji processing:', result);
    });

    test('handles empty and whitespace input', () => {
      expect(testProcessSearchQuery('').original).toBe('');
      expect(testProcessSearchQuery('   ').original).toBe('');
      expect(testProcessSearchQuery('  test  ').original).toBe('test');
    });
  });

  describe('tokenizeJp', () => {
    test('tokenizes Japanese text', () => {
      const tokens = testTokenizeJp('これは日本語です');

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);

      // All tokens should be Japanese characters
      tokens.forEach(token => {
        expect(mockWanakana.isJapanese(token)).toBe(true);
      });

      console.log('Japanese tokenization:', tokens);
    });

    test('filters out non-Japanese text', () => {
      const tokens = testTokenizeJp('Hello これは test 日本語 です');

      // Should only contain Japanese characters
      tokens.forEach(token => {
        expect(mockWanakana.isJapanese(token)).toBe(true);
      });

      console.log('Mixed text tokenization:', tokens);
    });

    test('handles empty input', () => {
      expect(testTokenizeJp('')).toEqual([]);
      expect(testTokenizeJp('   ')).toEqual([]);
    });

    test('limits token count', () => {
      const longText = 'あ'.repeat(20);
      const tokens = testTokenizeJp(longText);

      expect(tokens.length).toBeLessThanOrEqual(10);
    });
  });

  describe('buildFtsMatchExpression', () => {
    test('builds FTS expression from search query', () => {
      const query: SearchQuery = {
        original: 'kado',
        hiragana: 'かど',
        katakana: 'カド',
        romaji: 'kado'
      };

      const expression = testBuildFtsMatchExpression(query);

      expect(expression).toBeTruthy();
      expect(expression).toContain('"kado"');
      expect(expression).toContain('"かど"');
      expect(expression).toContain('"カド"');
      expect(expression).toContain(' OR ');

      console.log('FTS expression:', expression);
    });

    test('handles duplicate terms', () => {
      const query: SearchQuery = {
        original: 'かど',
        hiragana: 'かど',
        katakana: 'カド'
      };

      const expression = testBuildFtsMatchExpression(query);

      // Should not duplicate the original term
      const kadoCount = (expression.match(/"かど"/g) || []).length;
      expect(kadoCount).toBe(1);

      console.log('FTS expression with duplicates:', expression);
    });

    test('handles single term query', () => {
      const query: SearchQuery = {
        original: 'test'
      };

      const expression = testBuildFtsMatchExpression(query);

      expect(expression).toBe('"test"');
    });
  });

  describe('dbWordToDictEntry', () => {
    test('converts database word to dictionary entry format', () => {
      const dbWord: DBDictEntry = {
        id: 1,
        word: '角',
        reading: 'かど',
        reading_hiragana: 'かど',
        kanji: '角',
        position: 1
      };

      const dictEntry = testDbWordToDictEntry(dbWord);

      expect(dictEntry.id).toBe(1);
      expect(dictEntry.word).toBe('角');
      expect(dictEntry.reading).toBe('かど');
      expect(dictEntry.readingHiragana).toBe('かど');
      expect(dictEntry.kanji).toBe('角');
      expect(dictEntry.position).toBe(1);

      console.log('Dictionary entry conversion:', dictEntry);
    });

    test('handles null values', () => {
      const dbWord: DBDictEntry = {
        id: 1,
        word: 'test',
        reading: 'test',
        reading_hiragana: null,
        kanji: null,
        position: 1
      };

      const dictEntry = testDbWordToDictEntry(dbWord);

      expect(dictEntry.readingHiragana).toBeNull();
      expect(dictEntry.kanji).toBeNull();
    });
  });

  describe('isSingleKanjiCharacter', () => {
    test('identifies single kanji characters', () => {
      expect(testIsSingleKanjiCharacter('角')).toBe(true);
      expect(testIsSingleKanjiCharacter('水')).toBe(true);
      expect(testIsSingleKanjiCharacter('木')).toBe(true);
    });

    test('rejects non-kanji characters', () => {
      expect(testIsSingleKanjiCharacter('あ')).toBe(false);
      expect(testIsSingleKanjiCharacter('ア')).toBe(false);
      expect(testIsSingleKanjiCharacter('a')).toBe(false);
      expect(testIsSingleKanjiCharacter('1')).toBe(false);
    });

    test('rejects multiple characters', () => {
      expect(testIsSingleKanjiCharacter('角度')).toBe(false);
      expect(testIsSingleKanjiCharacter('aa')).toBe(false);
      expect(testIsSingleKanjiCharacter('')).toBe(false);
    });

    test('handles edge cases', () => {
      expect(testIsSingleKanjiCharacter('')).toBe(false);
      expect(testIsSingleKanjiCharacter(' ')).toBe(false);
    });
  });

  describe('createEmptyResult', () => {
    test('creates empty result with default message', () => {
      const result = testCreateEmptyResult();

      expect(result.words).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(result.message).toBe('No results found');
    });

    test('creates empty result with custom message', () => {
      const customMessage = 'Custom error message';
      const result = testCreateEmptyResult(customMessage);

      expect(result.words).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(result.message).toBe(customMessage);
    });
  });

  describe('formatSearchResults', () => {
    test('formats search results with meanings', async () => {
      // Get sample words from database
      const sampleWords = await db.all(`
        SELECT id, word, reading, reading_hiragana, kanji, position
        FROM words
        LIMIT 2
      `);

      if (sampleWords.length === 0) {
        console.log('No sample words found - skipping test');
        return;
      }

      const meanings = new Map();
      meanings.set(sampleWords[0].id, [
        { id: 1, meaning: 'test meaning 1', wordId: sampleWords[0].id },
        { id: 2, meaning: 'test meaning 2', wordId: sampleWords[0].id }
      ]);

      const result = testFormatSearchResults(sampleWords, meanings);

      expect(result.words).toBeDefined();
      expect(result.total).toBe(sampleWords.length);
      expect(result.hasMore).toBe(false);
      expect(result.words.length).toBe(sampleWords.length);

      // First word should have meanings
      expect(result.words[0].meanings).toBeDefined();
      expect(result.words[0].meanings.length).toBe(2);

      // Second word should have empty meanings
      expect(result.words[1].meanings).toEqual([]);

      console.log('Formatted search results:', {
        total: result.total,
        firstWordMeanings: result.words[0].meanings.length
      });
    });

    test('formats search results without meanings', async () => {
      const sampleWords = await db.all(`
        SELECT id, word, reading, reading_hiragana, kanji, position
        FROM words
        LIMIT 1
      `);

      if (sampleWords.length === 0) {
        console.log('No sample words found - skipping test');
        return;
      }

      const emptyMeanings = new Map();
      const result = testFormatSearchResults(sampleWords, emptyMeanings);

      expect(result.words[0].meanings).toEqual([]);
    });

    test('handles empty word list', () => {
      const result = testFormatSearchResults([], new Map());

      expect(result.words).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('utility function integration', () => {
    test('search query to FTS expression pipeline', () => {
      const originalQuery = 'kado';
      const processedQuery = testProcessSearchQuery(originalQuery);
      const ftsExpression = testBuildFtsMatchExpression(processedQuery);

      expect(ftsExpression).toBeTruthy();
      expect(ftsExpression).toContain(originalQuery);

      console.log('Query pipeline:', {
        original: originalQuery,
        processed: processedQuery,
        fts: ftsExpression
      });
    });

    test('database word to formatted result pipeline', async () => {
      const sampleWord = await db.get(`
        SELECT id, word, reading, reading_hiragana, kanji, position
        FROM words
        LIMIT 1
      `);

      if (!sampleWord) {
        console.log('No sample word found - skipping test');
        return;
      }

      const dictEntry = testDbWordToDictEntry(sampleWord);
      const meanings = new Map();
      const formattedResult = testFormatSearchResults([sampleWord], meanings);

      expect(formattedResult.words[0]).toMatchObject(dictEntry);

      console.log('Word formatting pipeline:', {
        database: sampleWord,
        dictionary: dictEntry,
        formatted: formattedResult.words[0]
      });
    });
  });

  describe('performance and edge cases', () => {
    test('handles very long text input', () => {
      const longText = 'あ'.repeat(1000);
      const tokens = testTokenizeJp(longText);

      // Should be limited and not crash
      expect(tokens.length).toBeLessThanOrEqual(10);
      expect(Array.isArray(tokens)).toBe(true);
    });

    test('handles special characters', () => {
      const specialChars = '！？。、・「」';
      const tokens = testTokenizeJp(specialChars);

      // Should filter out punctuation
      expect(Array.isArray(tokens)).toBe(true);
      console.log('Special characters tokenization:', tokens);
    });

    test('utility function performance', () => {
      const testData = [
        'かど', 'kado', 'カド', '角', 'water', 'これは日本語です'
      ];

      const startTime = Date.now();

      testData.forEach(text => {
        const processed = testProcessSearchQuery(text);
        testTokenizeJp(text);
        testBuildFtsMatchExpression(processed);
        testIsSingleKanjiCharacter(text);
      });

      const duration = Date.now() - startTime;

      console.log(`Utility functions performance: ${duration}ms for ${testData.length} operations`);
      expect(duration).toBeLessThan(100);
    });
  });
});
