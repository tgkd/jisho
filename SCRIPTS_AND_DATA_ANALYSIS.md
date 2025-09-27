# Scripts and Data Analysis Report

## Overview
This report describes the schema of data files in `./data` directory for the Jisho Japanese dictionary app.

## Data Files Analysis (`./data`)

### Primary Data Sources

#### 1. **`words.ljson`** - Line-delimited JSON format
```json
{"r":["ヽ"],"s":[{"g":["repetition mark in katakana"],"pos":["unc"]}]}
```
**Schema**:
- `r`: Array of readings (hiragana/katakana)
- `k`: Array of kanji forms (optional)
- `s`: Array of senses/meanings
  - `g`: Array of glosses (English definitions)
  - `pos`: Array of parts of speech
  - `field`: Field tags (optional)
  - `misc`: Miscellaneous tags (optional)
  - `gt`: Gloss type (optional)

#### 2. **`words.idx`** - Index mapping
```
Α,322139
Β,1283573
```
**Schema**: `word,position` - Maps words to their position/priority for search results

#### 3. **`kanjidic_comb_utf8`** - Kanji dictionary
```
亜 3021 U4e9c B1 C7 G8 S7 XJ05033 F1509 J1 N43 V81 H3540...
```
**Schema**: Space-separated format
- Character, JIS code, Unicode, metadata codes
- `{meaning}` - English meanings in braces
- Various coded information (grade, stroke count, frequency, etc.)

#### 4. **`examples.utf`** - Example sentences
```
A: 彼は忙しい生活の中で家族と会うことがない。   He doesn't see his family in his busy life.#ID=303697_100000
B: 彼(かれ)[01] は 忙しい(いそがしい) 生活 の 中(なか) で(#2028980) 家族 と 会う[01] 事(こと){こと} が 無い{ない}
```
**Schema**:
- `A:` lines: Plain Japanese sentence, followed by two or more spaces and an English translation, ending with `#ID=<identifier>`
- `B:` lines: Tokenized/parsed Japanese with readings and annotations (stored as-is for downstream parsing)

### Secondary Data Sources

#### 5. **`JmdictFurigana.json`** - Furigana mappings
```json
{"text":"〃","reading":"おなじ","furigana":[{"ruby":"〃","rt":"おなじ"}]}
```
**Schema**:
- `text`: Original text with kanji
- `reading`: Full reading in kana
- `furigana`: Array of ruby notation objects
  - `ruby`: Text segment
  - `rt`: Reading for that segment (optional)

#### 6. **`jpn_transcriptions.tsv`** - Annotated Japanese sentences
```
4573111	jpn	Hrkt	gillux	ギター[弾|ひ]けるようになりたい。
```
**Schema**: TSV format
- Sentence ID, language code, script type, username, transcription with furigana brackets

#### 7. **`sp.tsv`** - Simple parallel corpus
```
1297	きみにちょっとしたものをもってきたよ。	4724	I brought you a little something.
```
**Schema**: TSV format
- Japanese sentence ID, Japanese text, English sentence ID, English text

#### 8. **`Kanji Radicals Reference - Kanji > Radicals.csv`**
```csv
Kanji,Meaning,Radicals
大,Big,Big
人,Person,Person
```
**Schema**: CSV format with kanji character, English meaning, radical components

### Unused/Legacy Data Sources

#### 9. **`JMdict_e`** - XML dictionary (not used)
- Original JMdict XML format
- Superseded by words.ljson processing

#### 10. **`JmdictFurigana.txt`** - Alternative furigana format (not used)
- Pipe-delimited format: `text|reading|furigana_mapping`

#### 11. **`edict2u`** - Legacy EDICT format (not used)
- Old dictionary format with specific encoding

#### 12. **`examples.json`** - Empty file
- No content, likely placeholder

#### 13. **`jpn_indices.csv`** - Alternative indexing (not used)
- Different indexing approach from words.idx

## TODO Tasks

### Required Implementations
1. **Examples Import**: ✅ Example sentences importer streams `examples.utf` via `scripts/import/examples-importer.ts`
2. **Furigana Integration**: ✅ Furigana data is now imported via `scripts/migrate.ts` using `JmdictFurigana.json`
3. **Search Optimization**: Integrate `words.idx` for search result ordering
