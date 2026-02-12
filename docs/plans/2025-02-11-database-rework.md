# Plan: Database Rework

## Overview

Fix FTS5 index issues, schema mismatches, search race conditions, and align the build database schema.

## Validation Commands
- `yarn test:ci`
- `yarn test:search`
- `yarn test:dictionary`
- `yarn db:verify`

## Problems Found

### 1. FTS5 index is empty in the bundled database
The `words_fts` virtual table has 0 indexed documents. `updateFTSTables()` runs during build but inserts with columns `(word, reading, kanji, meaning)` while the FTS table declares `content='words'` — and the `words` table has no `meaning` column. The insert succeeds at build time (FTS5 doesn't validate content-table alignment on insert), but `words_fts_docsize` has 0 rows, meaning the index is effectively empty. Every FTS search returns nothing and falls through to LIKE-based tiered search.

### 2. FTS schema mismatch in schema.sql
- **schema.sql** (build): `fts5(word, reading, kanji, meaning, content='words')` — `meaning` column doesn't exist in `words` table
- Should be: `fts5(word, reading, reading_hiragana, kanji, content='words', content_rowid='id')`

### 3. `reading_hiragana` is never actually hiragana
The words importer stores `reading` as-is into `reading_hiragana` with no conversion. Katakana-only words like `シーディープレーヤー` have identical `reading` and `reading_hiragana`. Across 203K rows, 0 differ.

### 4. Rapid typing race condition
`handleSearch` is debounced at 100ms but has a guard: `if (isSearchingRef.current) return`. When a user types fast:
- Keystroke A fires, sets `isSearchingRef = true`, starts async search
- Keystroke B fires 100ms later, sees `isSearchingRef = true`, **drops the query entirely**
- Keystroke A completes, sets `isSearchingRef = false`, shows stale results
- The user's final input is never searched

The AbortController is created but the early-return happens *before* it's used. The intended flow (abort previous, start new) is short-circuited by the `isSearchingRef` guard.

### 5. `JSON.stringify` comparison for results
Line 113 in `app/word/index.tsx`: `JSON.stringify(newResults) !== JSON.stringify(results)` serializes the full result array on every search to avoid redundant re-renders. This is expensive with 50 results and defeats the purpose of optimizing search speed.

---

## Completed Work

### Schema & Build Pipeline Fixes (done)
- [x] schema.sql: Added `grade INTEGER`, `stroke_count INTEGER`, `frequency INTEGER` to kanji table
- [x] schema.sql: Added `FOREIGN KEY (word_id) REFERENCES words(id)` to meanings table
- [x] schema.sql: Added `reading TEXT` column to examples table
- [x] schema.sql: Set `PRAGMA user_version = 20`
- [x] schema.sql: Updated tokens comment to "JSON array of dictionary form tokens"
- [x] Kanji importer: stores grade, stroke_count, frequency from kanjidic parser
- [x] Examples importer: parses B: line tokens into JSON array of dictionary forms (skips particles)
- [x] Examples importer: post-insert pass links examples to words via token matching (~99.96% linked)
- [x] Types: added grade, stroke_count, frequency to DBKanji; strokeCount to KanjiEntry
- [x] kanji.ts: parseKanjiResult maps new fields (grade, strokeCount, frequency)
- [x] Removed dead legacy scripts (initdb, initex, initkanji) from package.json
- [x] Updated Database.ts constant to point to new db_20260211_105924.db
- [x] Updated test expectations for JSON token format
- [x] Cleaned up outdated db files in assets/db (kept only prev + new)

---

## Remaining Implementation Plan

### Task 1: Fix FTS5 in the build pipeline

**Goal**: Bundled DB ships with FTS fully populated and triggers in place.

- [x] Update schema.sql:
  - Change FTS definition to `fts5(word, reading, reading_hiragana, kanji, content='words', content_rowid='id')`
  - Remove the `meaning` column from FTS
  - Add the 3 triggers (words_ai, words_ad, words_au)
- [x] Update `updateFTSTables()` in build scripts to insert correct columns and actually populate the index
- [x] Fix words importer to convert `reading` to actual hiragana for `reading_hiragana`
- [x] Rebuild and verify: `SELECT COUNT(*) FROM words_fts_docsize` should equal words count

### Task 2: Fix the search pipeline

**Goal**: FTS actually gets used, search is simpler and faster.

- [x] Remove the `searchByFTS` length guard (`trimmedQuery.length > 2`)
- [x] Simplify `searchByFTS` by removing re-ranking CASE expressions
- [x] Make FTS the primary path for Japanese queries (not middle tier)
- [x] Remove `searchByFuriganaReading` and its imports

### Task 3: Fix rapid-typing race condition

**Goal**: Every keystroke that matters gets searched, stale results don't linger.

- [x] Remove `isSearchingRef` guard entirely
- [x] Fix the debounced callback flow to properly use AbortController
- [x] Remove `JSON.stringify` comparison for results
- [x] Consider increasing debounce to 150-200ms

### Task 4: Clean up dead code

- [x] Remove `createRankingClause` and `createDeduplicationQuery` from utils.ts if unused
- [x] Remove `searchByFuriganaReading` function and its imports
- [x] Verify audio_blobs indexes are correct

---

## Final Verification

- [x] Verify `yarn db:build` produces DB with matching word counts in words and words_fts
- [x] Test FTS search returns results: `SELECT * FROM words_fts WHERE words_fts MATCH 'たべる' LIMIT 5`
- [x] Test rapid typing shows results for final typed text, not intermediate states
- [x] Verify search tests pass: `yarn test:ci`
