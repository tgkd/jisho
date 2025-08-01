# Database Conversion Guide

This guide explains how to convert the raw Japanese dictionary data files into a structured SQLite database with full-text search capabilities.

## 📁 Files Created

### Core Files
- `schema.sql` - Complete SQLite database schema
- `DATA_IMPORT_STRATEGY.md` - Detailed analysis of data files and import strategy
- `DATABASE_CONVERSION.md` - This guide

### Scripts Directory
```
scripts/
├── migrate.ts                     # Main orchestrator script
└── import/
    ├── words-importer.ts          # Main dictionary data importer
    └── utils/
        ├── database.ts            # Database connection utilities
        ├── progress.ts            # Progress tracking utilities
        └── parsers.ts             # Data parsing utilities
```

## 🚀 Quick Start

### 1. Setup Dependencies
```bash
# Install dependencies (including better-sqlite3 and ts-node)
yarn install
```

### 2. Verify Data Files
```bash
yarn db:verify
```

### 3. Create Database
```bash
# Creates database_new.db (keeps your existing dict_2.db safe)
yarn db:create

# Or create with custom name
DB_NAME=my_dictionary.db yarn db:create
```

### 4. Import Data
```bash
# Import all data (recommended)
yarn db:import

# Or import step by step
yarn db:import:words
# ... other importers to be added
```

### 5. Check Results
```bash
yarn db:stats
```

## 📍 **Database Location & Safety**

- **New database**: `database_new.db` (project root)
- **Your existing database**: `assets/db/dict_2.db` (untouched)
- **Custom location**: Use `DB_NAME=filename.db` before commands

## 📊 Database Schema Overview

### Core Tables
- **`words`** - Main word entries
- **`word_kanji`** - Kanji forms for words
- **`word_readings`** - Hiragana/katakana readings
- **`word_senses`** - Word meanings/senses
- **`word_glosses`** - English definitions

### Support Tables
- **`kanji`** - Individual kanji information
- **`radicals`** - Kanji radicals
- **`examples`** - Example sentences
- **`furigana`** - Pronunciation mappings

### Search Tables (FTS5)
- **`words_fts_en`** - English full-text search
- **`words_fts_jp`** - Japanese full-text search
- **`examples_fts`** - Example sentence search

### User Data Tables
- **`bookmarks`** - User bookmarks
- **`search_history`** - Search analytics
- **`study_lists`** - User study collections
- **`chats`** - AI conversation history

## 🔍 Search Capabilities

### English → Japanese
```sql
SELECT * FROM words_fts_en WHERE words_fts_en MATCH 'eat' LIMIT 10;
```

### Japanese → English
```sql
SELECT * FROM words_fts_jp WHERE words_fts_jp MATCH '食べる' LIMIT 10;
```

### Kanji Lookup
```sql
SELECT * FROM kanji WHERE character = '食';
```

### Example Sentences
```sql
SELECT * FROM examples_fts WHERE examples_fts MATCH 'delicious' LIMIT 5;
```

## 📈 Performance Optimizations

### Indexes
- FTS5 full-text search indexes
- B-tree indexes on frequently queried columns
- Composite indexes for complex queries

### Database Settings
- WAL mode for better concurrency
- Memory-mapped I/O for performance
- Optimized cache size and page size

### Query Optimization
- Prepared statements for repeated queries
- Transaction batching for bulk operations
- Strategic use of covering indexes

## 🔧 Data Import Details

### words.ljson → Dictionary Tables
- **Format**: JSON Lines (one JSON object per line)
- **Records**: ~180,000+ word entries
- **Processing**: Parse JSON, validate, insert with relationships
- **Time**: ~5-10 minutes

### kanjidic_comb_utf8 → Kanji Table
- **Format**: Custom space-separated format
- **Records**: ~6,000+ kanji characters
- **Processing**: Parse custom format, extract meanings/readings
- **Time**: ~1-2 minutes

### examples.utf → Example Sentences
- **Format**: Alternating A:/B: lines
- **Records**: ~100,000+ sentence pairs
- **Processing**: Parse alternating format, link to words
- **Time**: ~3-5 minutes

### JmdictFurigana.json → Furigana Table
- **Format**: Large JSON array
- **Records**: ~500,000+ furigana mappings
- **Processing**: Stream JSON, insert mappings
- **Time**: ~2-4 minutes

## 🎯 Integration with Existing App

### Database Location
```typescript
// In your app code
const dbPath = join(documentsDirectory, 'dictionary.db');
```

### Search Implementation
```typescript
// services/database.ts
export function searchWords(query: string, lang: 'en' | 'jp') {
  const table = lang === 'en' ? 'words_fts_en' : 'words_fts_jp';
  return db.prepare(`
    SELECT w.*, wc.kanji_forms, wc.readings, wc.glosses
    FROM ${table} fts
    JOIN word_complete wc ON fts.word_id = wc.id
    WHERE fts MATCH ?
    LIMIT 50
  `).all(query);
}
```

### Bookmark Integration
```typescript
// Existing bookmark functions can work with new schema
export function addBookmark(wordId: number, notes?: string) {
  return db.prepare(`
    INSERT INTO bookmarks (word_id, notes, user_id)
    VALUES (?, ?, 'default')
  `).run(wordId, notes);
}
```

## 📝 Migration Commands

```bash
# Database Management
yarn db:create          # Create new database with schema
yarn db:reset           # Drop and recreate database
yarn db:stats           # Show database statistics
yarn db:verify          # Verify data file availability

# Data Import
yarn db:import          # Import all data files
yarn db:import:words    # Import only words data

# Development
yarn test               # Run existing tests
ts-node scripts/migrate.ts --help  # Show help
```

## ⚡ Performance Expectations

### Database Size
- **Empty schema**: ~50KB
- **With dictionary data**: ~150-200MB
- **With all data**: ~300-400MB

### Import Time
- **Words only**: 5-10 minutes
- **Full import**: 15-25 minutes
- **Depends on**: CPU speed, disk I/O

### Query Performance
- **Simple lookups**: <1ms
- **FTS searches**: 1-10ms
- **Complex joins**: 10-50ms

## 🔄 Future Enhancements

### Additional Importers
- Kanji component relationships
- Advanced example sentence parsing
- Audio pronunciation data
- Etymology information

### Search Improvements
- Fuzzy matching for typos
- Semantic search capabilities
- Advanced filtering options
- Search result ranking

### User Features
- Spaced repetition study system
- Progress tracking
- Custom word lists
- Export capabilities

## 🐛 Troubleshooting

### Common Issues

**Database locked error**:
```bash
# Close any open database connections
# Check for processes using the database file
lsof database.db
```

**Import fails with parsing errors**:
```bash
# Check data file format
head -5 data/words.ljson
# Verify file encoding
file data/words.ljson
```

**Performance issues**:
```bash
# Check database statistics
yarn db:stats
# Analyze query performance
EXPLAIN QUERY PLAN SELECT ...
```

### Debug Mode
```bash
# Enable verbose logging
DEBUG=1 yarn db:import
```

## 📚 Additional Resources

- [SQLite FTS5 Documentation](https://www.sqlite.org/fts5.html)
- [JMdict Documentation](https://www.edrdg.org/jmdict/j_jmdict.html)
- [Kanjidic Documentation](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project)
- [Better SQLite3 Documentation](https://github.com/WiseLibs/better-sqlite3/blob/HEAD/docs/api.md)


# Data Import Strategy

## File Analysis & Import Plan

### 1. **words.ljson** → Main Dictionary Data
**Format**: JSON Lines (one JSON object per line)
```json
{"r":["ヽ"],"s":[{"g":["repetition mark in katakana"],"pos":["unc"]}]}
{"k":["〃"],"r":["おなじ","おなじく"],"s":[{"g":["ditto mark"],"pos":["n"]}]}
```

**Mapping**:
- `k` → `word_kanji` table
- `r` → `word_readings` table
- `s` → `word_senses` table
- `s.g` → `word_glosses` table
- `s.pos` → parts_of_speech in `word_senses`

**Import Priority**: 1 (Core data)

### 2. **kanjidic_comb_utf8** → Kanji Information
**Format**: Space-separated values with special markers
```
亜 3021 U4e9c B1 C7 G8 S7 XJ05033 F1509 J1 N43 V81 H3540 ... {Asia} {rank next} {come after} {-ous}
```

**Key Fields**:
- Character (亜)
- JIS code (3021)
- Unicode (U4e9c)
- Grade (G8)
- Stroke count (S7)
- Frequency (F1509)
- Meanings in braces {}

**Mapping**: → `kanji` table

**Import Priority**: 2

### 3. **examples.utf** → Example Sentences
**Format**: Alternating A:/B: lines
```
A: 彼は忙しい生活の中で家族と会うことがない。	He doesn't see his family in his busy life.#ID=303697_100000
B: 彼(かれ)[01] は 忙しい(いそがしい) 生活 の 中(なか) で(#2028980) 家族 と 会う[01] 事(こと){こと} が 無い{ない}
```

**Mapping**:
- A: line → english text in `examples`
- B: line → japanese text in `examples`
- Parse B: line for furigana data

**Import Priority**: 3

### 4. **JmdictFurigana.json** → Pronunciation Data
**Format**: Large JSON array with furigana objects
```json
[{"text":"〃","reading":"おなじ","furigana":[{"ruby":"〃","rt":"おなじ"}]}]
```

**Mapping**: → `furigana` table

**Import Priority**: 4

### 5. **Kanji Radicals Reference** CSVs → Radical Data
**Format**: Standard CSV
```csv
Radical,Radical Name,Kanji
川,River,"川 (River), 州 (State, Province, County)..."
```

**Mapping**:
- → `radicals` table
- → `kanji_radicals` table (many-to-many)

**Import Priority**: 5

### 6. **jpn_indices.csv & jpn_transcriptions.tsv** → Enhanced Search Data
**Format**: CSV/TSV with Japanese text and transcriptions

**Usage**: Enhance search capabilities and reading data

**Import Priority**: 6 (Optional)

## Import Scripts Architecture

### Directory Structure
```
scripts/
├── import/
│   ├── words-importer.ts          # Main dictionary data
│   ├── kanji-importer.ts          # Kanji information
│   ├── examples-importer.ts       # Example sentences
│   ├── furigana-importer.ts       # Furigana data
│   ├── radicals-importer.ts       # Radical data
│   └── utils/
│       ├── database.ts            # DB connection utilities
│       ├── parsers.ts             # Text parsing utilities
│       ├── validators.ts          # Data validation
│       └── progress.ts            # Progress tracking
├── migrate.ts                     # Main orchestrator script
└── package.json                   # Script dependencies
```

### Import Process Flow

1. **Database Setup**
   - Create database file
   - Run schema.sql
   - Set up indexes and FTS tables

2. **Core Data Import** (Sequential)
   - Import words.ljson → populate main dictionary tables
   - Import kanjidic → populate kanji table
   - Link words to kanji characters

3. **Enhancement Data** (Parallel)
   - Import examples.utf → populate examples tables
   - Import JmdictFurigana.json → populate furigana table
   - Import radical CSVs → populate radical tables

4. **Post-Processing**
   - Populate FTS tables from main tables
   - Generate romaji for readings
   - Create cross-references between tables
   - Validate data integrity

5. **Optimization**
   - Analyze query performance
   - Update statistics
   - Optimize indexes

### Error Handling Strategy

- **Validation**: Check data format before insertion
- **Transactions**: Use database transactions for consistency
- **Logging**: Detailed error logging with line numbers
- **Rollback**: Ability to rollback failed imports
- **Resume**: Support for resuming interrupted imports

### Performance Considerations

- **Batch Processing**: Insert data in batches (1000-5000 records)
- **Disable Triggers**: Temporarily disable FTS triggers during bulk import
- **Memory Management**: Stream large files instead of loading entirely
- **Progress Tracking**: Real-time progress updates for user feedback

### Integration with Existing Codebase

- **Yarn Scripts**: Add import commands to package.json
- **Database Location**: Use same database path as existing app
- **TypeScript**: Consistent with existing codebase
- **Error Handling**: Follow existing error handling patterns

### Commands to Add

```json
{
  "scripts": {
    "db:create": "node scripts/migrate.ts --create",
    "db:import": "node scripts/migrate.ts --import",
    "db:import:words": "node scripts/import/words-importer.ts",
    "db:import:kanji": "node scripts/import/kanji-importer.ts",
    "db:reset": "node scripts/migrate.ts --reset"
  }
}
```
