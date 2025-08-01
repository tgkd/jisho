#!/usr/bin/env node
/**
 * Words Importer - Import main dictionary data from words.ljson
 */

import { createReadStream } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { DatabaseManager } from './utils/database';
import { hiraganaToRomaji, parseWordsLJson, validateWordEntry } from './utils/parsers';
import { ProgressTracker } from './utils/progress';

interface ImportStats {
  totalLines: number;
  validEntries: number;
  insertedWords: number;
  insertedKanji: number;
  insertedReadings: number;
  insertedSenses: number;
  insertedGlosses: number;
  errors: number;
}

export class WordsImporter {
  private db: DatabaseManager;
  private stats: ImportStats = {
    totalLines: 0,
    validEntries: 0,
    insertedWords: 0,
    insertedKanji: 0,
    insertedReadings: 0,
    insertedSenses: 0,
    insertedGlosses: 0,
    errors: 0
  };

  // Prepared statements for performance
  private insertWordStmt: any;
  private insertKanjiStmt: any;
  private insertReadingStmt: any;
  private insertSenseStmt: any;
  private insertGlossStmt: any;

  constructor(dbPath: string) {
    this.db = new DatabaseManager({ path: dbPath, verbose: false });
    this.prepareStatements();
  }

  private prepareStatements(): void {
    const conn = this.db.getConnection();
    
    this.insertWordStmt = conn.prepare(`
      INSERT INTO words (entry_id, sequence, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `);

    this.insertKanjiStmt = conn.prepare(`
      INSERT INTO word_kanji (word_id, kanji, info_tags, priorities)
      VALUES (?, ?, ?, ?)
    `);

    this.insertReadingStmt = conn.prepare(`
      INSERT INTO word_readings (word_id, reading, romaji, info_tags, priorities, restrict_kanji)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    this.insertSenseStmt = conn.prepare(`
      INSERT INTO word_senses (word_id, sense_order, parts_of_speech, field_tags, misc_tags, dialect_tags, info)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertGlossStmt = conn.prepare(`
      INSERT INTO word_glosses (sense_id, gloss, gloss_type, gender, gloss_order)
      VALUES (?, ?, ?, ?, ?)
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
          // Insert word entry
          const wordResult = this.insertWordStmt.run(lineNumber, lineNumber);
          const wordId = wordResult.lastInsertRowid as number;
          this.stats.insertedWords++;

          // Insert kanji forms
          if (entry.kanji) {
            for (const kanji of entry.kanji) {
              this.insertKanjiStmt.run(wordId, kanji, null, null);
              this.stats.insertedKanji++;
            }
          }

          // Insert readings
          for (const reading of entry.readings) {
            const romaji = hiraganaToRomaji(reading);
            this.insertReadingStmt.run(wordId, reading, romaji, null, null, null);
            this.stats.insertedReadings++;
          }

          // Insert senses and glosses
          for (let senseIndex = 0; senseIndex < entry.senses.length; senseIndex++) {
            const sense = entry.senses[senseIndex];
            
            const senseResult = this.insertSenseStmt.run(
              wordId,
              senseIndex + 1,
              JSON.stringify(sense.partsOfSpeech),
              JSON.stringify(sense.fieldTags || []),
              JSON.stringify(sense.miscTags || []),
              null, // dialect_tags
              sense.info
            );
            
            const senseId = senseResult.lastInsertRowid as number;
            this.stats.insertedSenses++;

            // Insert glosses
            for (let glossIndex = 0; glossIndex < sense.glosses.length; glossIndex++) {
              const gloss = sense.glosses[glossIndex];
              this.insertGlossStmt.run(
                senseId,
                gloss,
                sense.glossType?.toString(),
                null, // gender
                glossIndex + 1
              );
              this.stats.insertedGlosses++;
            }
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
    console.log(`   Inserted kanji forms: ${this.stats.insertedKanji.toLocaleString()}`);
    console.log(`   Inserted readings: ${this.stats.insertedReadings.toLocaleString()}`);
    console.log(`   Inserted senses: ${this.stats.insertedSenses.toLocaleString()}`);
    console.log(`   Inserted glosses: ${this.stats.insertedGlosses.toLocaleString()}`);
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