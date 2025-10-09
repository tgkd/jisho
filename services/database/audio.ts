import { Directory, File, Paths } from "expo-file-system";
import { SQLiteDatabase } from "expo-sqlite";
import { AudioFile, DBAudio } from "./types";

async function audioFileBlobToFileUrl(
  audioFile: AudioFile
): Promise<string | null> {
  try {
    const audioDir = new Directory(Paths.cache, "audio");
    await audioDir.create();

    const audioFile_file = new File(audioDir, `audio-${audioFile.id}.mp3`);

    if (!audioFile_file.exists) {
      await audioFile_file.write(audioFile.audioData, { encoding: "base64" });
    }

    return audioFile_file.uri;
  } catch (error) {
    console.error("Failed to convert audio file blob to URL:", error);
    return null;
  }
}

/**
 * Persist a remote text-to-speech result in the audio cache table.
 *
 * @param db Expo SQLite database instance.
 * @param wordId Identifier of the word associated with the audio.
 * @param exampleId Identifier of the example sentence associated with the audio.
 * @param audioBase64 Base64-encoded audio data without a data URI prefix.
 * @param options Optional metadata overrides, such as the originating file path.
 * @returns The database row identifier for the stored blob, or null if the insert fails.
 */
export async function saveAudioFile(
  db: SQLiteDatabase,
  wordId: number,
  exampleId: number,
  audioBase64: string,
  options?: { sourcePath?: string }
): Promise<number | null> {
  try {
    const resolvedPath =
      options?.sourcePath ?? `inline://${wordId}/${exampleId}/${Date.now()}`;

    const result = await db.runAsync(
      "INSERT INTO audio_blobs (file_path, word_id, example_id, audio_data, created_at) VALUES (?, ?, ?, ?, ?)",
      [resolvedPath, wordId, exampleId, audioBase64, new Date().toISOString()]
    );

    return result.lastInsertRowId;
  } catch (error) {
    console.error("Failed to save audio file:", error);
    return null;
  }
}

/**
 * Retrieve the most recently cached audio blob for a word/example pair.
 * Rehydrates the base64 payload into a temporary file so native audio players can consume it.
 *
 * @param db Expo SQLite database instance.
 * @param wordId Identifier of the word associated with the audio.
 * @param exampleId Identifier of the example sentence associated with the audio.
 * @returns Cached audio metadata including a playable file URI, or null when no cache entry exists.
 */
export async function getAudioFile(
  db: SQLiteDatabase,
  wordId: number,
  exampleId: number
): Promise<AudioFile | null> {
  try {
    const result = await db.getFirstAsync<DBAudio>(
      "SELECT id, file_path, audio_data FROM audio_blobs WHERE word_id = ? AND example_id = ? ORDER BY created_at DESC LIMIT 1",
      [wordId, exampleId]
    );

    if (result) {
      const filePath = await audioFileBlobToFileUrl({
        audioData: result.audio_data,
        id: result.id,
        filePath: result.file_path,
      });

      if (!filePath) {
        console.error("Failed to convert audio file blob to URL");
        return null;
      }

      return {
        filePath,
        id: result.id,
        audioData: result.audio_data,
      };
    }

    return null;
  } catch (error) {
    console.error("Failed to get audio file:", error);
    return null;
  }
}
