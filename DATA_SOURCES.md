# Data Sources & Update Instructions

This document describes where each data file in `data/` comes from and how to get fresh versions.

All files go into the `data/` directory (gitignored).

---

## 1. words.ljson — JMdict (Japanese-English Dictionary)

**Source:** EDRDG (Electronic Dictionary Research & Development Group)
**License:** Creative Commons Attribution-ShareAlike 3.0

The import pipeline reads `words.ljson` — a line-delimited JSON file where each line is a compact entry with readings (`r`), kanji (`k`), and senses (`s`).

### How to get an update

The upstream source is the JMdict XML file. There are two options:

**Option A — Download pre-converted JSON (recommended)**

The [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) project publishes ready-to-use JSON builds of JMdict:

1. Go to https://github.com/scriptin/jmdict-simplified/releases
2. Download the latest `jmdict-eng-*.json.tgz` (English-only)
3. Extract and convert to LJSON format (one JSON object per line) matching the schema used by `scripts/import/utils/parsers.ts`:
   ```
   {"r":["reading"],"k":["kanji"],"s":[{"g":["gloss"],"pos":["n"]}]}
   ```
4. Save as `data/words.ljson`

**Option B — Download raw XML and convert**

1. Download `JMdict_e.gz` from: http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz
2. Gunzip it into `data/JMdict_e`
3. Convert XML → LJSON using the `jm/JMdictUtil.js` utilities or write a custom converter matching the `parseWordsLJson()` format in `scripts/import/utils/parsers.ts`

### Current file

The existing `data/JMdict_e` (60 MB XML) is also present alongside the processed `words.ljson` (29 MB).

---

## 2. kanjidic_comb_utf8 — KANJIDIC (Kanji Dictionary)

**Source:** EDRDG
**License:** Creative Commons Attribution-ShareAlike 3.0

### How to get an update

1. Download from: http://ftp.edrdg.org/pub/Nihongo/kanjidic_comb_utf8.gz
2. Gunzip and save as `data/kanjidic_comb_utf8`

The file is a space-delimited text format. Each line starts with a kanji character followed by codes (JIS, Unicode, grade, stroke count), readings (katakana for on, hiragana for kun), and English meanings in `{braces}`.

The parser is `parseKanjidicLine()` in `scripts/import/utils/parsers.ts`.

**Project page:** https://www.edrdg.org/wiki/index.php/KANJIDIC_Project

---

## 3. examples.utf — Example Sentences (Tatoeba / WWWJDIC)

**Source:** Tatoeba project sentences, distributed via WWWJDIC
**License:** Creative Commons Attribution 2.0

### How to get an update

1. Download from: http://ftp.edrdg.org/pub/Nihongo/examples.utf.gz
2. Gunzip and save as `data/examples.utf`

The format uses alternating `A:` / `B:` line pairs:
- `A:` — Japanese sentence + tab + English translation + `#ID=<id>`
- `B:` — Tokenized Japanese with readings: `word(reading)[sense]{dictionary_form}`

**Project page:** https://www.edrdg.org/wiki/index.php/Sentence-Dictionary_Linking

---

## 4. JmdictFurigana.json — Furigana (Reading Annotations)

**Source:** JmdictFurigana project by Luc Stepniewski
**License:** Creative Commons Attribution-ShareAlike 3.0

### How to get an update

1. Go to: https://github.com/Doublevil/JmdictFurigana/releases
2. Download the latest `JmdictFurigana.json`
3. Save as `data/JmdictFurigana.json`

Each entry maps a surface form (text + reading) to an array of furigana segments with ruby/rt pairs.

---

## 5. edict2u — EDICT2 (Legacy, not actively imported)

**Source:** EDRDG
**Download:** http://ftp.edrdg.org/pub/Nihongo/edict2u.gz

Currently present in `data/` but not used by the import pipeline.

---

## 6. Kanji Radicals Reference CSVs (not actively imported)

- `Kanji Radicals Reference - Kanji > Radicals.csv`
- `Kanji Radicals Reference - Radicals > Kanji.csv`

These appear to be manually curated spreadsheet exports. Not currently used by the import pipeline.

---

## 7. Other files in data/ (reference only)

| File | Size | Notes |
|------|------|-------|
| `jpn_indices.csv` | 16 MB | Japanese character indices |
| `jpn_transcriptions.tsv` | 27 MB | Transcriptions data |
| `sp.tsv` | 28 MB | Supporting phonetic data |
| `words.idx` | 10 MB | Index file for words |
| `examples.json` | 2 B | Empty placeholder |

These are not used by the current import pipeline.

---

## Rebuilding the Database

After updating any data files:

```bash
# 1. Create fresh database
yarn db:create

# 2. Import all data
yarn db:import

# 3. Verify
yarn db:stats

# 4. Build seed database for the app bundle
yarn db:build
```

Or to import individual datasets:

```bash
yarn db:import:words      # words.ljson → words + meanings tables
yarn db:import:furigana   # JmdictFurigana.json → furigana table
yarn db:import:examples   # examples.utf → examples table
```

---

## Quick Reference: All Download URLs

| File | URL |
|------|-----|
| JMdict_e (XML) | http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz |
| kanjidic_comb_utf8 | http://ftp.edrdg.org/pub/Nihongo/kanjidic_comb_utf8.gz |
| examples.utf | http://ftp.edrdg.org/pub/Nihongo/examples.utf.gz |
| JmdictFurigana.json | https://github.com/Doublevil/JmdictFurigana/releases |
| jmdict-simplified (JSON) | https://github.com/scriptin/jmdict-simplified/releases |
| edict2u | http://ftp.edrdg.org/pub/Nihongo/edict2u.gz |

EDRDG files are updated regularly (roughly monthly). Check http://ftp.edrdg.org/pub/Nihongo/ for the full listing.
