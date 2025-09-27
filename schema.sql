-- Jisho Dictionary Database Schema
-- SQLite database schema for Japanese-English dictionary with full-text search
-- Supports bidirectional search, kanji lookup, examples, and user data

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- =============================================================================
-- CORE DICTIONARY TABLES
-- =============================================================================

-- Main word entries table (simplified structure from production)
CREATE TABLE words (
    id INTEGER PRIMARY KEY,
    word TEXT,                      -- Main word form (kanji or kana)
    reading TEXT,                   -- Reading in kana
    reading_hiragana TEXT,          -- Normalized hiragana reading
    kanji TEXT,                     -- Kanji form (may be null for kana-only words)
    position INTEGER                -- Position/order for results
);

CREATE INDEX idx_words_word ON words(word);
CREATE INDEX idx_words_reading ON words(reading);
CREATE INDEX idx_words_kanji ON words(kanji);

-- Word meanings/definitions
CREATE TABLE meanings (
    id INTEGER PRIMARY KEY,
    word_id INTEGER,
    meaning TEXT,                   -- English definition
    part_of_speech TEXT,           -- Part of speech tag
    field TEXT,                    -- Field/domain tag
    misc TEXT,                     -- Miscellaneous tags
    info TEXT                      -- Additional information
);

CREATE INDEX idx_meanings_word_id ON meanings(word_id);
CREATE INDEX idx_meanings_meaning ON meanings(meaning);

-- Furigana lookups for compound words and phrases
CREATE TABLE furigana (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,                -- Surface form (kanji/kana mix)
    reading TEXT NOT NULL,             -- Source reading (kana)
    reading_hiragana TEXT,             -- Normalized hiragana reading
    segments TEXT NOT NULL,            -- JSON array of ruby segments
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_furigana_text_reading ON furigana(text, reading);
CREATE INDEX idx_furigana_text ON furigana(text);
CREATE INDEX idx_furigana_reading ON furigana(reading);

-- =============================================================================
-- FULL-TEXT SEARCH TABLES (FTS5)
-- =============================================================================

-- Main search index for words (production implementation)
CREATE VIRTUAL TABLE words_fts USING fts5(
    word,
    reading,
    kanji,
    meaning,
    content='words',
    content_rowid='id'
);

-- =============================================================================
-- KANJI SUPPORT TABLES
-- =============================================================================

-- Individual kanji character information (production implementation)
CREATE TABLE kanji (
    id INTEGER PRIMARY KEY,
    character TEXT NOT NULL,
    jis_code INTEGER,
    unicode TEXT,
    on_readings TEXT,               -- JSON array of on (Chinese) readings
    kun_readings TEXT,              -- JSON array of kun (native) readings
    meanings TEXT,                  -- JSON array of English meanings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kanji_character ON kanji(character);

-- =============================================================================
-- EXAMPLE SENTENCES
-- =============================================================================

-- Example sentences with translations (production implementation)
CREATE TABLE examples (
    id INTEGER PRIMARY KEY,
    japanese_text TEXT,
    english_text TEXT,
    tokens TEXT,                    -- Tokenized/parsed Japanese text
    example_id TEXT,                -- External example ID
    word_id INTEGER                 -- Link to words table
);

CREATE INDEX idx_examples_japanese ON examples(japanese_text);
CREATE INDEX idx_examples_english ON examples(english_text);
CREATE INDEX idx_examples_word_id ON examples(word_id);

-- =============================================================================
-- USER DATA TABLES
-- =============================================================================

CREATE TABLE history (
    id INTEGER PRIMARY KEY NOT NULL,
    entry_type TEXT DEFAULT 'word' NOT NULL,
    word_id INTEGER,
    kanji_id INTEGER,
    kanji_character TEXT,
    kanji_meaning TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (word_id) REFERENCES words (id)
);

CREATE INDEX idx_history_entry_type ON history(entry_type);
CREATE INDEX idx_history_word_id ON history(word_id);
CREATE INDEX idx_history_kanji_id ON history(kanji_id);
CREATE INDEX idx_history_created_at ON history(created_at);

-- =============================================================================
-- AUDIO DATA TABLES
-- =============================================================================

-- Audio pronunciation data (production implementation)
CREATE TABLE audio_blobs (
    id INTEGER PRIMARY KEY,
    file_path TEXT NOT NULL,
    word_id INTEGER NOT NULL,
    example_id INTEGER,
    audio_data BLOB NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_audio_blobs_word_id ON audio_blobs(word_id);
CREATE INDEX idx_audio_blobs_example_id ON audio_blobs(example_id);

-- =============================================================================
-- DATABASE CONFIGURATION
-- =============================================================================

-- Optimize database for mobile/production use
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB
PRAGMA cache_size = 10000;
PRAGMA user_version = 12;
