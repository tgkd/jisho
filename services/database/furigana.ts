import type { SQLiteDatabase } from 'expo-sqlite';
import type { DBFuriganaEntry, FuriganaEntry, FuriganaSegment } from './types';
import { retryDatabaseOperation } from './utils';

/**
 * Get furigana data for a specific text
 */
export async function getFuriganaForText(
  db: SQLiteDatabase,
  text: string
): Promise<FuriganaEntry | null> {
  try {
    const result = await retryDatabaseOperation(() =>
      db.getFirstAsync<DBFuriganaEntry>(
        'SELECT * FROM furigana WHERE text = ?',
        [text]
      )
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
