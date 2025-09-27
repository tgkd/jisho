import type { SQLiteDatabase } from 'expo-sqlite';

export type FuriganaSegment = {
  ruby: string;
  rt?: string;
};

export type DBFuriganaEntry = {
  id: number;
  text: string;
  reading: string;
  reading_hiragana: string | null;
  segments: string;
  created_at: string;
};

export type FuriganaEntry = Omit<DBFuriganaEntry, 'reading_hiragana' | 'segments' | 'created_at'> & {
  readingHiragana: string | null;
  segments: FuriganaSegment[];
  createdAt: string;
};

/**
 * Get furigana data for a specific text
 */
export async function getFuriganaForText(
  db: SQLiteDatabase,
  text: string
): Promise<FuriganaEntry | null> {
  try {
    const result = await db.getFirstAsync<DBFuriganaEntry>(
      'SELECT * FROM furigana WHERE text = ?',
      [text]
    );

    if (!result) return null;

    return {
      id: result.id,
      text: result.text,
      reading: result.reading,
      readingHiragana: result.reading_hiragana,
      segments: JSON.parse(result.segments) as FuriganaSegment[],
      createdAt: result.created_at,
    };
  } catch (error) {
    console.error('Failed to get furigana for text:', error);
    return null;
  }
}

/**
 * Search for texts by reading
 */
export async function searchTextsByReading(
  db: SQLiteDatabase,
  reading: string,
  limit: number = 20
): Promise<FuriganaEntry[]> {
  try {
    const results = await db.getAllAsync<DBFuriganaEntry>(
      'SELECT * FROM furigana WHERE reading = ? OR reading_hiragana = ? LIMIT ?',
      [reading, reading, limit]
    );

    return results.map(result => ({
      id: result.id,
      text: result.text,
      reading: result.reading,
      readingHiragana: result.reading_hiragana,
      segments: JSON.parse(result.segments) as FuriganaSegment[],
      createdAt: result.created_at,
    }));
  } catch (error) {
    console.error('Failed to search texts by reading:', error);
    return [];
  }
}

/**
 * Get furigana data for multiple texts
 */
export async function getFuriganaForTexts(
  db: SQLiteDatabase,
  texts: string[]
): Promise<Map<string, FuriganaEntry>> {
  if (texts.length === 0) return new Map();

  try {
    const placeholders = texts.map(() => '?').join(',');
    const results = await db.getAllAsync<DBFuriganaEntry>(
      `SELECT * FROM furigana WHERE text IN (${placeholders})`,
      texts
    );

    const furiganaMap = new Map<string, FuriganaEntry>();

    for (const result of results) {
      furiganaMap.set(result.text, {
        id: result.id,
        text: result.text,
        reading: result.reading,
        readingHiragana: result.reading_hiragana,
        segments: JSON.parse(result.segments) as FuriganaSegment[],
        createdAt: result.created_at,
      });
    }

    return furiganaMap;
  } catch (error) {
    console.error('Failed to get furigana for texts:', error);
    return new Map();
  }
}

/**
 * Search furigana with partial reading match
 */
export async function searchFuriganaByPartialReading(
  db: SQLiteDatabase,
  partialReading: string,
  limit: number = 20
): Promise<FuriganaEntry[]> {
  try {
    const searchPattern = `%${partialReading}%`;
    const results = await db.getAllAsync<DBFuriganaEntry>(
      'SELECT * FROM furigana WHERE reading LIKE ? OR reading_hiragana LIKE ? LIMIT ?',
      [searchPattern, searchPattern, limit]
    );

    return results.map(result => ({
      id: result.id,
      text: result.text,
      reading: result.reading,
      readingHiragana: result.reading_hiragana,
      segments: JSON.parse(result.segments) as FuriganaSegment[],
      createdAt: result.created_at,
    }));
  } catch (error) {
    console.error('Failed to search furigana by partial reading:', error);
    return [];
  }
}