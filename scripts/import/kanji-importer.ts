#!/usr/bin/env node
/**
 * Kanji Importer - Import kanji data from kanjidic format
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseManager } from './utils/database';
import { parseKanjidicLine } from './utils/parsers';
import { ProgressTracker } from './utils/progress';

interface KanjiImportStats {
  totalLines: number;
  validEntries: number;
  insertedKanji: number;
  errors: number;
}

export class KanjiImporter {
  private db: DatabaseManager;
  private stats: KanjiImportStats = {
    totalLines: 0,
    validEntries: 0,
    insertedKanji: 0,
    errors: 0
  };

  // Prepared statement for performance
  private insertKanjiStmt: any;

  constructor(dbPath: string) {
    this.db = new DatabaseManager({ path: dbPath, verbose: false });
    this.prepareStatements();
  }

  private prepareStatements(): void {
    const conn = this.db.getConnection();

    this.insertKanjiStmt = conn.prepare(`
      INSERT INTO kanji (character, jis_code, unicode, on_readings, kun_readings, meanings, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
  }

  /**
   * Import kanji from kanjidic file
   */
  async import(filePath: string): Promise<void> {
    console.log(`📖 Starting kanji import from: ${filePath}`);

    // Read file content
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    const progress = new ProgressTracker('Importing kanji', lines.length);

    // Optimize database for bulk operations
    this.db.optimizeForBulkOperations();

    try {
      let batchCount = 0;
      const batchSize = 1000;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        this.stats.totalLines++;

        if (line.trim().length === 0 || line.startsWith('#')) {
          progress.update();
          continue;
        }

        // Parse kanjidic line
        const kanjiEntry = parseKanjidicLine(line);
        if (!kanjiEntry) {
          this.stats.errors++;
          progress.update();
          continue;
        }

        this.stats.validEntries++;

        try {
          // Insert kanji entry
          this.insertKanjiStmt.run(
            kanjiEntry.character,
            kanjiEntry.jisCode || null,
            kanjiEntry.unicode || null,
            JSON.stringify(kanjiEntry.onReadings),
            JSON.stringify(kanjiEntry.kunReadings),
            JSON.stringify(kanjiEntry.meanings)
          );
          this.stats.insertedKanji++;

        } catch (error) {
          console.error(`\nError processing kanji ${kanjiEntry.character}: ${error}`);
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
    console.log('\n📊 Kanji Import Statistics:');
    console.log(`   Total lines processed: ${this.stats.totalLines.toLocaleString()}`);
    console.log(`   Valid entries: ${this.stats.validEntries.toLocaleString()}`);
    console.log(`   Inserted kanji: ${this.stats.insertedKanji.toLocaleString()}`);
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
  const dataPath = process.argv[2] || join(__dirname, '../../data/kanjidic_comb_utf8');
  const dbPath = process.argv[3] || join(__dirname, '../../database.db');

  async function main() {
    const importer = new KanjiImporter(dbPath);

    try {
      await importer.import(dataPath);
      console.log('✅ Kanji import completed successfully');
    } catch (error) {
      console.error('❌ Kanji import failed:', error);
      process.exit(1);
    } finally {
      importer.close();
    }
  }

  main();
}