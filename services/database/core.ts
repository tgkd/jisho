import { SQLiteDatabase } from "expo-sqlite";

/**
 * Ensures all user-data tables exist regardless of user_version.
 * Handles the case where the bundled asset database has the correct
 * version number but is missing tables that were added via migrations
 * (asset DBs are built from schema.sql, not by running migrations).
 */
async function ensureUserDataTables(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY NOT NULL,
      entry_type TEXT DEFAULT 'word' NOT NULL,
      word_id INTEGER,
      kanji_id INTEGER,
      kanji_character TEXT,
      kanji_meaning TEXT,
      kanji_on_readings TEXT,
      kanji_kun_readings TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (word_id) REFERENCES words (id)
    );

    CREATE TABLE IF NOT EXISTS audio_blobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      word_id INTEGER,
      example_id INTEGER,
      audio_data BLOB NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (example_id) REFERENCES examples (id)
    );

    CREATE TABLE IF NOT EXISTS practice_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      title TEXT,
      content TEXT,
      content_output TEXT,
      content_text TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audio_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL UNIQUE,
      audio_data BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_history_entry_type ON history(entry_type);
    CREATE INDEX IF NOT EXISTS idx_history_kanji_id ON history(kanji_id);
    CREATE INDEX IF NOT EXISTS idx_audio_example_id ON audio_blobs(example_id);
    CREATE INDEX IF NOT EXISTS idx_practice_sessions_level ON practice_sessions(level);
    CREATE INDEX IF NOT EXISTS idx_practice_sessions_updated_at ON practice_sessions(updated_at);
    CREATE INDEX IF NOT EXISTS idx_audio_cache_text ON audio_cache(text);
  `);
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 20;

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
        const { File } = await import("expo-file-system");
        const dbPath = db.databasePath;

        console.log("Deleting corrupted database at:", dbPath);

        try {
          await db.closeAsync();
        } catch {}

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
      await ensureUserDataTables(db);
      return;
    }

    // --- Legacy migrations (v1–v20) removed ---
    // All users now receive jisho-seed.db (user_version=20) with
    // the full schema on first install. The DB name changed to the
    // stable "jisho.db", so no existing user can arrive here with
    // a version below 20. Future migrations start at v21+.

    await ensureUserDataTables(db);
    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);

    console.log(
      `Database migrations completed. Current version: ${DATABASE_VERSION}`
    );
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}
