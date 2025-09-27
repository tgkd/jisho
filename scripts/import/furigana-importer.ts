#!/usr/bin/env node
/**
 * Furigana Importer - Imports furigana data from JmdictFurigana.json
 */

import { createReadStream } from 'fs';
import { join } from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { DatabaseManager } from './utils/database';
import { normalizeJapanese, parseFuriganaJson } from './utils/parsers';
import JSONStream from 'JSONStream';

interface FuriganaImportStats {
  totalEntries: number;
  validEntries: number;
  insertedEntries: number;
  updatedEntries: number;
  skippedEntries: number;
  errors: number;
}

interface FuriganaSegment {
  ruby: string;
  rt?: string;
}

interface PreparedFuriganaEntry {
  text: string;
  reading: string;
  normalizedReading: string;
  segments: FuriganaSegment[];
}

export class FuriganaImporter {
  private db: DatabaseManager;
  private stats: FuriganaImportStats = {
    totalEntries: 0,
    validEntries: 0,
    insertedEntries: 0,
    updatedEntries: 0,
    skippedEntries: 0,
    errors: 0
  };

  private upsertStmt: any;

  constructor(dbPath: string) {
    this.db = new DatabaseManager({ path: dbPath, verbose: false });
    this.prepareStatements();
  }

  private prepareStatements(): void {
    const conn = this.db.getConnection();

    this.upsertStmt = conn.prepare(`
      INSERT INTO furigana (text, reading, reading_hiragana, segments)
      VALUES (@text, @reading, @normalizedReading, @segments)
      ON CONFLICT(text, reading)
      DO UPDATE SET
        reading_hiragana = excluded.reading_hiragana,
        segments = excluded.segments
    `);
  }

  private toPreparedEntry(entry: ReturnType<typeof parseFuriganaJson>): PreparedFuriganaEntry | null {
    if (!entry) {
      return null;
    }

    return {
      text: entry.text,
      reading: entry.reading,
      normalizedReading: normalizeJapanese(entry.reading),
      segments: entry.ruby
    };
  }

  private async importFromStream(filePath: string): Promise<void> {
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const parser = JSONStream.parse('*');
    const stripBomTransform = new StripBomTransform();

    let lastLogTime = Date.now();

    this.db.optimizeForBulkOperations();

    try {
      let batchCount = 0;
      const batchSize = 5000;

      parser.on('data', (data: unknown) => {
        this.stats.totalEntries++;

        const parsed = parseFuriganaJson(data, this.stats.totalEntries);
        if (!parsed) {
          this.stats.errors++;
          return;
        }

        this.stats.validEntries++;

        const prepared = this.toPreparedEntry(parsed);
        if (!prepared) {
          this.stats.errors++;
          return;
        }

        try {
          const result = this.upsertStmt.run({
            text: prepared.text,
            reading: prepared.reading,
            normalizedReading: prepared.normalizedReading,
            segments: JSON.stringify(prepared.segments)
          });

          if (result.changes === 1 && result.lastInsertRowid !== undefined) {
            this.stats.insertedEntries++;
          } else if (result.changes === 1) {
            this.stats.updatedEntries++;
          } else {
            this.stats.skippedEntries++;
          }
        } catch (error) {
          console.error(`Error inserting furigana for "${prepared.text}":`, error);
          this.stats.errors++;
        }

        batchCount++;
        if (batchCount >= batchSize) {
          this.db.getConnection().exec('COMMIT; BEGIN TRANSACTION');
          batchCount = 0;
        }

        if (this.stats.totalEntries % 5000 === 0 || Date.now() - lastLogTime >= 5000) {
          console.log(`...processed ${this.stats.totalEntries.toLocaleString()} furigana entries so far`);
          lastLogTime = Date.now();
        }
      });

  await pipeline(stream, stripBomTransform, parser);

      console.log(`Finished streaming ${this.stats.totalEntries.toLocaleString()} furigana entries.`);
    } finally {
      this.db.restoreNormalSettings();
    }
  }

  async import(filePath: string): Promise<void> {
    console.log(`🈁 Starting furigana import from: ${filePath}`);

    await this.importFromStream(filePath);

    this.printStats();
  }

  private printStats(): void {
    console.log('\n📊 Furigana Import Statistics:');
    console.log(`   Total entries processed: ${this.stats.totalEntries.toLocaleString()}`);
    console.log(`   Valid entries: ${this.stats.validEntries.toLocaleString()}`);
    console.log(`   Inserted entries: ${this.stats.insertedEntries.toLocaleString()}`);
    console.log(`   Updated entries: ${this.stats.updatedEntries.toLocaleString()}`);
    console.log(`   Skipped entries: ${this.stats.skippedEntries.toLocaleString()}`);
    console.log(`   Errors: ${this.stats.errors.toLocaleString()}`);
  }

  close(): void {
    this.db.close();
  }
}

class StripBomTransform extends Transform {
  private isFirstChunk = true;

  override _transform(chunk: Buffer | string, encoding: BufferEncoding, callback: (error?: Error | null, data?: unknown) => void): void {
    let processedChunk = chunk;

    if (this.isFirstChunk) {
      this.isFirstChunk = false;

      if (typeof processedChunk === 'string') {
        if (processedChunk.charCodeAt(0) === 0xfeff) {
          processedChunk = processedChunk.slice(1);
        }
      } else if (Buffer.isBuffer(processedChunk)) {
        if (processedChunk.length >= 3 && processedChunk[0] === 0xef && processedChunk[1] === 0xbb && processedChunk[2] === 0xbf) {
          processedChunk = processedChunk.subarray(3);
        }
      }
    }

    this.push(processedChunk, encoding);
    callback();
  }
}

if (require.main === module) {
  const dataPath = process.argv[2] || join(__dirname, '../../data/JmdictFurigana.json');
  const dbPath = process.argv[3] || join(__dirname, '../../database.db');

  async function main() {
    const importer = new FuriganaImporter(dbPath);

    try {
      await importer.import(dataPath);
      console.log('✅ Furigana import completed successfully');
    } catch (error) {
      console.error('❌ Furigana import failed:', error);
      process.exit(1);
    } finally {
      importer.close();
    }
  }

  main();
}
