import { Directory, File, Paths } from "expo-file-system";
import { SQLiteDatabase } from "expo-sqlite";
import { AudioFile, DBAudio } from "./types";

async function audioFileBlobToFileUrl(
  audioFile: AudioFile
): Promise<string | null> {
  try {
    const audioDir = new Directory(Paths.cache, "audio");
    audioDir.create();

    const audioFile_file = new File(audioDir, `audio-${audioFile.id}.mp3`);

    if (!audioFile_file.exists) {
      audioFile_file.write(audioFile.audioData);
    }

    return audioFile_file.uri;
  } catch (error) {
    console.error("Failed to convert audio file blob to URL:", error);
    return null;
  }
}

export async function saveAudioFile(
  db: SQLiteDatabase,
  wordId: number,
  exampleId: number,
  filePath: string
): Promise<number | null> {
  try {
    const file = new File(filePath);
    const fileBlob = await file.text();

    const result = await db.runAsync(
      "INSERT INTO audio_blobs (file_path, word_id, example_id, audio_data, created_at) VALUES (?, ?, ?, ?, ?)",
      [filePath, wordId, exampleId, fileBlob, new Date().toISOString()]
    );

    return result.lastInsertRowId;
  } catch (error) {
    console.error("Failed to save audio file:", error);
    return null;
  }
}

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
