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

      // Split schema into statements, keeping trigger BEGIN...END blocks intact
      const statements: string[] = [];
      let current = '';
      let inTrigger = false;
      for (const part of cleanedSchema.split(';')) {
        current += (current ? ';' : '') + part;
        const upper = current.trim().toUpperCase();
        if (upper.startsWith('CREATE TRIGGER')) {
          inTrigger = true;
        }
        if (inTrigger) {
          if (upper.endsWith('END')) {
            statements.push(current.trim());
            current = '';
            inTrigger = false;
          }
        } else {
          const trimmed = current.trim();
          if (trimmed.length > 0) {
            statements.push(trimmed);
          }
          current = '';
        }
      }
      if (current.trim().length > 0) {
        statements.push(current.trim());
      }

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
      'CREATE INDEX IF NOT EXISTS idx_words_word ON words(word)',
      'CREATE INDEX IF NOT EXISTS idx_words_reading ON words(reading)',
      'CREATE INDEX IF NOT EXISTS idx_words_kanji ON words(kanji)',
      'CREATE INDEX IF NOT EXISTS idx_meanings_word_id ON meanings(word_id)',
      'CREATE INDEX IF NOT EXISTS idx_meanings_meaning ON meanings(meaning)',
      'CREATE INDEX IF NOT EXISTS idx_kanji_character ON kanji(character)',
      'CREATE INDEX IF NOT EXISTS idx_examples_japanese ON examples(japanese_text)',
      'CREATE INDEX IF NOT EXISTS idx_examples_word_id ON examples(word_id)',
      'CREATE INDEX IF NOT EXISTS idx_furigana_text ON furigana(text)',
      'CREATE INDEX IF NOT EXISTS idx_furigana_reading ON furigana(reading)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_furigana_text_reading ON furigana(text, reading)',
      'CREATE INDEX IF NOT EXISTS idx_history_entry_type ON history(entry_type)',
      'CREATE INDEX IF NOT EXISTS idx_history_word_id ON history(word_id)',
      'CREATE INDEX IF NOT EXISTS idx_history_kanji_id ON history(kanji_id)',
      'CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at)',
    ];

    this.db.transaction(() => {
      for (const indexSql of indexes) {
        try {
          this.db.exec(indexSql);
        } catch (error) {
          console.warn(`⚠️  Index creation failed: ${error}`);
        }
      }
    })();

    console.log('✅ Database indexes created');
  }

  /**
   * Update FTS tables with current data
   */
  updateFTSTables(): void {
    console.log('🔄 Updating FTS tables...');

    try {
      // Clear existing FTS data
      this.db.exec('DELETE FROM words_fts');

      // Populate words FTS from words table columns
      this.db.exec(`
        INSERT INTO words_fts(rowid, word, reading, reading_hiragana, kanji)
        SELECT id, word, reading, reading_hiragana, kanji
        FROM words
      `);

      const ftsCount = this.getTableCount('words_fts_docsize');
      const wordsCount = this.getTableCount('words');
      console.log(`✅ FTS tables updated: ${ftsCount} docs indexed (${wordsCount} words)`);
    } catch (error) {
      console.warn('⚠️  FTS update failed (may not be implemented yet):', error);
    }
  }

  /**
   * Get database statistics
   */
  getStats(): Record<string, number> {
  const tables = ['words', 'meanings', 'furigana', 'kanji', 'examples', 'history'];
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
