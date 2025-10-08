import { SQLiteDatabase } from "expo-sqlite";

export interface AudioCache {
  id: number;
  text: string;
  audio_data: Uint8Array;
  created_at: number;
}

export async function getCachedAudio(
  db: SQLiteDatabase,
  text: string
): Promise<Uint8Array | null> {
  const query = `
    SELECT audio_data
    FROM audio_cache
    WHERE text = ?
  `;

  const result = await db.getFirstAsync<{ audio_data: Uint8Array }>(query, [
    text,
  ]);
  return result?.audio_data || null;
}

export async function saveAudioCache(
  db: SQLiteDatabase,
  text: string,
  audioData: Uint8Array
): Promise<void> {
  const query = `
    INSERT OR REPLACE INTO audio_cache (text, audio_data, created_at)
    VALUES (?, ?, ?)
  `;

  const createdAt = Date.now();
  await db.runAsync(query, text, audioData, createdAt);
}

export async function clearOldAudioCache(
  db: SQLiteDatabase,
  olderThanMs: number = 30 * 24 * 60 * 60 * 1000
): Promise<void> {
  const cutoffTime = Date.now() - olderThanMs;
  const query = `DELETE FROM audio_cache WHERE created_at < ?`;
  await db.runAsync(query, [cutoffTime]);
}

export async function deleteAudioCache(
  db: SQLiteDatabase,
  text: string
): Promise<void> {
  const query = `DELETE FROM audio_cache WHERE text = ?`;
  await db.runAsync(query, [text]);
}
