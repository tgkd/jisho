#!/usr/bin/env node
/**
 * Database Migration and Import Orchestrator
 *
 * Commands:
 *   --create: Create new database with schema
 *   --import: Import all data files
 *   --import-words: Import only words data
 *   --reset: Drop and recreate database
 *   --stats: Show database statistics
 */

import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { DatabaseManager } from './import/utils/database';
import { WordsImporter } from './import/words-importer';

interface MigrationConfig {
  dbPath: string;
  dataDir: string;
  schemaPath: string;
}

class DatabaseMigrator {
  private config: MigrationConfig;

  constructor() {
    // Allow custom database path via environment variable or use default
    const dbName = process.env.DB_NAME || 'database_new.db';

    this.config = {
      dbPath: join(__dirname, '..', dbName),
      dataDir: join(__dirname, '../data'),
      schemaPath: join(__dirname, '../schema.sql')
    };
  }

  /**
   * Create new database with schema
   */
  async createDatabase(): Promise<void> {
    console.log('🗄️  Creating new database...');

    // Remove existing database if it exists
    if (existsSync(this.config.dbPath)) {
      console.log('📁 Removing existing database...');
      unlinkSync(this.config.dbPath);
    }

    const db = new DatabaseManager({ path: this.config.dbPath });

    try {
      await db.initializeSchema(this.config.schemaPath);
      console.log(`✅ Database created at: ${this.config.dbPath}`);
    } finally {
      db.close();
    }
  }

  /**
   * Import all data files
   */
  async importData(): Promise<void> {
    console.log('📥 Starting data import process...');

    const db = new DatabaseManager({ path: this.config.dbPath });

    if (!db.isInitialized()) {
      console.log('⚠️  Database not initialized. Creating schema first...');
      await db.initializeSchema(this.config.schemaPath);
    }

    db.close();

    // Import in order of dependency
    await this.importWords();
    // TODO: Add other importers
    // await this.importKanji();
    // await this.importExamples();
    // await this.importFurigana();
    // await this.importRadicals();

    await this.updateFTSTables();

    console.log('🎉 Data import completed successfully!');
  }

  /**
   * Import words data only
   */
  async importWords(): Promise<void> {
    const wordsPath = join(this.config.dataDir, 'words.ljson');

    if (!existsSync(wordsPath)) {
      console.error(`❌ Words file not found: ${wordsPath}`);
      return;
    }

    const importer = new WordsImporter(this.config.dbPath);

    try {
      await importer.import(wordsPath);
    } finally {
      importer.close();
    }
  }

  /**
   * Update full-text search tables
   */
  async updateFTSTables(): Promise<void> {
    console.log('🔍 Updating full-text search tables...');

    const db = new DatabaseManager({ path: this.config.dbPath });

    try {
      db.updateFTSTables();
    } finally {
      db.close();
    }
  }

  /**
   * Show database statistics
   */
  async showStats(): Promise<void> {
    if (!existsSync(this.config.dbPath)) {
      console.log('❌ Database does not exist');
      return;
    }

    const db = new DatabaseManager({ path: this.config.dbPath });

    try {
      const stats = db.getStats();

      console.log('📊 Database Statistics:');
      console.log(`   Database file: ${this.config.dbPath}`);
      console.log(`   Words: ${stats.words?.toLocaleString() || 0}`);
      console.log(`   Kanji forms: ${stats.word_kanji?.toLocaleString() || 0}`);
      console.log(`   Readings: ${stats.word_readings?.toLocaleString() || 0}`);
      console.log(`   Senses: ${stats.word_senses?.toLocaleString() || 0}`);
      console.log(`   Glosses: ${stats.word_glosses?.toLocaleString() || 0}`);
      console.log(`   Kanji: ${stats.kanji?.toLocaleString() || 0}`);
      console.log(`   Examples: ${stats.examples?.toLocaleString() || 0}`);
      console.log(`   Furigana: ${stats.furigana?.toLocaleString() || 0}`);

      // Calculate file size
      const fs = await import('fs');
      const stats_fs = fs.statSync(this.config.dbPath);
      const sizeInMB = (stats_fs.size / (1024 * 1024)).toFixed(2);
      console.log(`   Database size: ${sizeInMB} MB`);

    } finally {
      db.close();
    }
  }

  /**
   * Reset database (drop and recreate)
   */
  async resetDatabase(): Promise<void> {
    console.log('🗑️  Resetting database...');
    await this.createDatabase();
    console.log('✅ Database reset completed');
  }

  /**
   * Verify data file paths
   */
  private verifyDataFiles(): void {
    const requiredFiles = [
      'words.ljson',
      'kanjidic_comb_utf8',
      'examples.utf',
      'JmdictFurigana.json'
    ];

    console.log('🔍 Verifying data files...');

    for (const file of requiredFiles) {
      const filePath = join(this.config.dataDir, file);
      if (existsSync(filePath)) {
        console.log(`   ✅ ${file}`);
      } else {
        console.log(`   ❌ ${file} (missing)`);
      }
    }
  }

  /**
   * Run migration based on command line arguments
   */
  async run(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      this.showHelp();
      return;
    }

    const command = args[0];

    try {
      switch (command) {
        case '--create':
          await this.createDatabase();
          break;

        case '--import':
          await this.importData();
          break;

        case '--import-words':
          await this.importWords();
          break;

        case '--reset':
          await this.resetDatabase();
          break;

        case '--stats':
          await this.showStats();
          break;

        case '--verify':
          this.verifyDataFiles();
          break;

        case '--help':
        case '-h':
          this.showHelp();
          break;

        default:
          console.error(`❌ Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log(`
📖 Database Migration Tool

Usage: node scripts/migrate.ts [command]
       yarn db:[command]

Database location: ${this.config.dbPath}
Custom database: DB_NAME=my_database.db yarn db:create

Commands:
  --create        Create new database with schema
  --import        Import all data files (full import)
  --import-words  Import only words data
  --reset         Drop and recreate database
  --stats         Show database statistics
  --verify        Verify data file availability
  --help, -h      Show this help message

Examples:
  yarn db:create                    # Create database_new.db
  yarn db:import                    # Import all data
  yarn db:stats                     # Show statistics
  DB_NAME=test.db yarn db:create    # Create custom database

Data files should be placed in the ./data directory:
  - words.ljson (main dictionary data)
  - kanjidic_comb_utf8 (kanji data)
  - examples.utf (example sentences)
  - JmdictFurigana.json (furigana data)
  - Kanji Radicals Reference - *.csv (radical data)

Your existing database (assets/db/dict_2.db) will NOT be affected.
`);
  }
}

// Run if called directly
if (require.main === module) {
  const migrator = new DatabaseMigrator();
  migrator.run();
}
