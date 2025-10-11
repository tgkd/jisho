import { SQLiteDatabase } from "expo-sqlite";

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 18;

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
        const { File } = await import("expo-file-system");
        const dbPath = db.databasePath;

        console.log("Deleting corrupted database at:", dbPath);

        // Close the database first
        try {
          await db.closeAsync();
        } catch {}

        // Delete the corrupted database file
        try {
          const dbFile = new File(dbPath);
          const walFile = new File(dbPath + "-wal");
          const shmFile = new File(dbPath + "-shm");

          if (dbFile.exists) dbFile.delete();
          if (walFile.exists) walFile.delete();
          if (shmFile.exists) shmFile.delete();
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
          entry_type TEXT DEFAULT 'word' NOT NULL,
          word_id INTEGER,
          kanji_id INTEGER,
          kanji_character TEXT,
          kanji_meaning TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (word_id) REFERENCES words (id)
        );

        CREATE INDEX IF NOT EXISTS idx_history_entry_type ON history(entry_type);
        CREATE INDEX IF NOT EXISTS idx_history_kanji_id ON history(kanji_id);
      `);

      await db.execAsync(`PRAGMA user_version = 4`);
      currentDbVersion = 4;
    }

    if (currentDbVersion < 5) {
      const exampleColumns = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(examples)"
      );
      const hasWordIdColumn = exampleColumns?.some(
        (column) => column.name === "word_id"
      );

      if (!hasWordIdColumn) {
        await db.execAsync(`ALTER TABLE examples ADD COLUMN word_id INTEGER`);
      }

      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_example_word_id ON examples(word_id)`);

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

    if (currentDbVersion < 12) {
      try {
        // Update existing history table to support both word and kanji entries
        // For existing databases that already have the old history table structure

        // Create new history table with correct structure
        await db.execAsync(`
          CREATE TABLE history_new (
            id INTEGER PRIMARY KEY NOT NULL,
            entry_type TEXT DEFAULT 'word' NOT NULL,
            word_id INTEGER,
            kanji_id INTEGER,
            kanji_character TEXT,
            kanji_meaning TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (word_id) REFERENCES words (id)
          );
        `);

        // Copy existing word history data
        await db.execAsync(`
          INSERT INTO history_new (id, entry_type, word_id, created_at)
          SELECT id, 'word', word_id, created_at FROM history;
        `);

        // Drop old table and rename new one
        await db.execAsync(`DROP TABLE history;`);
        await db.execAsync(`ALTER TABLE history_new RENAME TO history;`);

        // Create indexes for performance
        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_history_entry_type ON history(entry_type);
          CREATE INDEX IF NOT EXISTS idx_history_kanji_id ON history(kanji_id);
        `);

        await db.execAsync(`PRAGMA user_version = 12`);
        currentDbVersion = 12;

        console.log("✅ History table successfully migrated to support kanji entries");
      } catch (error) {
        console.error("Error migrating to version 12:", error);
        throw error;
      }
    }

    if (currentDbVersion < 13) {
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS practice_passages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            translation TEXT,
            created_at INTEGER NOT NULL,
            UNIQUE(level, title)
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_practice_passages_level ON practice_passages(level);
          CREATE INDEX IF NOT EXISTS idx_practice_passages_created_at ON practice_passages(created_at);
        `);

        await db.execAsync(`PRAGMA user_version = 13`);
        currentDbVersion = 13;

        console.log("✅ Practice passages table created successfully");
      } catch (error) {
        console.error("Error migrating to version 13:", error);
        throw error;
      }
    }

    if (currentDbVersion < 14) {
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS audio_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL UNIQUE,
            audio_data BLOB NOT NULL,
            created_at INTEGER NOT NULL
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_audio_cache_text ON audio_cache(text);
        `);

        await db.execAsync(`PRAGMA user_version = 14`);
        currentDbVersion = 14;

        console.log("✅ Audio cache table created successfully");
      } catch (error) {
        console.error("Error migrating to version 14:", error);
        throw error;
      }
    }

    if (currentDbVersion < 15) {
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS practice_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL,
            title TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_practice_sessions_level ON practice_sessions(level);
          CREATE INDEX IF NOT EXISTS idx_practice_sessions_updated_at ON practice_sessions(updated_at);
        `);

        await db.execAsync(`PRAGMA user_version = 15`);
        currentDbVersion = 15;

        console.log("✅ Practice sessions table created successfully");
      } catch (error) {
        console.error("Error migrating to version 15:", error);
        throw error;
      }
    }

    if (currentDbVersion < 16) {
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS practice_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY (session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_practice_messages_session ON practice_messages(session_id);
        `);

        await db.execAsync(`PRAGMA user_version = 16`);
        currentDbVersion = 16;

        console.log("✅ Practice messages table created successfully");
      } catch (error) {
        console.error("Error migrating to version 16:", error);
        throw error;
      }
    }

    if (currentDbVersion < 17) {
      try {
        // Add kanji readings columns to history table
        const historyColumns = await db.getAllAsync<{ name: string }>(
          "PRAGMA table_info(history)"
        );

        const hasOnReadings = historyColumns?.some(
          (column) => column.name === "kanji_on_readings"
        );
        const hasKunReadings = historyColumns?.some(
          (column) => column.name === "kanji_kun_readings"
        );

        if (!hasOnReadings) {
          await db.execAsync(`ALTER TABLE history ADD COLUMN kanji_on_readings TEXT`);
          console.log("✅ Added kanji_on_readings column to history table");
        }

        if (!hasKunReadings) {
          await db.execAsync(`ALTER TABLE history ADD COLUMN kanji_kun_readings TEXT`);
          console.log("✅ Added kanji_kun_readings column to history table");
        }

        await db.execAsync(`PRAGMA user_version = 17`);
        currentDbVersion = 17;

        console.log("✅ History table successfully migrated to include kanji readings");
      } catch (error) {
        console.error("Error migrating to version 17:", error);
        throw error;
      }
    }

    if (currentDbVersion < 18) {
      try {
        await db.execAsync(`
          ALTER TABLE practice_sessions ADD COLUMN content TEXT;
        `);
        console.log("✅ Added content column to practice_sessions table");

        await db.execAsync(`
          DROP TABLE IF EXISTS practice_messages;
        `);
        console.log("✅ Dropped practice_messages table");

        await db.execAsync(`PRAGMA user_version = 18`);
        currentDbVersion = 18;

        console.log("✅ Practice sessions simplified successfully");
      } catch (error) {
        console.error("Error migrating to version 18:", error);
        throw error;
      }
    }

    console.log(
      `Database migrations completed. Current version: ${currentDbVersion}`
    );
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}
