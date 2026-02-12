# Database Preparation Pipeline

## Overview

The app ships with a pre-built SQLite database containing ~200K dictionary entries, ~13K kanji, ~148K example sentences, and ~223K furigana annotations. The database is built offline from four open-source Japanese language data files, then bundled into the app as `assets/db/db_<timestamp>.db`.

## Data Sources

All source files live in `data/`:

| File | Size | Entries | Origin | Format |
|------|------|---------|--------|--------|
| `words.ljson` | 29 MB | 203,627 | JMdict (Japanese-English dictionary) | Line-delimited JSON |
| `kanjidic_comb_utf8` | 1.8 MB | 13,110 | KANJIDIC (kanji character dictionary) | Space-delimited plain text |
| `examples.utf` | 31 MB | ~147,865 pairs | Tatoeba / Tanaka Corpus | `A:`/`B:` line pairs |
| `JmdictFurigana.json` | 31 MB | 223,383 | JmdictFurigana project | Single JSON array (BOM) |

### words.ljson

One JSON object per line derived from JMdict. Each entry has:
- `k` — kanji forms array (optional; kana-only words omit this)
- `r` — readings array (kana)
- `s` — senses array, each with `g` (English glosses), `pos` (parts of speech), and optional `field`, `misc`, `info`

Example line:
```json
{"k":["食べる"],"r":["たべる"],"s":[{"g":["to eat"],"pos":["v1","vt"]}]}
```

### kanjidic_comb_utf8

KANJIDIC plain text, one kanji per line. Each line starts with the character, then space-separated coded fields:
- JIS/Unicode codes, bushu (radical), grade (`G`), strokes (`S`), frequency (`F`)
- ON readings in katakana, kun readings in hiragana
- English meanings in `{braces}`

Example:
```
技 353B U6280 B64 G5 S7 ... ギ わざ {skill} {art} {craft} {ability}
```

### examples.utf

Tatoeba/Tanaka Corpus format. Entries are paired lines:
- `A:` line — Japanese sentence + tab + English translation + `#ID=...`
- `B:` line — tokenized/parsed breakdown with readings

Example:
```
A: 彼は忙しい。	He is busy.#ID=303697
B: 彼(かれ)[01] は 忙しい(いそがしい)
```

### JmdictFurigana.json

A single JSON array of ruby annotation mappings. Each entry maps a written form to segmented furigana:
```json
{
  "text": "運算",
  "reading": "うんざん",
  "furigana": [
    {"ruby": "運", "rt": "うん"},
    {"ruby": "算", "rt": "ざん"}
  ]
}
```

## Build Pipeline

### Entry Point

`yarn db:build` runs `scripts/build-database.ts`, which orchestrates the full pipeline:

1. Generates a timestamped DB filename (e.g., `assets/db/db_20260211_143000.db`)
2. Spawns `tsx scripts/migrate.ts --create` — creates schema
3. Spawns `tsx scripts/migrate.ts --import` — imports all data

### Step 1: Schema Creation (`--create`)

`scripts/migrate.ts` delegates to `DatabaseManager.initializeSchema()` which reads `schema.sql` and creates these tables:

| Table | Purpose |
|-------|---------|
| `words` | Main dictionary entries (word, reading, kanji, position) |
| `meanings` | Definitions linked to words (meaning, part_of_speech, field, misc, info) |
| `furigana` | Ruby annotation segments (text, reading, segments as JSON) |
| `words_fts` | FTS5 virtual table for full-text search |
| `kanji` | Kanji characters (character, readings as JSON, meanings as JSON) |
| `examples` | Example sentences (japanese_text, english_text, tokens) |
| `history` | User search history (empty at build time) |
| `audio_blobs` | Cached audio data (empty at build time) |

PRAGMAs set WAL mode, 256MB mmap, and `user_version = 20`.

### Step 2: Data Import (`--import`)

Imports run in dependency order, each using `DatabaseManager.optimizeForBulkOperations()` (synchronous=OFF, journal_mode=MEMORY, wrapped in a transaction) for speed:

#### 2a. Words Import (`scripts/import/words-importer.ts`)

- **Reads**: `data/words.ljson` (line-by-line streaming via readline)
- **Writes**: `words` + `meanings` tables
- First kanji form becomes `word`; first reading becomes `reading`; each sense becomes a `meanings` row with glosses joined by `'; '`
- Commits every 1,000 entries

#### 2b. Furigana Import (`scripts/import/furigana-importer.ts`)

- **Reads**: `data/JmdictFurigana.json` (streamed via JSONStream to avoid loading 31MB into memory; BOM-stripped)
- **Writes**: `furigana` table (UPSERT on text+reading)
- Stores segments as JSON string; normalizes reading to hiragana
- Commits every 5,000 entries

#### 2c. Kanji Import (`scripts/import/kanji-importer.ts`)

- **Reads**: `data/kanjidic_comb_utf8` (loaded fully into memory — only 1.8MB)
- **Writes**: `kanji` table
- Parses space-delimited format; stores on_readings, kun_readings, meanings as JSON arrays
- Commits every 1,000 entries

#### 2d. Examples Import (`scripts/import/examples-importer.ts`)

- **Reads**: `data/examples.utf` (line-by-line streaming)
- **Writes**: `examples` table (clears table first with `DELETE FROM examples`)
- Pairs `A:` header lines with following `B:` token lines; extracts ID, Japanese text, English text, tokens
- Commits every 1,000 entries

#### 2e. FTS Rebuild

After all imports, `DatabaseManager.updateFTSTables()` populates `words_fts` by joining `words` with aggregated `meanings`.

### Post-Processing (Optional)

`yarn db:generate-readings` runs `scripts/generate-example-readings.ts`:
- Uses Kuroshiro + kuromoji to generate hiragana readings for example sentences
- Processes in batches of 100, updates the `reading` column on `examples`

## Utility Scripts

### scripts/import/utils/database.ts — `DatabaseManager`

Wrapper around `better-sqlite3` providing:
- Schema initialization (categorizes and orders SQL statements)
- Bulk operation optimizations (synchronous=OFF, journal_mode=MEMORY)
- FTS table rebuilding
- Index creation
- Stats reporting (row counts per table)

### scripts/import/utils/parsers.ts

Pure parsing functions for all four data formats plus helpers:
- `parseWordsLJson()` — line-delimited JSON entries
- `parseKanjidicLine()` — KANJIDIC space-delimited format
- `parseFuriganaJson()` — furigana JSON objects
- `parseExamples()` — Tatoeba A:/B: pairs (bulk alternative)
- `normalizeJapanese()` — full-width to half-width conversion
- `hiraganaToRomaji()` — basic romanization

### scripts/import/utils/progress.ts

Terminal progress utilities:
- `ProgressTracker` — percentage + ETA display (throttled to 1/sec)
- `BatchProcessor<T>` — generic chunked processing with progress
- `createSpinner()` — braille-character animation

## Yarn Commands Reference

| Command | Description |
|---------|-------------|
| `yarn db:build` | Full pipeline: create schema + import all data into timestamped DB |
| `yarn db:create` | Create schema only (drops existing DB) |
| `yarn db:import` | Import all data sources (words → furigana → kanji → examples → FTS) |
| `yarn db:import:words` | Import words only |
| `yarn db:import:furigana` | Import furigana only |
| `yarn db:import:examples` | Import examples only |
| `yarn db:reset` | Drop and recreate database |
| `yarn db:stats` | Show row counts per table |
| `yarn db:verify` | Check that all four data files exist |
| `yarn db:generate-readings` | Generate hiragana readings for examples via Kuroshiro |
