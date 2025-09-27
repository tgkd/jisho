#!/usr/bin/env node
/**
 * Examples Importer - Imports example sentences from examples.utf
 */

import { createReadStream } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { DatabaseManager } from './utils/database';
import { ProgressTracker } from './utils/progress';
import type { ExampleEntry } from './utils/parsers';

interface ExamplesImportStats {
  totalEntries: number;
  insertedEntries: number;
  skippedEntries: number;
  errors: number;
}

interface ParsedExampleHeader {
  japanese: string;
  english: string;
  exampleId?: string;
}

export class ExamplesImporter {
  private db: DatabaseManager;
  private stats: ExamplesImportStats = {
    totalEntries: 0,
    insertedEntries: 0,
    skippedEntries: 0,
    errors: 0
  };

  private insertStmt: any;

  constructor(dbPath: string) {
    this.db = new DatabaseManager({ path: dbPath, verbose: false });
    this.prepareStatements();
  }

  private prepareStatements(): void {
    const conn = this.db.getConnection();

    this.insertStmt = conn.prepare(`
      INSERT INTO examples (japanese_text, english_text, tokens, example_id, word_id)
      VALUES (@japanese_text, @english_text, @tokens, @example_id, NULL)
    `);
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

  private parseTokens(line: string, lineNumber: number): string | null {
    const tokens = line.slice(3).trim();

    if (!tokens) {
      console.warn(`Line ${lineNumber}: Empty token line`);
      return null;
    }

    return tokens;
  }

  private toExample(header: ParsedExampleHeader, tokens: string): ExampleEntry {
    return {
      japanese: header.japanese,
      english: header.english,
      japaneseParsed: tokens,
      id: header.exampleId
    };
  }

  private resetExamplesTable(): void {
    this.db.getConnection().exec('DELETE FROM examples');
  }

  async import(filePath: string): Promise<void> {
    console.log(`📝 Starting examples import from: ${filePath}`);

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

          const tokens = this.parseTokens(line, lineNumber);
          if (!tokens) {
            this.stats.errors += 1;
            pendingHeader = null;
            progress.update();
            continue;
          }

          const example = this.toExample(pendingHeader, tokens);

          try {
            this.insertStmt.run({
              japanese_text: example.japanese,
              english_text: example.english,
              tokens: example.japaneseParsed,
              example_id: example.id ?? null
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
    console.log('\n📊 Examples Import Statistics:');
    console.log(`   Total entries discovered: ${this.stats.totalEntries.toLocaleString()}`);
    console.log(`   Inserted entries: ${this.stats.insertedEntries.toLocaleString()}`);
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
      console.log('✅ Examples import completed successfully');
    } catch (error) {
      console.error('❌ Examples import failed:', error);
      process.exit(1);
    } finally {
      importer.close();
    }
  }

  void main();
}
