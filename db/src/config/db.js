const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

function initializeDatabase(dbPath) {
  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Open database with optimized settings
  const db = new Database(dbPath, {
    readonly: false,
    fileMustExist: false,
    timeout: 30000, // Longer timeout for busy database
    verbose: process.env.DEBUG_SQL === "true" ? console.log : null,
  });

  // Apply optimizations
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = 10000");
  db.pragma("temp_store = MEMORY");
  db.pragma("mmap_size = 30000000000"); // 30GB, adjust as needed

  // Optimize for bulk inserts
  db.pragma("page_size = 8192");

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      reading TEXT,
      UNIQUE(word, reading)
    );

    CREATE TABLE IF NOT EXISTS meanings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      meaning TEXT NOT NULL,
      part_of_speech TEXT,
      tags TEXT,
      FOREIGN KEY(word_id) REFERENCES words(id)
    );

    CREATE TABLE IF NOT EXISTS examples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      japanese TEXT NOT NULL,
      english TEXT,
      parsed_tokens TEXT
    );

    CREATE TABLE IF NOT EXISTS example_word_map (
      example_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      PRIMARY KEY(example_id, word_id),
      FOREIGN KEY(example_id) REFERENCES examples(id),
      FOREIGN KEY(word_id) REFERENCES words(id)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS meanings_fts USING fts5(
      meaning,
      content=meanings,
      content_rowid=id
    );
  `);

  return db;
}

module.exports = {
  initializeDatabase,
};
