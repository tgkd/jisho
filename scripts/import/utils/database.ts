import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

export interface DatabaseConfig {
  path: string;
  verbose?: boolean;
  readonly?: boolean;
}

export class DatabaseManager {
  private db: Database.Database;

  constructor(config: DatabaseConfig) {
    this.db = new Database(config.path, {
      verbose: config.verbose ? console.log : undefined,
      readonly: config.readonly || false,
    });

    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');

    // Optimize for bulk operations
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB
    this.db.pragma('cache_size = 10000');
  }

  /**
   * Initialize database with schema
   */
  async initializeSchema(schemaPath: string): Promise<void> {
    try {
      const schema = readFileSync(schemaPath, 'utf-8');

      // Remove comments and normalize whitespace
      const cleanedSchema = schema
        .replace(/--.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Split schema into individual statements
      const statements = cleanedSchema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      // Separate statements by type for proper execution order
      const createTableStatements: string[] = [];
      const createIndexStatements: string[] = [];
      const createViewStatements: string[] = [];
      const createTriggerStatements: string[] = [];
      const insertStatements: string[] = [];
      const pragmaStatements: string[] = [];
      const otherStatements: string[] = [];

      for (const statement of statements) {
        if (statement.trim()) {
          const upperStatement = statement.toUpperCase();
          if (upperStatement.startsWith('CREATE TABLE') || upperStatement.startsWith('CREATE VIRTUAL TABLE')) {
            createTableStatements.push(statement);
          } else if (upperStatement.startsWith('CREATE INDEX') || upperStatement.includes('CREATE INDEX')) {
            createIndexStatements.push(statement);
          } else if (upperStatement.startsWith('CREATE VIEW')) {
            createViewStatements.push(statement);
          } else if (upperStatement.startsWith('CREATE TRIGGER')) {
            createTriggerStatements.push(statement);
          } else if (upperStatement.startsWith('INSERT')) {
            insertStatements.push(statement);
          } else if (upperStatement.startsWith('PRAGMA')) {
            pragmaStatements.push(statement);
          } else if (upperStatement === 'BEGIN' || upperStatement === 'END' || upperStatement === 'COMMIT' || upperStatement === 'ROLLBACK') {
            // Skip transaction control statements as we handle transactions ourselves
            continue;
          } else {
            otherStatements.push(statement);
          }
        }
      }

      // Execute statements outside of transaction for PRAGMA statements
      console.log(`🔧 Executing ${pragmaStatements.length} PRAGMA statements...`);
      for (const statement of pragmaStatements) {
        try {
          this.db.exec(statement);
        } catch (error) {
          console.warn(`⚠️  PRAGMA statement failed: ${error}`);
        }
      }

      this.db.transaction(() => {
        console.log(`📋 Creating ${createTableStatements.length} tables...`);
        for (const statement of createTableStatements) {
          try {
            this.db.exec(statement);
          } catch (error) {
            console.error(`❌ Failed to create table: ${statement.substring(0, 100)}...`);
            throw error;
          }
        }

        console.log(`🗂️  Creating ${createIndexStatements.length} indexes...`);
        for (const statement of createIndexStatements) {
          try {
            this.db.exec(statement);
          } catch (error) {
            console.error(`❌ Failed to create index: ${statement.substring(0, 100)}...`);
            throw error;
          }
        }

        console.log(`👁️  Creating ${createViewStatements.length} views...`);
        for (const statement of createViewStatements) {
          try {
            this.db.exec(statement);
          } catch (error) {
            console.error(`❌ Failed to create view: ${statement.substring(0, 100)}...`);
            throw error;
          }
        }

        console.log(`📝 Executing ${insertStatements.length} insert statements...`);
        for (const statement of insertStatements) {
          try {
            this.db.exec(statement);
          } catch (error) {
            console.error(`❌ Failed to execute insert: ${statement.substring(0, 100)}...`);
            throw error;
          }
        }

        console.log(`🔧 Executing ${otherStatements.length} other statements...`);
        for (const statement of otherStatements) {
          try {
            this.db.exec(statement);
          } catch (error) {
            console.warn(`⚠️  Statement failed: ${statement.substring(0, 100)}... - ${error}`);
          }
        }
      })();

      // Execute triggers after transaction
      console.log(`⚡ Creating ${createTriggerStatements.length} triggers...`);
      for (const statement of createTriggerStatements) {
        try {
          this.db.exec(statement);
        } catch (error) {
          console.warn(`⚠️  Failed to create trigger (this may be expected): ${error}`);
          // Don't throw error for triggers, as they may reference tables that don't exist yet
        }
      }

      console.log('✅ Database schema initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize schema:', error);
      throw error;
    }
  }

  /**
   * Check if database exists and has tables
   */
  isInitialized(): boolean {
    try {
      const result = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='table' AND name='words'
      `).get() as { count: number };

      return result.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get database connection
   */
  getConnection(): Database.Database {
    return this.db;
  }

  /**
   * Execute SQL transaction
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * Prepare statement for reuse
   */
  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  /**
   * Execute raw SQL
   */
  exec(sql: string): Database.Database {
    return this.db.exec(sql);
  }

  /**
   * Get table row count
   */
  getTableCount(tableName: string): number {
    const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
    return result.count;
  }

  /**
   * Optimize database performance for bulk operations
   */
  optimizeForBulkOperations(): void {
    this.db.pragma('synchronous = OFF');
    this.db.pragma('journal_mode = MEMORY');
    this.db.exec('BEGIN TRANSACTION');
  }

  /**
   * Restore normal database settings after bulk operations
   */
  restoreNormalSettings(): void {
    this.db.exec('COMMIT');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Create indexes for better performance
   */
  createIndexes(): void {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_words_entry_id ON words(entry_id)',
      'CREATE INDEX IF NOT EXISTS idx_word_kanji_kanji ON word_kanji(kanji)',
      'CREATE INDEX IF NOT EXISTS idx_word_readings_reading ON word_readings(reading)',
      'CREATE INDEX IF NOT EXISTS idx_word_glosses_gloss ON word_glosses(gloss)',
      'CREATE INDEX IF NOT EXISTS idx_kanji_character ON kanji(character)',
      'CREATE INDEX IF NOT EXISTS idx_examples_japanese ON examples(japanese)',
    ];

    this.db.transaction(() => {
      for (const indexSql of indexes) {
        this.db.exec(indexSql);
      }
    })();

    console.log('✅ Database indexes created');
  }

  /**
   * Update FTS tables with current data
   */
  updateFTSTables(): void {
    console.log('🔄 Updating FTS tables...');

    // Clear existing FTS data
    this.db.exec('DELETE FROM words_fts_en');
    this.db.exec('DELETE FROM words_fts_jp');
    this.db.exec('DELETE FROM examples_fts');

    // Populate English FTS
    this.db.exec(`
      INSERT INTO words_fts_en(word_id, kanji, reading, romaji, gloss, pos)
      SELECT
        w.id,
        group_concat(wk.kanji, ' '),
        group_concat(wr.reading, ' '),
        group_concat(wr.romaji, ' '),
        wg.gloss,
        ws.parts_of_speech
      FROM words w
      LEFT JOIN word_kanji wk ON w.id = wk.word_id
      LEFT JOIN word_readings wr ON w.id = wr.word_id
      LEFT JOIN word_senses ws ON w.id = ws.word_id
      LEFT JOIN word_glosses wg ON ws.id = wg.sense_id
      WHERE wg.gloss IS NOT NULL
      GROUP BY w.id, wg.id, ws.parts_of_speech
    `);

    // Populate Japanese FTS
    this.db.exec(`
      INSERT INTO words_fts_jp(word_id, kanji, reading, reading_normalized)
      SELECT
        w.id,
        group_concat(wk.kanji, ' '),
        wr.reading,
        wr.reading
      FROM words w
      LEFT JOIN word_kanji wk ON w.id = wk.word_id
      LEFT JOIN word_readings wr ON w.id = wr.word_id
      WHERE wr.reading IS NOT NULL
      GROUP BY w.id, wr.reading
    `);

    // Populate Examples FTS
    this.db.exec(`
      INSERT INTO examples_fts(example_id, japanese, english)
      SELECT id, japanese, english
      FROM examples
    `);

    console.log('✅ FTS tables updated');
  }

  /**
   * Get database statistics
   */
  getStats(): Record<string, number> {
    const tables = ['words', 'word_kanji', 'word_readings', 'word_senses', 'word_glosses', 'kanji', 'examples', 'furigana'];
    const stats: Record<string, number> = {};

    for (const table of tables) {
      try {
        stats[table] = this.getTableCount(table);
      } catch {
        stats[table] = 0;
      }
    }

    return stats;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
