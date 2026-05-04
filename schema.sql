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
    position INTEGER,               -- Position/order for results
    search_ngrams TEXT,             -- Pre-segmented unigram/bigram/trigram tokens for substring FTS match (CJK runs only)
    priority_rank INTEGER DEFAULT 999  -- JMdict frequency rank: 1-48 from nfXX; 50 for ichimango; 100 for any other pri tag; 999 if absent
);

CREATE INDEX idx_words_word ON words(word);
CREATE INDEX idx_words_reading ON words(reading);
CREATE INDEX idx_words_reading_hiragana ON words(reading_hiragana);
CREATE INDEX idx_words_kanji ON words(kanji);
CREATE INDEX idx_words_priority_rank ON words(priority_rank);

-- Word meanings/definitions
CREATE TABLE meanings (
    id INTEGER PRIMARY KEY,
    word_id INTEGER,
    meaning TEXT,                   -- English definition
    part_of_speech TEXT,           -- Part of speech tag
    field TEXT,                    -- Field/domain tag
    misc TEXT,                     -- Miscellaneous tags
    info TEXT,                     -- Additional information
    FOREIGN KEY (word_id) REFERENCES words(id)
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

-- Main search index for words. search_ngrams holds pre-segmented unigram/
-- bigram/trigram CJK tokens so substring queries (single kanji, 2-3 char
-- compounds) match natively under unicode61 instead of needing LIKE scans.
CREATE VIRTUAL TABLE words_fts USING fts5(
    word,
    reading,
    reading_hiragana,
    kanji,
    search_ngrams,
    content='words',
    content_rowid='id'
);

-- Keep FTS index in sync with words table
CREATE TRIGGER words_ai AFTER INSERT ON words BEGIN
    INSERT INTO words_fts(rowid, word, reading, reading_hiragana, kanji, search_ngrams)
    VALUES (new.id, new.word, new.reading, new.reading_hiragana, new.kanji, new.search_ngrams);
END;

CREATE TRIGGER words_ad AFTER DELETE ON words BEGIN
    INSERT INTO words_fts(words_fts, rowid, word, reading, reading_hiragana, kanji, search_ngrams)
    VALUES('delete', old.id, old.word, old.reading, old.reading_hiragana, old.kanji, old.search_ngrams);
END;

CREATE TRIGGER words_au AFTER UPDATE ON words BEGIN
    INSERT INTO words_fts(words_fts, rowid, word, reading, reading_hiragana, kanji, search_ngrams)
    VALUES('delete', old.id, old.word, old.reading, old.reading_hiragana, old.kanji, old.search_ngrams);
    INSERT INTO words_fts(rowid, word, reading, reading_hiragana, kanji, search_ngrams)
    VALUES (new.id, new.word, new.reading, new.reading_hiragana, new.kanji, new.search_ngrams);
END;

-- Search index for English meanings (lowercased for case-insensitive search)
CREATE VIRTUAL TABLE meanings_fts USING fts5(
    meaning,
    content='meanings',
    content_rowid='id'
);

-- Keep meanings FTS index in sync with meanings table
CREATE TRIGGER meanings_ai AFTER INSERT ON meanings BEGIN
    INSERT INTO meanings_fts(rowid, meaning) VALUES (new.id, new.meaning);
END;

CREATE TRIGGER meanings_ad AFTER DELETE ON meanings BEGIN
    INSERT INTO meanings_fts(meanings_fts, rowid, meaning) VALUES('delete', old.id, old.meaning);
END;

CREATE TRIGGER meanings_au AFTER UPDATE ON meanings BEGIN
    INSERT INTO meanings_fts(meanings_fts, rowid, meaning) VALUES('delete', old.id, old.meaning);
    INSERT INTO meanings_fts(rowid, meaning) VALUES (new.id, new.meaning);
END;

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
    grade INTEGER,                  -- School grade level (1-10, where 8+ = Jinmeiyou)
    stroke_count INTEGER,           -- Number of strokes
    frequency INTEGER,              -- Frequency ranking (lower = more common)
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
    tokens TEXT,                    -- JSON array of dictionary form tokens
    example_id TEXT,                -- External example ID
    word_id INTEGER,                -- Link to words table
    reading TEXT                    -- Reading in kana
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
    kanji_on_readings TEXT,
    kanji_kun_readings TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (word_id) REFERENCES words (id)
);

CREATE INDEX idx_history_entry_type ON history(entry_type);
CREATE INDEX idx_history_word_id ON history(word_id);
CREATE INDEX idx_history_kanji_id ON history(kanji_id);
CREATE INDEX idx_history_created_at ON history(created_at);

-- =============================================================================
-- PRACTICE / READING SESSION TABLES
-- =============================================================================

CREATE TABLE practice_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    title TEXT,
    content TEXT,
    content_output TEXT,
    content_text TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_practice_sessions_level ON practice_sessions(level);
CREATE INDEX idx_practice_sessions_updated_at ON practice_sessions(updated_at);

-- =============================================================================
-- DATABASE CONFIGURATION
-- =============================================================================

-- Optimize database for mobile/production use
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB
PRAGMA cache_size = 10000;
PRAGMA user_version = 25;
