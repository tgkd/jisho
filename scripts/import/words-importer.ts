#!/usr/bin/env node
/**
 * Words Importer - Import main dictionary data from words.ljson
 */

import { createReadStream } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { DatabaseManager } from './utils/database';
import { parseWordsLJson, validateWordEntry } from './utils/parsers';
import { ProgressTracker } from './utils/progress';

interface ImportStats {
  totalLines: number;
  validEntries: number;
  insertedWords: number;
  insertedMeanings: number;
  errors: number;
}

export class WordsImporter {
  private db: DatabaseManager;
  private stats: ImportStats = {
    totalLines: 0,
    validEntries: 0,
    insertedWords: 0,
    insertedMeanings: 0,
    errors: 0
  };

  // Prepared statements for performance
  private insertWordStmt: any;
  private insertMeaningStmt: any;

  constructor(dbPath: string) {
    this.db = new DatabaseManager({ path: dbPath, verbose: false });
    this.prepareStatements();
  }

  private prepareStatements(): void {
    const conn = this.db.getConnection();

    this.insertWordStmt = conn.prepare(`
      INSERT INTO words (word, reading, reading_hiragana, kanji, position)
      VALUES (?, ?, ?, ?, ?)
    `);

    this.insertMeaningStmt = conn.prepare(`
      INSERT INTO meanings (word_id, meaning, part_of_speech, field, misc, info)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
  }

  /**
   * Count total lines in file for progress tracking
   */
  private async countLines(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let lineCount = 0;
      const rl = createInterface({
        input: createReadStream(filePath),
        crlfDelay: Infinity
      });

      rl.on('line', () => lineCount++);
      rl.on('close', () => resolve(lineCount));
      rl.on('error', reject);
    });
  }

  /**
   * Import words from ljson file
   */
  async import(filePath: string): Promise<void> {
    console.log(`📖 Starting words import from: ${filePath}`);
    
    // Count lines for progress
    const totalLines = await this.countLines(filePath);
    const progress = new ProgressTracker('Importing words', totalLines);

    // Optimize database for bulk operations
    this.db.optimizeForBulkOperations();

    try {
      const rl = createInterface({
        input: createReadStream(filePath),
        crlfDelay: Infinity
      });

      let lineNumber = 0;
      let batchCount = 0;
      const batchSize = 1000;

      for await (const line of rl) {
        lineNumber++;
        this.stats.totalLines++;

        if (line.trim().length === 0) {
          progress.update();
          continue;
        }

        // Parse line
        const entry = parseWordsLJson(line, lineNumber);
        if (!entry || !validateWordEntry(entry, lineNumber)) {
          this.stats.errors++;
          progress.update();
          continue;
        }

        this.stats.validEntries++;

        try {
          // Prepare word data from entry
          const primaryWord = entry.kanji?.[0] || entry.readings[0];
          const primaryReading = entry.readings[0];
          const kanjiForm = entry.kanji?.[0] || null;

          // Insert word entry
          const wordResult = this.insertWordStmt.run(
            primaryWord,
            primaryReading,
            primaryReading, // reading_hiragana is same as reading for now
            kanjiForm,
            lineNumber // position for search ordering
          );
          const wordId = wordResult.lastInsertRowid as number;
          this.stats.insertedWords++;

          // Insert meanings from all senses
          for (const sense of entry.senses) {
            const meaningText = sense.glosses.join('; ');
            const partsOfSpeech = sense.partsOfSpeech.join(', ');
            const fieldTags = sense.fieldTags?.join(', ') || '';
            const miscTags = sense.miscTags?.join(', ') || '';

            this.insertMeaningStmt.run(
              wordId,
              meaningText,
              partsOfSpeech,
              fieldTags,
              miscTags,
              sense.info || null
            );
            this.stats.insertedMeanings++;
          }

        } catch (error) {
          console.error(`\nError processing line ${lineNumber}: ${error}`);
          this.stats.errors++;
        }

        progress.update();

        // Commit batch periodically
        batchCount++;
        if (batchCount >= batchSize) {
          this.db.getConnection().exec('COMMIT; BEGIN TRANSACTION');
          batchCount = 0;
        }
      }

      progress.complete();

    } finally {
      // Restore normal settings
      this.db.restoreNormalSettings();
    }

    this.printStats();
  }

  /**
   * Print import statistics
   */
  private printStats(): void {
    console.log('\n📊 Import Statistics:');
    console.log(`   Total lines processed: ${this.stats.totalLines.toLocaleString()}`);
    console.log(`   Valid entries: ${this.stats.validEntries.toLocaleString()}`);
    console.log(`   Inserted words: ${this.stats.insertedWords.toLocaleString()}`);
    console.log(`   Inserted meanings: ${this.stats.insertedMeanings.toLocaleString()}`);
    console.log(`   Errors: ${this.stats.errors.toLocaleString()}`);

    if (this.stats.errors > 0) {
      const errorRate = (this.stats.errors / this.stats.totalLines * 100).toFixed(2);
      console.log(`   Error rate: ${errorRate}%`);
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// CLI execution
if (require.main === module) {
  const dataPath = process.argv[2] || join(__dirname, '../../data/words.ljson');
  const dbPath = process.argv[3] || join(__dirname, '../../database.db');

  async function main() {
    const importer = new WordsImporter(dbPath);
    
    try {
      await importer.import(dataPath);
      console.log('✅ Words import completed successfully');
    } catch (error) {
      console.error('❌ Words import failed:', error);
      process.exit(1);
    } finally {
      importer.close();
    }
  }

  main();
}