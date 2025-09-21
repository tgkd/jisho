import { SQLiteDatabase } from "expo-sqlite";

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 11;

  try {
    // Test if database is corrupted by trying a simple query
    try {
      await db.getFirstAsync("SELECT COUNT(*) FROM sqlite_master");
    } catch (corruptionError: any) {
      console.error("Database corruption detected:", corruptionError?.message);
      if (
        corruptionError?.message?.includes(
          "database disk image is malformed"
        ) ||
        corruptionError?.message?.includes("database is locked")
      ) {
        // Import File System to manually delete the corrupted database
        const FileSystem = await import("expo-file-system/legacy");
        const dbPath = db.databasePath;

        console.log("Deleting corrupted database at:", dbPath);

        // Close the database first
        try {
          await db.closeAsync();
        } catch {}

        // Delete the corrupted database file
        try {
          await FileSystem.deleteAsync(dbPath, { idempotent: true });
          await FileSystem.deleteAsync(dbPath + "-wal", { idempotent: true });
          await FileSystem.deleteAsync(dbPath + "-shm", { idempotent: true });
        } catch (deleteError) {
          console.error("Error deleting corrupted database:", deleteError);
        }

        // Force app restart by throwing an error that SQLiteProvider will handle
        throw new Error(
          "Database corrupted and deleted - restart required for fresh copy"
        );
      }
      throw corruptionError;
    }

    const versionResult = await db.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version"
    );
    let currentDbVersion = versionResult?.user_version ?? 0;

    console.log("DB: ", currentDbVersion, "TARGET: ", DATABASE_VERSION);

    if (currentDbVersion >= DATABASE_VERSION) {
      return;
    }

    if (currentDbVersion < 1) {
      await db.execAsync(`
        PRAGMA journal_mode = 'wal';

        CREATE TABLE IF NOT EXISTS words (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT,
          reading TEXT,
          reading_hiragana TEXT,
          kanji TEXT,
          position INTEGER
        );

        CREATE TABLE IF NOT EXISTS meanings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word_id INTEGER,
          meaning TEXT,
          part_of_speech TEXT,
          field TEXT,
          misc TEXT,
          info TEXT,
          FOREIGN KEY (word_id) REFERENCES words (id)
        );

        CREATE INDEX IF NOT EXISTS idx_word ON words(word);
        CREATE INDEX IF NOT EXISTS idx_reading ON words(reading);
        CREATE INDEX IF NOT EXISTS idx_position ON words(position);
        CREATE INDEX IF NOT EXISTS idx_kanji ON words(kanji);
      `);

      await db.execAsync(`PRAGMA user_version = 1`);
      currentDbVersion = 1;
    }

    if (currentDbVersion < 2) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS examples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          japanese_text TEXT,
          english_text TEXT,
          tokens TEXT,
          example_id TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_japanese_text ON examples(japanese_text);
      `);

      await db.execAsync(`PRAGMA user_version = 2`);
      currentDbVersion = 2;
    }

    // Version 3 was bookmarks table - removed as no longer needed

    if (currentDbVersion < 4) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS history (
          id INTEGER PRIMARY KEY NOT NULL,
          word_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (word_id) REFERENCES words (id)
        );`);

      await db.execAsync(`PRAGMA user_version = 4`);
      currentDbVersion = 4;
    }

    if (currentDbVersion < 5) {
      await db.execAsync(`
        ALTER TABLE examples ADD COLUMN word_id INTEGER;
        CREATE INDEX IF NOT EXISTS idx_example_word_id ON examples(word_id);
      `);

      await db.execAsync(`PRAGMA user_version = 5`);
      currentDbVersion = 5;
    }

    // Version 6 was chats table - removed as no longer needed

    if (currentDbVersion < 7) {
      try {
        await db.execAsync(`PRAGMA user_version = 7`);
        currentDbVersion = 7;
      } catch (error) {
        console.error("Error migrating to version 7:", error);
      }
    }

    if (currentDbVersion < 8) {
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS audio_blobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            word_id INTEGER NOT NULL,
            example_id INTEGER,
            audio_data BLOB NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (word_id) REFERENCES words (id),
            FOREIGN KEY (example_id) REFERENCES examples (id)
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_audio_word_id ON audio_blobs(word_id);
          CREATE INDEX IF NOT EXISTS idx_audio_example_id ON audio_blobs(example_id);
        `);

        await db.execAsync(`PRAGMA user_version = 8`);
        currentDbVersion = 8;
        console.log("Successfully migrated to version 8");
      } catch (error) {
        console.error("Error migrating to version 8:", error);
      }
    }

    if (currentDbVersion < 9) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS kanji (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character TEXT NOT NULL,
            jis_code INTEGER,
            unicode TEXT,
            on_readings TEXT,
            kun_readings TEXT,
            meanings TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
      await db.execAsync(`PRAGMA user_version = 9`);
      currentDbVersion = 9;
    }

    if (currentDbVersion < 10) {
      await db.execAsync(`

        CREATE VIRTUAL TABLE IF NOT EXISTS words_fts USING fts5(
          word,
          reading,
          reading_hiragana,
          kanji,
          content='words',
          content_rowid='id'
        );

        CREATE TRIGGER IF NOT EXISTS words_ai AFTER INSERT ON words BEGIN
          INSERT INTO words_fts(rowid, word, reading, reading_hiragana, kanji)
          VALUES (new.id, new.word, new.reading, new.reading_hiragana, new.kanji);
        END;

        CREATE TRIGGER IF NOT EXISTS words_ad AFTER DELETE ON words BEGIN
          INSERT INTO words_fts(words_fts, rowid, word, reading, reading_hiragana, kanji)
          VALUES('delete', old.id, old.word, old.reading, old.reading_hiragana, old.kanji);
        END;

        CREATE TRIGGER IF NOT EXISTS words_au AFTER UPDATE ON words BEGIN
          INSERT INTO words_fts(words_fts, rowid, word, reading, reading_hiragana, kanji)
          VALUES('delete', old.id, old.word, old.reading, old.reading_hiragana, old.kanji);
          INSERT INTO words_fts(rowid, word, reading, reading_hiragana, kanji)
          VALUES (new.id, new.word, new.reading, new.reading_hiragana, new.kanji);
        END;
        `);
      await db.execAsync(`PRAGMA user_version = 10`);
      currentDbVersion = 10;
    }

    if (currentDbVersion < 11) {
      await db.execAsync(`PRAGMA user_version = 11`);
      currentDbVersion = 11;
    }

    console.log(
      `Database migrations completed. Current version: ${currentDbVersion}`
    );
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}
