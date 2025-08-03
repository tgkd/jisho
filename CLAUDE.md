# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Jisho is a cross-platform Japanese dictionary mobile app built with Expo and React Native. It features offline dictionary lookup, AI-powered explanations, and local ML capabilities.

## Development Commands

### Essential Commands
- `yarn start` - Start Expo development server
- `yarn ios` - Run on iOS simulator
- `yarn android` - Run on Android emulator
- `yarn lint` - Run ESLint
- `yarn test` - Run Jest tests
- `yarn build` - Build iOS app via EAS
- `yarn build:preview` - Build preview iOS version

### Database Commands
- `yarn initdb` - Initialize main dictionary database
- `yarn initex` - Initialize example sentences database
- `yarn initkanji` - Initialize kanji database

### Build System
- Uses **Yarn 4.9.1** as package manager
- **Expo (v53)** with file-based routing via `expo-router`
- **EAS Build** for production builds
- **TypeScript** for type safety

## Architecture

### Core Directory Structure
```
app/              # File-based routing screens
├── _layout.tsx   # Root navigation layout
├── index.tsx     # Search/home screen
├── explore.tsx   # AI chat interface
└── word/[id].tsx # Dynamic word detail pages

services/         # Business logic layer
├── database.ts   # SQLite operations
├── request.ts    # AI integration & API calls
├── parse.ts      # Japanese text processing
└── storage.ts    # Local storage (MMKV)

components/       # Reusable UI components
providers/        # React context providers
hooks/           # Custom hooks
```

### Key Technologies
- **Database**: SQLite with FTS5 for full-text search
- **Storage**: MMKV for settings and preferences
- **AI**: Local Qwen3-0.6B model via react-native-executorch
- **Japanese Processing**: wanakana library for text conversion
- **State Management**: @tanstack/react-query
- **Navigation**: expo-router with typed routes

### Database Schema

#### Core Dictionary Tables
- **`words`** - Dictionary entries with readings and kanji
  - `id` (INTEGER PRIMARY KEY), `word`, `reading`, `reading_hiragana`, `kanji`, `position`
- **`meanings`** - Word definitions and parts of speech  
  - `id` (INTEGER PRIMARY KEY), `word_id`, `meaning`, `part_of_speech`, `field`, `misc`, `info`
- **`examples`** - Example sentences with translations
  - `id` (INTEGER PRIMARY KEY), `japanese_text`, `english_text`, `tokens`, `example_id`, `word_id`
- **`kanji`** - Kanji character data
  - `id` (INTEGER PRIMARY KEY), `character` (NOT NULL), `jis_code`, `unicode`, `on_readings`, `kun_readings`, `meanings`, `created_at`

#### User Data Tables
- **`bookmarks`** - User bookmarked words
  - `id` (INTEGER PRIMARY KEY), `word_id` (NOT NULL), `created_at` (NOT NULL)
- **`history`** - Search history  
  - `id` (INTEGER PRIMARY KEY), `word_id` (NOT NULL), `created_at` (NOT NULL)
- **`chats`** - AI chat conversations
  - `id` (INTEGER PRIMARY KEY), `request` (NOT NULL), `response` (NOT NULL), `created_at` (NOT NULL)
- **`audio_blobs`** - Audio pronunciation data
  - `id` (INTEGER PRIMARY KEY), `file_path` (NOT NULL), `word_id` (NOT NULL), `example_id`, `audio_data` (BLOB NOT NULL), `created_at` (NOT NULL)

#### Full-Text Search
- **`words_fts`** - FTS5 virtual table for fast text search
  - Indexes: `word`, `reading`, `reading_hiragana`, `kanji`
  - Supporting tables: `words_fts_data`, `words_fts_idx`, `words_fts_docsize`, `words_fts_config`

### AI Integration
The app supports both local and cloud AI:
- **Local AI**: Qwen3-0.6B model for offline explanations
- **Cloud AI**: External API for advanced features
- AI prompts and responses are handled in `services/request.ts`

## Code Style (from .github/copilot-instructions.md)

### Component Structure
- Use functional components with TypeScript
- Define props interface at component top
- Use explicit named exports
- Follow JSDoc documentation standards

### Performance
- Memoize expensive calculations with useMemo/useCallback
- Use FlatList for large lists with proper keys
- Implement React.memo for expensive components
- Use Reanimated for smooth animations

### Japanese Text Processing
- Use wanakana for romaji/hiragana/katakana conversion
- Text segmentation via tiny-segmenter
- Furigana support for reading annotations
- Text normalization in `normal-jp-main/` directory

## Testing
- Jest with expo preset
- Run tests with `yarn test --watchAll`
- Test renderer: react-test-renderer

## Build Configuration
- **app.json**: Expo configuration
- **eas.json**: Build profiles (development, preview, production)
- **Bundle ID**: app.jisho.loc
- Auto-increment version on production builds

## Development Notes
- Uses Expo's new architecture (Fabric/TurboModules)
- Supports both iOS and Android
- Offline-first architecture with local dictionary data
- Comprehensive Japanese language data from JMdict and Kanjidic