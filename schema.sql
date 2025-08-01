-- Jisho Dictionary Database Schema
-- SQLite database schema for Japanese-English dictionary with full-text search
-- Supports bidirectional search, kanji lookup, examples, and user data

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- =============================================================================
-- CORE DICTIONARY TABLES
-- =============================================================================

-- Main word entries table
CREATE TABLE words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER UNIQUE,        -- Original JMdict entry ID
    sequence INTEGER,               -- JMdict sequence number
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_words_entry_id ON words(entry_id);
CREATE INDEX idx_words_sequence ON words(sequence);

-- Kanji forms for words (e.g., 食べる, 読む)
CREATE TABLE word_kanji (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    kanji TEXT NOT NULL,
    info_tags TEXT,                 -- JSON array: ["ateji", "irregular", etc.]
    priorities TEXT,                -- JSON array: ["news1", "ichi1", "spec1", etc.]
    UNIQUE(word_id, kanji)
);

CREATE INDEX idx_word_kanji_word_id ON word_kanji(word_id);
CREATE INDEX idx_word_kanji_kanji ON word_kanji(kanji);

-- Reading forms (hiragana/katakana) (e.g., たべる, よむ)
CREATE TABLE word_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    reading TEXT NOT NULL,
    romaji TEXT,                    -- Romanized version for search
    info_tags TEXT,                 -- JSON array of reading info
    priorities TEXT,                -- JSON array of priority indicators
    restrict_kanji TEXT,            -- JSON array of kanji this reading applies to
    UNIQUE(word_id, reading)
);

CREATE INDEX idx_word_readings_word_id ON word_readings(word_id);
CREATE INDEX idx_word_readings_reading ON word_readings(reading);
CREATE INDEX idx_word_readings_romaji ON word_readings(romaji);

-- Word senses/meanings grouping
CREATE TABLE word_senses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    sense_order INTEGER NOT NULL,
    parts_of_speech TEXT,           -- JSON array: ["noun", "verb-transitive", etc.]
    field_tags TEXT,                -- JSON array: ["medical", "computing", etc.]
    misc_tags TEXT,                 -- JSON array: ["honorific", "vulgar", etc.]
    dialect_tags TEXT,              -- JSON array: ["kansai", "kyoto", etc.]
    info TEXT,                      -- Additional sense information
    UNIQUE(word_id, sense_order)
);

CREATE INDEX idx_word_senses_word_id ON word_senses(word_id);

-- English glosses/definitions for each sense
CREATE TABLE word_glosses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sense_id INTEGER NOT NULL REFERENCES word_senses(id) ON DELETE CASCADE,
    gloss TEXT NOT NULL,
    gloss_type TEXT,                -- "literal", "figurative", "explanation", etc.
    gender TEXT,                    -- Gender information for languages that need it
    gloss_order INTEGER DEFAULT 0
);

CREATE INDEX idx_word_glosses_sense_id ON word_glosses(sense_id);
CREATE INDEX idx_word_glosses_gloss ON word_glosses(gloss);

-- =============================================================================
-- FULL-TEXT SEARCH TABLES (FTS5)
-- =============================================================================

-- Main search index for English queries
CREATE VIRTUAL TABLE words_fts_en USING fts5(
    word_id UNINDEXED,
    kanji,
    reading,
    romaji,
    gloss,
    pos,                            -- Parts of speech for filtering
    content='',
    contentless_delete=1
);

-- Main search index for Japanese queries  
CREATE VIRTUAL TABLE words_fts_jp USING fts5(
    word_id UNINDEXED,
    kanji,
    reading,
    reading_normalized,             -- Normalized for fuzzy matching
    content='',
    contentless_delete=1,
    tokenize='unicode61 remove_diacritics 2'
);

-- =============================================================================
-- KANJI SUPPORT TABLES
-- =============================================================================

-- Individual kanji character information
CREATE TABLE kanji (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character TEXT UNIQUE NOT NULL,
    unicode_codepoint TEXT,         -- Unicode hex value
    jis_code TEXT,                  -- JIS X 0208 code
    grade INTEGER,                  -- School grade level (1-6, 8=general, 9=name)
    stroke_count INTEGER,
    frequency INTEGER,              -- Usage frequency rank (1=most common)
    jlpt_level INTEGER,             -- JLPT level (1-5, 1=hardest)
    meanings TEXT,                  -- JSON array of English meanings
    kun_readings TEXT,              -- JSON array of kun (native) readings
    on_readings TEXT,               -- JSON array of on (Chinese) readings
    nanori_readings TEXT,           -- JSON array of name readings
    radical_names TEXT,             -- JSON array of radical names
    variants TEXT,                  -- JSON array of variant forms
    notes TEXT                      -- Additional notes
);

CREATE INDEX idx_kanji_character ON kanji(character);
CREATE INDEX idx_kanji_grade ON kanji(grade);
CREATE INDEX idx_kanji_stroke_count ON kanji(stroke_count);
CREATE INDEX idx_kanji_frequency ON kanji(frequency);
CREATE INDEX idx_kanji_jlpt ON kanji(jlpt_level);

-- Radical information
CREATE TABLE radicals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    radical TEXT UNIQUE NOT NULL,
    radical_name TEXT,
    stroke_count INTEGER,
    radical_number INTEGER,         -- Traditional radical number (1-214)
    variant_of INTEGER REFERENCES radicals(id),
    description TEXT
);

CREATE INDEX idx_radicals_radical ON radicals(radical);
CREATE INDEX idx_radicals_number ON radicals(radical_number);

-- Kanji to radical mappings (many-to-many)
CREATE TABLE kanji_radicals (
    kanji_id INTEGER NOT NULL REFERENCES kanji(id) ON DELETE CASCADE,
    radical_id INTEGER NOT NULL REFERENCES radicals(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,   -- Primary radical for this kanji
    PRIMARY KEY(kanji_id, radical_id)
);

-- Kanji components/parts (kanji that contain other kanji)
CREATE TABLE kanji_components (
    parent_kanji_id INTEGER NOT NULL REFERENCES kanji(id) ON DELETE CASCADE,
    component_kanji_id INTEGER NOT NULL REFERENCES kanji(id) ON DELETE CASCADE,
    PRIMARY KEY(parent_kanji_id, component_kanji_id)
);

-- =============================================================================
-- EXAMPLE SENTENCES
-- =============================================================================

-- Example sentences with translations
CREATE TABLE examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    japanese TEXT NOT NULL,
    english TEXT NOT NULL,
    japanese_parsed TEXT,           -- Parsed/annotated version with furigana
    source TEXT,                    -- Source identifier
    difficulty_level INTEGER,      -- Estimated difficulty (1-5)
    tags TEXT,                      -- JSON array of tags
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_examples_japanese ON examples(japanese);
CREATE INDEX idx_examples_english ON examples(english);
CREATE INDEX idx_examples_difficulty ON examples(difficulty_level);

-- Link examples to specific words (many-to-many)
CREATE TABLE word_examples (
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    example_id INTEGER NOT NULL REFERENCES examples(id) ON DELETE CASCADE,
    relevance_score REAL DEFAULT 1.0,  -- How relevant this example is to the word
    PRIMARY KEY(word_id, example_id)
);

-- Full-text search for example sentences
CREATE VIRTUAL TABLE examples_fts USING fts5(
    example_id UNINDEXED,
    japanese,
    english,
    content='',
    contentless_delete=1
);

-- =============================================================================
-- FURIGANA AND PRONUNCIATION
-- =============================================================================

-- Furigana mappings for proper pronunciation display
CREATE TABLE furigana (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,             -- Original text (kanji/mixed)
    reading TEXT NOT NULL,          -- Full reading (hiragana)
    ruby_data TEXT,                 -- JSON with detailed ruby notation
    UNIQUE(text, reading)
);

CREATE INDEX idx_furigana_text ON furigana(text);
CREATE INDEX idx_furigana_reading ON furigana(reading);

-- =============================================================================
-- USER DATA TABLES
-- =============================================================================

-- User bookmarks/favorites
CREATE TABLE bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    user_id TEXT DEFAULT 'default',    -- Support for multiple users
    notes TEXT,                        -- User's personal notes
    tags TEXT,                         -- JSON array of user tags
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookmarks_word_id ON bookmarks(word_id);
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_created_at ON bookmarks(created_at);

-- Search history for learning analytics
CREATE TABLE search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    search_type TEXT NOT NULL,      -- 'english', 'japanese', 'kanji', 'example'
    user_id TEXT DEFAULT 'default',
    result_count INTEGER DEFAULT 0,
    selected_word_id INTEGER REFERENCES words(id),  -- Which word user selected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_search_history_user_id ON search_history(user_id);
CREATE INDEX idx_search_history_created_at ON search_history(created_at);
CREATE INDEX idx_search_history_query ON search_history(query);

-- User study lists/collections
CREATE TABLE study_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    user_id TEXT DEFAULT 'default',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_study_lists_user_id ON study_lists(user_id);

-- Words in study lists (many-to-many)
CREATE TABLE study_list_words (
    list_id INTEGER NOT NULL REFERENCES study_lists(id) ON DELETE CASCADE,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mastery_level INTEGER DEFAULT 0,   -- User's mastery level (0-5)
    last_reviewed TIMESTAMP,
    review_count INTEGER DEFAULT 0,
    PRIMARY KEY(list_id, word_id)
);

-- =============================================================================
-- AI CHAT TABLES (for AI explanations)
-- =============================================================================

-- Chat conversations with AI about words/grammar
CREATE TABLE chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    title TEXT,
    word_id INTEGER REFERENCES words(id),  -- Related word if applicable
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_word_id ON chats(word_id);

-- Individual messages in chat conversations
CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,             -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);

-- =============================================================================
-- UTILITY VIEWS
-- =============================================================================

-- Complete word view with all related data
CREATE VIEW word_complete AS
SELECT 
    w.id,
    w.entry_id,
    json_group_array(DISTINCT wk.kanji) FILTER (WHERE wk.kanji IS NOT NULL) as kanji_forms,
    json_group_array(DISTINCT wr.reading) FILTER (WHERE wr.reading IS NOT NULL) as readings,
    json_group_array(DISTINCT wr.romaji) FILTER (WHERE wr.romaji IS NOT NULL) as romaji_forms,
    json_group_array(DISTINCT wg.gloss) FILTER (WHERE wg.gloss IS NOT NULL) as glosses
FROM words w
LEFT JOIN word_kanji wk ON w.id = wk.word_id
LEFT JOIN word_readings wr ON w.id = wr.word_id
LEFT JOIN word_senses ws ON w.id = ws.word_id
LEFT JOIN word_glosses wg ON ws.id = wg.sense_id
GROUP BY w.id, w.entry_id;

-- Popular words view (based on search frequency)
CREATE VIEW popular_words AS
SELECT 
    w.*,
    COUNT(sh.id) as search_count,
    MAX(sh.created_at) as last_searched
FROM words w
LEFT JOIN search_history sh ON w.id = sh.selected_word_id
GROUP BY w.id
ORDER BY search_count DESC, last_searched DESC;

-- =============================================================================
-- TRIGGERS FOR MAINTAINING FTS TABLES
-- =============================================================================

-- Triggers to keep FTS tables in sync with main tables
CREATE TRIGGER words_fts_en_insert AFTER INSERT ON word_glosses BEGIN
    INSERT INTO words_fts_en(word_id, kanji, reading, romaji, gloss, pos)
    SELECT 
        w.id,
        group_concat(DISTINCT wk.kanji, ' '),
        group_concat(DISTINCT wr.reading, ' '),
        group_concat(DISTINCT wr.romaji, ' '),
        NEW.gloss,
        ws.parts_of_speech
    FROM words w
    LEFT JOIN word_kanji wk ON w.id = wk.word_id
    LEFT JOIN word_readings wr ON w.id = wr.word_id
    LEFT JOIN word_senses ws ON NEW.sense_id = ws.id
    WHERE w.id = (SELECT word_id FROM word_senses WHERE id = NEW.sense_id);
END;

CREATE TRIGGER words_fts_jp_insert AFTER INSERT ON word_readings BEGIN
    INSERT INTO words_fts_jp(word_id, kanji, reading, reading_normalized)
    SELECT 
        NEW.word_id,
        group_concat(DISTINCT wk.kanji, ' '),
        NEW.reading,
        NEW.reading  -- TODO: Add normalization function
    FROM word_kanji wk
    WHERE wk.word_id = NEW.word_id;
END;

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Additional composite indexes for common query patterns
CREATE INDEX idx_word_senses_word_pos ON word_senses(word_id, parts_of_speech);
CREATE INDEX idx_word_glosses_sense_gloss ON word_glosses(sense_id, gloss);
CREATE INDEX idx_bookmarks_user_word ON bookmarks(user_id, word_id);
CREATE INDEX idx_search_history_user_type ON search_history(user_id, search_type);

-- =============================================================================
-- DATABASE METADATA
-- =============================================================================

-- Version tracking for schema migrations
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_version (version, description) VALUES (1, 'Initial schema creation');

-- Database configuration
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB
PRAGMA cache_size = 10000;