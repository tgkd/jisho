import {
  deleteDatabaseAsync,
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  SQLiteDatabase
} from "expo-sqlite";

import { DATABASE_ASSET_ID } from "@/constants/Database";

const SEED_COPY_NAME = "_furigana_seed.db";
const BATCH_SIZE = 500;

type FuriganaRow = {
  id: number;
  text: string;
  reading: string;
  reading_hiragana: string | null;
  segments: string;
  created_at: string;
};

/**
 * Creates the furigana table if it doesn't exist (fast, runs in onInit).
 */
async function ensureFuriganaTable(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS furigana (
      id INTEGER PRIMARY KEY,
      text TEXT NOT NULL,
      reading TEXT NOT NULL,
      reading_hiragana TEXT,
      segments TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_furigana_text_reading ON furigana(text, reading);
    CREATE INDEX IF NOT EXISTS idx_furigana_text ON furigana(text);
    CREATE INDEX IF NOT EXISTS idx_furigana_reading ON furigana(reading);
  `);
}

/**
 * Ensures the meta key/value table exists. Used to track one-shot
 * background migrations whose state isn't expressible via user_version.
 */
async function ensureMetaTable(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

async function getMetaFlag(db: SQLiteDatabase, key: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ value: string } | null>(
    "SELECT value FROM meta WHERE key = ?",
    [key]
  );
  return row?.value === "1";
}

async function setMetaFlag(db: SQLiteDatabase, key: string): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, '1')",
    [key]
  );
}

/**
 * Populates the furigana table from the bundled seed database in the background.
 * Guarded by a meta flag so the work runs once — interrupted populations are
 * retried on the next launch because the flag is only set after success.
 */
async function populateFuriganaFromSeed(db: SQLiteDatabase) {
  try {
    await ensureMetaTable(db);

    if (await getMetaFlag(db, "furigana_populated")) {
      return;
    }

    // Existing installs may already have a populated furigana table from
    // an earlier run. If so, mark the flag and skip the import.
    const existing = await db.getFirstAsync<{ count: number }>(
      "SELECT count(*) as count FROM furigana"
    );
    if (existing && existing.count > 0) {
      await setMetaFlag(db, "furigana_populated");
      return;
    }

    console.log("[furigana] populating from seed in background...");

    await importDatabaseFromAssetAsync(SEED_COPY_NAME, {
      assetId: DATABASE_ASSET_ID,
      forceOverwrite: true,
    });

    const seedDb = await openDatabaseAsync(SEED_COPY_NAME);

    const totalRow = await seedDb.getFirstAsync<{ count: number }>(
      "SELECT count(*) as count FROM furigana"
    );
    const total = totalRow?.count ?? 0;

    for (let offset = 0; offset < total; offset += BATCH_SIZE) {
      const rows = await seedDb.getAllAsync<FuriganaRow>(
        `SELECT id, text, reading, reading_hiragana, segments, created_at
         FROM furigana LIMIT ${BATCH_SIZE} OFFSET ${offset}`
      );

      const placeholders = rows.map(() => "(?,?,?,?,?,?)").join(",");
      const params = rows.flatMap((r) => [
        r.id, r.text, r.reading, r.reading_hiragana, r.segments, r.created_at,
      ]);

      await db.runAsync(
        `INSERT OR IGNORE INTO furigana (id, text, reading, reading_hiragana, segments, created_at)
         VALUES ${placeholders}`,
        params
      );
    }

    await seedDb.closeAsync();
    await deleteDatabaseAsync(SEED_COPY_NAME);

    await setMetaFlag(db, "furigana_populated");

    const inserted = await db.getFirstAsync<{ count: number }>(
      "SELECT count(*) as count FROM furigana"
    );
    console.log(`[furigana] done: ${inserted?.count ?? 0} entries`);
  } catch (error) {
    console.error("[furigana] migration failed:", error);
  }
}

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

    CREATE INDEX IF NOT EXISTS idx_history_entry_type ON history(entry_type);
    CREATE INDEX IF NOT EXISTS idx_history_kanji_id ON history(kanji_id);
    CREATE INDEX IF NOT EXISTS idx_practice_sessions_level ON practice_sessions(level);
    CREATE INDEX IF NOT EXISTS idx_practice_sessions_updated_at ON practice_sessions(updated_at);
  `);
}

async function dropDeprecatedAudioTables(db: SQLiteDatabase) {
  await db.execAsync(`
    DROP TABLE IF EXISTS audio_blobs;
    DROP TABLE IF EXISTS audio_cache;
  `);
}

async function ensureWordsIndexes(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_words_reading_hiragana ON words(reading_hiragana);
  `);
}

async function ensureMeaningsFts(db: SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ name: string } | null>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='meanings_fts'"
  );

  if (existing) {
    return;
  }

  await db.execAsync(`
    CREATE VIRTUAL TABLE meanings_fts USING fts5(
      meaning,
      content='meanings',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS meanings_ai AFTER INSERT ON meanings BEGIN
      INSERT INTO meanings_fts(rowid, meaning) VALUES (new.id, new.meaning);
    END;

    CREATE TRIGGER IF NOT EXISTS meanings_ad AFTER DELETE ON meanings BEGIN
      INSERT INTO meanings_fts(meanings_fts, rowid, meaning) VALUES('delete', old.id, old.meaning);
    END;

    CREATE TRIGGER IF NOT EXISTS meanings_au AFTER UPDATE ON meanings BEGIN
      INSERT INTO meanings_fts(meanings_fts, rowid, meaning) VALUES('delete', old.id, old.meaning);
      INSERT INTO meanings_fts(rowid, meaning) VALUES (new.id, new.meaning);
    END;

    INSERT INTO meanings_fts(meanings_fts) VALUES('rebuild');
  `);
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 24;

  try {
    // Test if database is corrupted by trying a simple query
    try {
      await db.getFirstAsync("SELECT COUNT(*) FROM sqlite_master");
    } catch (corruptionError: any) {
      const message = corruptionError?.message ?? "";
      const isMalformed = message.includes("database disk image is malformed");

      if (!isMalformed) {
        // Transient errors (locks, busy timeouts) must not delete the DB.
        throw corruptionError;
      }

      console.error("Database corruption detected:", message);

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

    const versionResult = await db.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version"
    );
    let currentDbVersion = versionResult?.user_version ?? 0;

    console.log("DB: ", currentDbVersion, "TARGET: ", DATABASE_VERSION);

    if (currentDbVersion >= DATABASE_VERSION) {
      await ensureUserDataTables(db);
      populateFuriganaFromSeed(db);
      return;
    }

    // --- Legacy migrations (v1–v20) removed ---
    // All users now receive jisho-seed.db (user_version=20) with
    // the full schema on first install. The DB name changed to the
    // stable "jisho.db", so no existing user can arrive here with
    // a version below 20. Future migrations start at v21+.

    if (currentDbVersion < 22) {
      await ensureFuriganaTable(db);
    }

    if (currentDbVersion < 23) {
      await dropDeprecatedAudioTables(db);
      await ensureWordsIndexes(db);
    }

    if (currentDbVersion < 24) {
      await ensureMeaningsFts(db);
    }

    await ensureUserDataTables(db);
    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);

    // Populate furigana in background — not gated by version so it
    // retries on next launch if interrupted. App remains usable immediately.
    populateFuriganaFromSeed(db);

    console.log(
      `Database migrations completed. Current version: ${DATABASE_VERSION}`
    );
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}
