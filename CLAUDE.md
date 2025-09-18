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
- `yarn test` - Run Jest tests (with watch mode)
- `yarn test:ci` - Run tests without watch mode
- `yarn build` - Build iOS app via EAS
- `yarn build:preview` - Build preview iOS version

### Database Commands
- `yarn initdb` - Initialize main dictionary database
- `yarn initex` - Initialize example sentences database
- `yarn initkanji` - Initialize kanji database
- `yarn db:create` - Create new database schema
- `yarn db:import` - Import dictionary data
- `yarn db:reset` - Reset database to clean state
- `yarn db:stats` - Show database statistics
- `yarn db:verify` - Verify database integrity

### Testing Commands
- `yarn test:search` - Test search functionality
- `yarn test:dictionary` - Test dictionary operations
- `yarn test:bookmarks` - Test bookmark features
- `yarn test:history` - Test history functionality
- `yarn test:kanji` - Test kanji operations
- `yarn test:utils` - Test database utilities
- `yarn test:db` - Run all database tests

### Build System
- Uses **Yarn 4.9.4** as package manager
- **Expo (v54)** with file-based routing via `expo-router`
- **EAS Build** for production builds
- **TypeScript** for type safety
- **Jest** with expo preset for testing (see `jest.config.node.js` for Node.js tests)

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
- **Japanese Processing**: wanakana library for text conversion, tiny-segmenter for text analysis
- **State Management**: @tanstack/react-query
- **Navigation**: expo-router with typed routes
- **UI**: @shopify/flash-list for performance, react-native-reanimated for animations
- **AI Integration**: Local AI (@react-native-ai/apple) and cloud AI with streaming support

### Database Schema
- `words` - Dictionary entries with readings and kanji
- `meanings` - Word definitions and parts of speech
- `examples` - Example sentences with translations
- `kanji` - Kanji character data
- `bookmarks`, `history`, `chats` - User data

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
- Jest with expo preset for React Native components
- Node.js specific tests use `jest.config.node.js` configuration
- Test specific features with individual test commands (see Testing Commands above)
- Run all tests with `yarn test:ci` for CI/CD
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
- expo apis and libs docs here: https://docs.expo.dev/llms-full.txt