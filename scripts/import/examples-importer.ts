#!/usr/bin/env node
/**
 * Examples Importer - Imports example sentences from examples.utf
 * with per-character furigana segments generated from B: line readings
 * and the furigana database table.
 */

import { createReadStream } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { isKana, isKanji, stripOkurigana, tokenize } from 'wanakana';
import { DatabaseManager } from './utils/database';
import { ProgressTracker } from './utils/progress';

interface FuriganaSegment {
  ruby: string;
  rt?: string;
}

interface ExamplesImportStats {
  totalEntries: number;
  insertedEntries: number;
  skippedEntries: number;
  errors: number;
  withFurigana: number;
  furiganaLookups: number;
}

interface ParsedExampleHeader {
  japanese: string;
  english: string;
  exampleId?: string;
}

interface ParsedToken {
  dictForm: string;
  reading?: string;
  surfaceForm?: string;
}

export class ExamplesImporter {
  private db: DatabaseManager;
  private stats: ExamplesImportStats = {
    totalEntries: 0,
    insertedEntries: 0,
    skippedEntries: 0,
    errors: 0,
    withFurigana: 0,
    furiganaLookups: 0
  };

  private insertStmt: any;
  private wordMap = new Map<string, number>();
  private furiganaMap = new Map<string, FuriganaSegment[]>();

  constructor(dbPath: string) {
    this.db = new DatabaseManager({ path: dbPath, verbose: false });
    this.prepareStatements();
  }

  private prepareStatements(): void {
    const conn = this.db.getConnection();

    this.insertStmt = conn.prepare(`
      INSERT INTO examples (japanese_text, english_text, tokens, example_id, word_id, reading)
      VALUES (@japanese_text, @english_text, @tokens, @example_id, @word_id, @reading)
    `);
  }

  private loadFuriganaTable(): void {
    console.log('   Loading furigana table...');
    const conn = this.db.getConnection();

    try {
      const rows = conn.prepare('SELECT text, segments FROM furigana').all() as Array<{ text: string; segments: string }>;

      for (const row of rows) {
        try {
          const segments = JSON.parse(row.segments) as FuriganaSegment[];
          if (segments.length > 0) {
            this.furiganaMap.set(row.text, segments);
          }
        } catch {
          // skip invalid JSON
        }
      }

      console.log(`   Loaded ${this.furiganaMap.size.toLocaleString()} furigana entries`);
    } catch {
      console.warn('   Furigana table not available, proceeding without lookups');
    }
  }

  private loadWordMap(): void {
    console.log('   Loading words table...');
    const conn = this.db.getConnection();

    const wordRows = conn.prepare('SELECT id, word FROM words').all() as Array<{ id: number; word: string }>;
    for (const row of wordRows) {
      if (row.word && !this.wordMap.has(row.word)) {
        this.wordMap.set(row.word, row.id);
      }
    }

    console.log(`   Loaded ${this.wordMap.size.toLocaleString()} words for matching`);
  }

  private async countEntries(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;
      const rl = createInterface({
        input: createReadStream(filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity
      });

      rl.on('line', (line: string) => {
        if (line.startsWith('A: ')) {
          count += 1;
        }
      });

      rl.on('error', reject);
      rl.on('close', () => resolve(count));
    });
  }

  private parseHeader(line: string, lineNumber: number): ParsedExampleHeader | null {
    const content = line.slice(3).trim();
    if (!content) {
      console.warn(`Line ${lineNumber}: Empty example header`);
      return null;
    }

    const idMatch = content.match(/#ID=([^\s]+)$/);
    let exampleId: string | undefined;
    let body = content;

    if (idMatch && typeof idMatch.index === 'number') {
      exampleId = idMatch[1];
      body = content.slice(0, idMatch.index).trim();
    }

    if (!body) {
      console.warn(`Line ${lineNumber}: Example header missing content`);
      return null;
    }

    let japanese = '';
    let english = '';

    const parts = body.split(/[\t]{1,}|\s{2,}/).filter(Boolean);

    if (parts.length === 0) {
      console.warn(`Line ${lineNumber}: Could not split header into fields`);
      return null;
    }

    japanese = parts[0].trim();
    english = parts.slice(1).join(' ').trim();

    if (!japanese) {
      console.warn(`Line ${lineNumber}: Missing Japanese text`);
      return null;
    }

    if (!english) {
      console.warn(`Line ${lineNumber}: Missing English translation for example "${japanese}"`);
      english = '';
    }

    return {
      japanese,
      english,
      exampleId
    };
  }

  /**
   * Parse a single B: line token like `彼(かれ)[01]` or `忙しい(いそがしい){忙しかった}`
   */
  private static parseToken(token: string): ParsedToken | null {
    if (!token.trim()) return null;

    let remaining = token;

    // Extract surface form from {braces}
    let surfaceForm: string | undefined;
    const braceMatch = remaining.match(/\{([^}]+)\}/);
    if (braceMatch) {
      surfaceForm = braceMatch[1];
      remaining = remaining.replace(/\{[^}]+\}/, '');
    }

    // Remove ~ compound markers
    remaining = remaining.replace(/~/g, '');

    // Extract reading from (parens)
    let reading: string | undefined;
    const readingMatch = remaining.match(/\(([^)]+)\)/);
    if (readingMatch) {
      const readingVal = readingMatch[1];
      // Skip non-reading parens like (#2028980)
      if (!readingVal.startsWith('#')) {
        reading = readingVal;
      }
      remaining = remaining.replace(/\([^)]+\)/g, '');
    }

    // Remove [bracket] sense numbers
    remaining = remaining.replace(/\[[^\]]*\]/g, '');

    // Remove # references
    remaining = remaining.replace(/#\d+/g, '');

    const dictForm = remaining.trim();
    if (!dictForm) return null;

    return { dictForm, reading, surfaceForm };
  }

  /**
   * Derive a conjugated reading from the dictionary reading + surface form.
   * Finds the common prefix between dict form and surface form, then swaps the suffix.
   */
  private static deriveConjugatedReading(dictForm: string, reading: string, surfaceForm: string): string {
    // Find common character prefix
    let common = 0;
    while (common < dictForm.length && common < surfaceForm.length && dictForm[common] === surfaceForm[common]) {
      common++;
    }

    const dictSuffix = dictForm.slice(common);
    const surfaceSuffix = surfaceForm.slice(common);

    if (dictSuffix === '') {
      // Surface just appends to dict form (e.g., 私 -> 私の)
      return reading + surfaceSuffix;
    }

    if (reading.endsWith(dictSuffix)) {
      // Remove dict okurigana, add surface okurigana
      return reading.slice(0, -dictSuffix.length) + surfaceSuffix;
    }

    // Fallback: can't derive, return original reading
    return reading;
  }

  /**
   * Generate per-character furigana pairs from a word and its reading.
   * Mirrors basicFuri from services/parse.ts.
   */
  private static basicFuri(word: string, reading: string): FuriganaSegment[] {
    const chars = [...word];

    // All kana — no furigana needed
    if (chars.every(c => isKana(c))) {
      return [{ ruby: word }];
    }

    // All kanji — single block
    if (chars.every(c => isKanji(c))) {
      return [{ ruby: word, rt: reading }];
    }

    // Mixed: split using wanakana tokenize + regex matching
    const bikago = reading.slice(
      0,
      word.length - stripOkurigana(word, { leading: true, matchKanji: undefined } as any).length
    );
    const okurigana = reading.slice(
      stripOkurigana(reading, { matchKanji: word, leading: undefined } as any).length
    );

    const innerWord = bikago ? word.slice(bikago.length) : word;
    const innerWordTrimmed = okurigana ? innerWord.slice(0, -okurigana.length || undefined) : innerWord;
    const innerReading = reading.slice(bikago.length, okurigana ? -okurigana.length || undefined : undefined);

    const innerWordTokens = tokenize(innerWordTrimmed);

    const kanjiOddKanaEvenRegex = RegExp(
      innerWordTokens
        .map((c) => (isKanji(c as string) ? '(.*)' : `(${c})`))
        .join('')
    );

    const matchResult = innerReading.match(kanjiOddKanaEvenRegex) || [];
    const innerReadingChars = matchResult.slice(1);

    const segments: FuriganaSegment[] = [];

    if (bikago) {
      segments.push({ ruby: bikago });
    }

    for (let i = 0; i < innerWordTokens.length; i++) {
      const wordPart = innerWordTokens[i] as string;
      const readingPart = innerReadingChars[i];

      if (!readingPart || readingPart === wordPart) {
        segments.push({ ruby: wordPart });
      } else {
        segments.push({ ruby: wordPart, rt: readingPart });
      }
    }

    if (okurigana) {
      segments.push({ ruby: okurigana });
    }

    return segments;
  }

  /**
   * Generate furigana segments for a single parsed token.
   */
  private generateTokenSegments(token: ParsedToken): FuriganaSegment[] {
    const surface = token.surfaceForm ?? token.dictForm;

    // Pure kana surface — no furigana needed
    if ([...surface].every(c => isKana(c))) {
      return [{ ruby: surface }];
    }

    // Determine reading: use provided reading, or look up in furigana table
    let reading = token.reading;

    if (!reading) {
      const furiSegments = this.furiganaMap.get(token.dictForm);
      if (furiSegments) {
        this.stats.furiganaLookups++;

        // If no conjugation, use precomputed segments directly
        if (!token.surfaceForm || token.surfaceForm === token.dictForm) {
          return furiSegments;
        }

        // Derive reading from segments for conjugation handling
        reading = furiSegments.map(s => s.rt || s.ruby).join('');
      }
    }

    if (!reading) {
      // No reading available — return surface without furigana
      return [{ ruby: surface }];
    }

    // Handle conjugated surface forms
    let effectiveReading = reading;
    if (token.surfaceForm && token.surfaceForm !== token.dictForm) {
      effectiveReading = ExamplesImporter.deriveConjugatedReading(token.dictForm, reading, token.surfaceForm);
    }

    // Generate per-character furigana
    try {
      return ExamplesImporter.basicFuri(surface, effectiveReading);
    } catch {
      // Fallback: whole-word furigana
      return [{ ruby: surface, rt: effectiveReading }];
    }
  }

  /**
   * Reconcile segments against the original sentence text.
   * Inserts missing characters (punctuation, names, numbers) that aren't in B: line tokens.
   */
  private static reconcileSegments(originalText: string, segments: FuriganaSegment[]): FuriganaSegment[] {
    const segmentText = segments.map(s => s.ruby).join('');
    if (segmentText === originalText) return segments;

    const result: FuriganaSegment[] = [];
    let oi = 0; // original text index
    let si = 0; // segment char index
    let segIdx = 0; // current segment index
    let segCharOffset = 0; // offset within current segment's ruby

    while (oi < originalText.length) {
      // Current segment ruby character
      const segChar = segIdx < segments.length ? segments[segIdx].ruby[segCharOffset] : undefined;

      if (segChar !== undefined && originalText[oi] === segChar) {
        // Characters match — emit current segment when we reach its start
        if (segCharOffset === 0) {
          result.push(segments[segIdx]);
        }
        // Advance through this segment's ruby chars
        segCharOffset++;
        if (segCharOffset >= segments[segIdx].ruby.length) {
          segIdx++;
          segCharOffset = 0;
        }
        oi++;
      } else {
        // Mismatch — collect consecutive missing chars from original
        let missing = '';
        while (oi < originalText.length) {
          const nextSegChar = segIdx < segments.length ? segments[segIdx].ruby[segCharOffset] : undefined;
          if (nextSegChar !== undefined && originalText[oi] === nextSegChar) break;
          missing += originalText[oi];
          oi++;
        }
        if (missing) {
          result.push({ ruby: missing });
        }
      }
    }

    return result;
  }

  /**
   * Parse B: line into furigana segments and extract dictionary forms for word linking.
   */
  private parseBLine(line: string, japaneseText: string): { segments: FuriganaSegment[]; dictForms: string[] } | null {
    const raw = line.slice(3).trim();
    if (!raw) return null;

    const parts = raw.split(/\s+/);
    const allSegments: FuriganaSegment[] = [];
    const dictForms: string[] = [];

    for (const part of parts) {
      const token = ExamplesImporter.parseToken(part);
      if (!token) continue;

      dictForms.push(token.dictForm);

      const segments = this.generateTokenSegments(token);
      allSegments.push(...segments);
    }

    if (allSegments.length === 0) return null;

    const reconciled = ExamplesImporter.reconcileSegments(japaneseText, allSegments);

    return { segments: reconciled, dictForms };
  }

  /**
   * Find the first matching word_id from dictionary forms.
   */
  private findWordId(dictForms: string[]): number | null {
    for (const form of dictForms) {
      const wordId = this.wordMap.get(form);
      if (wordId !== undefined) {
        return wordId;
      }
    }
    return null;
  }

  private resetExamplesTable(): void {
    this.db.getConnection().exec('DELETE FROM examples');
  }

  async import(filePath: string): Promise<void> {
    console.log(`\nStarting examples import from: ${filePath}`);

    this.loadFuriganaTable();
    this.loadWordMap();

    const totalEntries = await this.countEntries(filePath);
    this.stats.totalEntries = totalEntries;
    const progress = new ProgressTracker('Importing examples', Math.max(totalEntries, 1));

    this.resetExamplesTable();
    this.db.optimizeForBulkOperations();

    let pendingHeader: ParsedExampleHeader | null = null;
    let processedEntries = 0;
    let batchCount = 0;
    const batchSize = 1000;

    try {
      const rl = createInterface({
        input: createReadStream(filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity
      });

      let lineNumber = 0;

      for await (const rawLine of rl) {
        lineNumber += 1;
        const line = rawLine.trimEnd();

        if (line.length === 0) {
          continue;
        }

        if (line.startsWith('A: ')) {
          const parsed = this.parseHeader(line, lineNumber);
          if (parsed) {
            pendingHeader = parsed;
          } else {
            pendingHeader = null;
            this.stats.errors += 1;
          }
          continue;
        }

        if (line.startsWith('B: ')) {
          if (!pendingHeader) {
            console.warn(`Line ${lineNumber}: Token line encountered without preceding header`);
            this.stats.skippedEntries += 1;
            continue;
          }

          const result = this.parseBLine(line, pendingHeader.japanese);
          if (!result) {
            this.stats.errors += 1;
            pendingHeader = null;
            progress.update();
            continue;
          }

          const { segments, dictForms } = result;
          const wordId = this.findWordId(dictForms);

          const hasAnyFurigana = segments.some(s => s.rt);
          if (hasAnyFurigana) {
            this.stats.withFurigana++;
          }

          // Derive full reading from segments
          const reading = segments
            .map(s => s.rt || s.ruby)
            .join('');

          try {
            this.insertStmt.run({
              japanese_text: pendingHeader.japanese,
              english_text: pendingHeader.english,
              tokens: JSON.stringify(segments),
              example_id: pendingHeader.exampleId ?? null,
              word_id: wordId,
              reading
            });

            this.stats.insertedEntries += 1;
            processedEntries += 1;
          } catch (error) {
            console.error(`Error inserting example at line ${lineNumber}:`, error);
            this.stats.errors += 1;
          }

          pendingHeader = null;
          progress.update();

          batchCount += 1;
          if (batchCount >= batchSize) {
            this.db.getConnection().exec('COMMIT; BEGIN TRANSACTION');
            batchCount = 0;
          }

          continue;
        }
      }

      if (pendingHeader) {
        console.warn('File ended before tokens line for the final example.');
        this.stats.skippedEntries += 1;
        progress.update();
      }

      progress.complete();
    } finally {
      this.db.restoreNormalSettings();
    }

    this.printStats(processedEntries);
  }

  private printStats(processed: number): void {
    console.log('\nExamples Import Statistics:');
    console.log(`   Total entries discovered: ${this.stats.totalEntries.toLocaleString()}`);
    console.log(`   Inserted entries: ${this.stats.insertedEntries.toLocaleString()}`);
    console.log(`   With furigana: ${this.stats.withFurigana.toLocaleString()}`);
    console.log(`   Furigana DB lookups used: ${this.stats.furiganaLookups.toLocaleString()}`);
    console.log(`   Skipped entries: ${this.stats.skippedEntries.toLocaleString()}`);
    console.log(`   Errors: ${this.stats.errors.toLocaleString()}`);

    if (processed !== this.stats.totalEntries) {
      const difference = this.stats.totalEntries - processed;
      if (difference > 0) {
        console.log(`   Note: ${difference.toLocaleString()} entries were not fully processed (see warnings above).`);
      }
    }
  }

  close(): void {
    this.db.close();
  }
}

if (require.main === module) {
  const dataPath = process.argv[2] || join(__dirname, '../../data/examples.utf');
  const dbPath = process.argv[3] || join(__dirname, '../../database.db');

  async function main() {
    const importer = new ExamplesImporter(dbPath);

    try {
      await importer.import(dataPath);
      console.log('Examples import completed successfully');
    } catch (error) {
      console.error('Examples import failed:', error);
      process.exit(1);
    } finally {
      importer.close();
    }
  }

  void main();
}
