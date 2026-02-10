# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Jisho is a cross-platform Japanese dictionary mobile app built with Expo and React Native. It features offline dictionary lookup, AI-powered explanations, local ML capabilities, and JLPT practice reading passages with a subscription-based premium tier.

## Development Commands

### Essential Commands
- `yarn start` - Start Expo development server
- `yarn ios` - Run on iOS simulator
- `yarn android` - Run on Android emulator
- `yarn web` - Run on web browser
- `yarn lint` - Run ESLint
- `yarn test` - Run Jest tests (with watch mode)
- `yarn test:ci` - Run tests without watch mode
- `yarn build` - Build iOS app via EAS
- `yarn build:preview` - Build preview iOS version
- `yarn deploy` - Deploy GitHub Pages (development)
- `yarn deploy:production` - Deploy GitHub Pages (production)

### Database Commands
- `yarn initdb` - Initialize main dictionary database
- `yarn initex` - Initialize example sentences database
- `yarn initkanji` - Initialize kanji database
- `yarn db:create` - Create new database schema
- `yarn db:import` - Import dictionary data
- `yarn db:import:words` - Import words data specifically
- `yarn db:import:furigana` - Import furigana data
- `yarn db:import:examples` - Import example sentences
- `yarn db:build` - Build timestamped database bundle
- `yarn db:reset` - Reset database to clean state
- `yarn db:stats` - Show database statistics
- `yarn db:verify` - Verify database integrity

### Testing Commands
- `yarn test:search` - Test search functionality
- `yarn test:dictionary` - Test dictionary operations
- `yarn test:history` - Test history functionality
- `yarn test:kanji` - Test kanji operations
- `yarn test:utils` - Test database utilities
- `yarn test:db` - Run all database tests

### Build System
- Uses **Yarn 4.10.3** as package manager
- **Expo (v55 canary)** with file-based routing via `expo-router`
- **EAS Build** for production builds
- **TypeScript** for type safety
- **Jest** with expo preset for testing (see `jest.config.node.js` for Node.js tests)

## Architecture

### Core Directory Structure
```
app/              # File-based routing screens (expo-router with NativeTabs)
├── _layout.tsx   # Root navigation layout with SQLiteProvider
├── index.tsx     # Search/home screen (tab: word/search)
├── history/      # Search history screens (tab: history)
├── settings/     # App settings screens (tab: settings)
├── practice/     # JLPT reading practice screens (tab: practice, premium-only)
├── word/         # Word detail pages and related functionality
│   ├── [id].tsx  # Dynamic word detail pages
│   ├── chat.tsx  # AI chat interface
│   └── kanji/[id].tsx # Kanji detail pages
└── paywall.tsx   # In-app purchase subscription screen

services/         # Business logic layer
├── database/     # Database operations and search pipeline
│   ├── core.ts       # Database migrations (currently version 19)
│   ├── search.ts     # Multi-tier search with FTS5, caching, retries
│   ├── dictionary.ts # Dictionary entry queries
│   ├── history.ts    # Search history management
│   ├── kanji.ts      # Kanji lookups
│   ├── furigana.ts   # Reading annotations
│   ├── audio.ts      # Audio blob storage
│   ├── audioCache.ts # TTS caching
│   ├── passages.ts   # Practice reading passages
│   ├── practice-sessions.ts # Practice session tracking
│   └── utils.ts      # Database utilities and helpers
├── request.ts    # AI integration & API calls (streaming support)
├── parse.ts      # Japanese text processing (wanakana, tiny-segmenter)
├── storage.ts    # Local storage (MMKV) with typed keys
└── queryClient.ts # Global React Query client

components/       # Reusable UI components
providers/        # React context providers
├── UnifiedAIProvider.tsx   # Unified AI interface (local/remote)
├── AppleAIProvider.tsx     # Apple Intelligence integration
├── SubscriptionProvider.tsx # RevenueCat subscription management
└── SubscriptionContext.tsx  # Subscription state and paywall
hooks/           # Custom hooks
scripts/          # Build and database tooling
```

### Key Technologies
- **Database**: SQLite with FTS5 for full-text search
- **Storage**: MMKV for settings and preferences
- **Japanese Processing**: wanakana library for text conversion, tiny-segmenter for text analysis
- **State Management**: @tanstack/react-query
- **Navigation**: expo-router with typed routes and NativeTabs
- **UI**: @shopify/flash-list for performance, react-native-reanimated for animations
- **AI Integration**: Local AI (@react-native-ai/apple) and cloud AI with streaming support
- **Monetization**: react-native-purchases (RevenueCat) for in-app subscriptions
- **Audio**: expo-audio for playback, expo-speech for TTS fallback

### Database Schema
Core tables:
- `words` - Dictionary entries with readings and kanji
- `words_fts` - FTS5 virtual table for full-text search
- `meanings` - Word definitions and parts of speech
- `examples` - Example sentences with translations
- `kanji` - Kanji character data with readings
- `history` - User search history (supports both word and kanji entries)

Storage and practice:
- `audio_blobs` - Cached audio pronunciations
- `audio_cache` - TTS audio cache by text
- `practice_passages` - JLPT reading passages by level
- `practice_sessions` - User practice session tracking

### AI Integration
The app supports both local and cloud AI through `UnifiedAIProvider`:
- **Local AI**: Apple Intelligence (`@react-native-ai/apple`) for offline explanations
- **Cloud AI**: External API with streaming support for advanced features (requires premium subscription)
- Provider selection via `SETTINGS_KEYS.AI_PROVIDER_TYPE` in MMKV storage
- AI prompts and responses are handled in `services/request.ts`
- Audio playback hierarchy: cached remote → fresh remote (`getAiSound`) → local Apple synthesis → `expo-speech`
- Streaming responses use `StreamingResponse` interface with `onChunk`, `onComplete`, and `onError` callbacks
- Practice chat uses JLPT-level-specific system prompts (N5 through N1)

## Code Style (from .github/copilot-instructions.md)

### Component Structure
- Use functional components with TypeScript
- Define props interface at component top
- Use explicit named exports
- NEVER write inline explanation comments (only JSDoc for functions/components)

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

### Documentation
- Use JSDoc format for all functions and components
- Document parameters and return values
- Avoid inline explanations within function bodies
- Update comments when code changes

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
- Database migrations managed via `migrateDbIfNeeded` (target user_version 20)
- WAL mode enforced for SQLite operations
- Use `retryDatabaseOperation` wrapper for all raw SQL to handle SQLITE_BUSY
- Pull database connection from `useSQLiteContext()` and pass to `services/database/` helpers
- Search pipeline (`services/database/search.ts`): normalizes queries, handles multi-tier matching (exact/prefix/contains), uses FTS5 for longer queries, and implements 30s caching
- Database helpers should remain free of React Native globals for Node.js test compatibility
- Expo API and library docs: https://docs.expo.dev/llms-full.txt

## Provider Hierarchy
Root layout (`app/_layout.tsx`) wraps the app in this order:
1. `ThemeProvider` - Navigation theme (dark/light)
2. `QueryClientProvider` - React Query client for data fetching
3. `SubscriptionProvider` - RevenueCat subscription management
4. `AppleAIProvider` - Local Apple Intelligence integration
5. `UnifiedAIProvider` - Unified AI interface (local/remote)
6. `GestureHandlerRootView` - Gesture support
7. `SQLiteProvider` - Database connection with migrations
8. `KeyboardProvider` - Keyboard event handling

## Subscription & Monetization
- Premium features gated via `useSubscription()` hook from `SubscriptionProvider`
- Premium-only features: remote AI provider, practice reading passages, practice chat
- Paywall shown via `subscription.showPaywall()` when accessing premium features without subscription
- Practice tab hidden in navigation when user is not premium (`sub.isPremium`)
- `SubscriptionRequiredError` thrown from `UnifiedAIProvider` when remote features accessed without subscription

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
