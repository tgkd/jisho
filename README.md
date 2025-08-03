# Jisho - Japanese Dictionary App

A cross-platform Japanese dictionary mobile app built with Expo and React Native. Features offline dictionary lookup, AI-powered explanations, and local ML capabilities.

## Quick Start

### Installation
```bash
yarn install
```

### Development
```bash
yarn start      # Start Expo development server
yarn ios        # Run on iOS simulator
yarn android    # Run on Android emulator
```

### Database Initialization

#### Option 1: Modern Build System (Recommended)
```bash
# Create fresh database with latest schema
yarn db:reset    # Drop and recreate database
yarn db:import   # Import all data (words, kanji, examples)

# Move to app location
mv database_new.db assets/db/d_3.db
```

#### Option 2: Legacy Build Scripts
```bash
yarn initdb     # Initialize main dictionary database
yarn initex     # Initialize example sentences database
yarn initkanji  # Initialize kanji database
```

#### Database Management Commands
```bash
yarn db:create       # Create new database with schema only
yarn db:import       # Import all data files
yarn db:import:words # Import only words data
yarn db:stats        # Show database statistics
yarn db:verify       # Verify database integrity
```

### Building
```bash
yarn build         # Build iOS app via EAS
yarn build:preview # Build preview iOS version
```

### Testing & Linting
```bash
yarn test      # Run Jest tests
yarn lint      # Run ESLint
```

## Database Schema

The app uses SQLite with the following tables:

### Core Dictionary Tables

#### `words`
- `id` (INTEGER PRIMARY KEY) - Unique word identifier
- `word` (TEXT) - The Japanese word/phrase
- `reading` (TEXT) - Reading in kana
- `reading_hiragana` (TEXT) - Hiragana reading
- `kanji` (TEXT) - Kanji form
- `position` (INTEGER) - Word position/order

#### `meanings`
- `id` (INTEGER PRIMARY KEY) - Unique meaning identifier
- `word_id` (INTEGER) - Foreign key to words table
- `meaning` (TEXT) - English definition
- `part_of_speech` (TEXT) - Grammatical part of speech
- `field` (TEXT) - Subject field/domain
- `misc` (TEXT) - Miscellaneous information
- `info` (TEXT) - Additional information

#### `examples`
- `id` (INTEGER PRIMARY KEY) - Unique example identifier
- `japanese_text` (TEXT) - Japanese example sentence
- `english_text` (TEXT) - English translation
- `tokens` (TEXT) - Tokenized text data
- `example_id` (TEXT) - External example identifier
- `word_id` (INTEGER) - Associated word ID

#### `kanji`
- `id` (INTEGER PRIMARY KEY) - Unique kanji identifier
- `character` (TEXT NOT NULL) - The kanji character
- `jis_code` (INTEGER) - JIS encoding code
- `unicode` (TEXT) - Unicode value
- `on_readings` (TEXT) - On'yomi readings
- `kun_readings` (TEXT) - Kun'yomi readings
- `meanings` (TEXT) - English meanings
- `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP) - Creation timestamp

### User Data Tables

#### `bookmarks`
- `id` (INTEGER PRIMARY KEY) - Unique bookmark identifier
- `word_id` (INTEGER NOT NULL) - Bookmarked word ID
- `created_at` (TEXT NOT NULL) - Bookmark creation time

#### `history`
- `id` (INTEGER PRIMARY KEY) - Unique history identifier
- `word_id` (INTEGER NOT NULL) - Searched word ID
- `created_at` (TEXT NOT NULL) - Search timestamp

#### `chats`
- `id` (INTEGER PRIMARY KEY) - Unique chat identifier
- `request` (TEXT NOT NULL) - User request/query
- `response` (TEXT NOT NULL) - AI response
- `created_at` (TEXT NOT NULL) - Chat timestamp

#### `audio_blobs`
- `id` (INTEGER PRIMARY KEY) - Unique audio identifier
- `file_path` (TEXT NOT NULL) - Audio file path
- `word_id` (INTEGER NOT NULL) - Associated word ID
- `example_id` (INTEGER) - Associated example ID (optional)
- `audio_data` (BLOB NOT NULL) - Binary audio data
- `created_at` (TEXT NOT NULL) - Creation timestamp

### Full-Text Search

#### `words_fts`
Virtual FTS5 table for full-text search on:
- `word` - Japanese word text
- `reading` - Reading in kana
- `reading_hiragana` - Hiragana reading
- `kanji` - Kanji form

Supporting tables: `words_fts_data`, `words_fts_idx`, `words_fts_docsize`, `words_fts_config`

## Technology Stack

- **Framework**: Expo (v53) with React Native
- **Routing**: expo-router with file-based routing
- **Database**: SQLite with FTS5 full-text search
- **Storage**: MMKV for settings and preferences
- **AI**: Local Qwen3-0.6B model + cloud API integration
- **Japanese Processing**: wanakana, tiny-segmenter
- **State Management**: @tanstack/react-query
- **Package Manager**: Yarn 4.9.1
- **Build System**: EAS Build
- **Language**: TypeScript