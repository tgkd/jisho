import * as FileSystem from "expo-file-system";
import * as SQLite from "expo-sqlite";

/**
 * Database service for the new dictionary schema (database_new.db)
 * This provides search and lookup functions for the modernized database structure
 */
export class NewDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private readonly dbName = "dictionary_new.db";

  /**
   * Initialize the database connection
   */
  async init(): Promise<void> {
    if (this.db) return;

    try {
      // Check if the new database exists in app directory
      const dbPath = `${FileSystem.documentDirectory}SQLite/${this.dbName}`;
      const dbInfo = await FileSystem.getInfoAsync(dbPath);

      if (!dbInfo.exists) {
        // Ensure SQLite directory exists
        const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
        const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
        }

        // Debug: Log all available paths
        console.log("=== Database Path Debug ===");
        console.log(`bundleDirectory: ${FileSystem.bundleDirectory}`);
        console.log(`documentDirectory: ${FileSystem.documentDirectory}`);
        console.log(`cacheDirectory: ${FileSystem.cacheDirectory}`);
        
        // Try multiple potential database sources
        const possibleSources = [
          `${FileSystem.bundleDirectory}assets/db/dictionary_new.db`, // Production
          `${FileSystem.documentDirectory}../../../assets/db/dictionary_new.db`, // Development fallback 1
          `${FileSystem.documentDirectory}../../../database_new.db`, // Development fallback 2
          `${FileSystem.documentDirectory}../../../../assets/db/dictionary_new.db`, // Development fallback 3
          `${FileSystem.documentDirectory}../../../../database_new.db`, // Development fallback 4
        ];

        let copied = false;
        for (const source of possibleSources) {
          try {
            console.log(`Checking source: ${source}`);
            const sourceInfo = await FileSystem.getInfoAsync(source);
            console.log(`Source exists: ${sourceInfo.exists}, isDirectory: ${sourceInfo.isDirectory}`);
            if (sourceInfo.exists && !sourceInfo.isDirectory) {
              console.log(`Copying database from: ${source}`);
              await FileSystem.copyAsync({
                from: source,
                to: dbPath
              });
              copied = true;
              break;
            }
          } catch (error) {
            console.log(`Error accessing source ${source}:`, error instanceof Error ? error.message : String(error));
            continue;
          }
        }

        if (!copied) {
          // Final fallback: In development, create a temporary database
          // This is a temporary solution for development - the database should be bundled properly
          console.log("No database found, creating temporary empty database");
          
          // Create a minimal database structure for development
          this.db = await SQLite.openDatabaseAsync(this.dbName);
          
          // Create basic tables to prevent crashes
          await this.db.execAsync(`
            CREATE TABLE IF NOT EXISTS words (id INTEGER PRIMARY KEY);
            CREATE TABLE IF NOT EXISTS word_kanji (word_id INTEGER, kanji TEXT);
            CREATE TABLE IF NOT EXISTS word_readings (word_id INTEGER, reading TEXT, romaji TEXT);
            CREATE TABLE IF NOT EXISTS word_senses (id INTEGER PRIMARY KEY, word_id INTEGER, parts_of_speech TEXT);
            CREATE TABLE IF NOT EXISTS word_glosses (sense_id INTEGER, gloss TEXT);
            CREATE TABLE IF NOT EXISTS kanji (character TEXT PRIMARY KEY, meanings TEXT, on_readings TEXT, kun_readings TEXT, grade INTEGER, stroke_count INTEGER, frequency INTEGER);
            CREATE TABLE IF NOT EXISTS examples (japanese_text TEXT, english_text TEXT, furigana_text TEXT);
          `);
          
          console.log("Created temporary development database");
          return; // Skip the normal database opening since we already opened it
        }
      }

      this.db = await SQLite.openDatabaseAsync(this.dbName);
      
      // Log database info for debugging
      const version = await this.db.getFirstAsync("PRAGMA user_version");
      const tables = await this.db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
      console.log(`DB: ${JSON.stringify(version)} TARGET: ${JSON.stringify(version)}`);
      console.log(`Database initialized successfully with ${tables.length} tables`);
    } catch (error) {
      console.error("Failed to initialize new database:", error);
      throw error;
    }
  }

  /**
   * Search for words using English terms
   */
  async searchEnglish(query: string, limit = 50): Promise<WordResult[]> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    try {
      const results = await this.db.getAllAsync(`
        SELECT 
          fts.word_id,
          fts.kanji,
          fts.reading,
          fts.romaji,
          fts.gloss,
          fts.pos
        FROM words_fts_en fts
        WHERE words_fts_en MATCH ?
        ORDER BY rank
        LIMIT ?
      `, [query, limit]);

      return results.map(this.mapToWordResult);
    } catch (error) {
      console.error("English search failed:", error);
      return [];
    }
  }

  /**
   * Search for words using Japanese terms
   */
  async searchJapanese(query: string, limit = 50): Promise<WordResult[]> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    try {
      const results = await this.db.getAllAsync(`
        SELECT 
          fts.word_id,
          fts.kanji,
          fts.reading,
          fts.reading_normalized
        FROM words_fts_jp fts
        WHERE words_fts_jp MATCH ?
        ORDER BY rank
        LIMIT ?
      `, [query, limit]);

      // Get full word details for each result
      const wordIds = results.map((r: any) => r.word_id);
      if (wordIds.length === 0) return [];

      const placeholders = wordIds.map(() => '?').join(',');
      const wordDetails = await this.db.getAllAsync(`
        SELECT 
          w.id,
          group_concat(wk.kanji, ' ') as kanji_forms,
          group_concat(wr.reading, ' ') as readings,
          group_concat(wr.romaji, ' ') as romaji,
          group_concat(wg.gloss, '; ') as glosses,
          ws.parts_of_speech
        FROM words w
        LEFT JOIN word_kanji wk ON w.id = wk.word_id
        LEFT JOIN word_readings wr ON w.id = wr.word_id
        LEFT JOIN word_senses ws ON w.id = ws.word_id
        LEFT JOIN word_glosses wg ON ws.id = wg.sense_id
        WHERE w.id IN (${placeholders})
        GROUP BY w.id
      `, wordIds);

      return wordDetails.map(this.mapToWordResult);
    } catch (error) {
      console.error("Japanese search failed:", error);
      return [];
    }
  }

  /**
   * Get detailed information for a specific word
   */
  async getWordDetails(wordId: number): Promise<WordDetails | null> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    try {
      const word = await this.db.getFirstAsync(`
        SELECT id FROM words WHERE id = ?
      `, [wordId]);

      if (!word) return null;

      // Get kanji forms
      const kanjiList = await this.db.getAllAsync(`
        SELECT kanji FROM word_kanji WHERE word_id = ?
      `, [wordId]);

      // Get readings
      const readingsList = await this.db.getAllAsync(`
        SELECT reading, romaji FROM word_readings WHERE word_id = ?
      `, [wordId]);

      // Get senses and glosses
      const senses = await this.db.getAllAsync(`
        SELECT 
          ws.id,
          ws.parts_of_speech,
          group_concat(wg.gloss, '; ') as glosses
        FROM word_senses ws
        LEFT JOIN word_glosses wg ON ws.id = wg.sense_id
        WHERE ws.word_id = ?
        GROUP BY ws.id, ws.parts_of_speech
      `, [wordId]);

      return {
        id: wordId,
        kanji: kanjiList.map((k: any) => k.kanji),
        readings: readingsList.map((r: any) => ({
          reading: r.reading,
          romaji: r.romaji
        })),
        senses: senses.map((s: any) => ({
          partOfSpeech: s.parts_of_speech,
          glosses: s.glosses?.split('; ') || []
        }))
      };
    } catch (error) {
      console.error("Failed to get word details:", error);
      return null;
    }
  }

  /**
   * Search kanji by character or meaning
   */
  async searchKanji(query: string, limit = 20): Promise<KanjiResult[]> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    try {
      const results = await this.db.getAllAsync(`
        SELECT 
          character,
          meanings,
          on_readings,
          kun_readings,
          grade,
          stroke_count,
          frequency
        FROM kanji 
        WHERE character = ? 
           OR meanings LIKE ?
        LIMIT ?
      `, [query, `%${query}%`, limit]);

      return results.map((k: any) => ({
        character: k.character,
        meanings: k.meanings?.split(', ') || [],
        onReadings: k.on_readings?.split(', ') || [],
        kunReadings: k.kun_readings?.split(', ') || [],
        grade: k.grade,
        strokeCount: k.stroke_count,
        frequency: k.frequency
      }));
    } catch (error) {
      console.error("Kanji search failed:", error);
      return [];
    }
  }

  /**
   * Get example sentences for a word
   */
  async getExamples(wordId: number, limit = 10): Promise<ExampleResult[]> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    try {
      const results = await this.db.getAllAsync(`
        SELECT 
          japanese_text,
          english_text,
          furigana_text
        FROM examples 
        WHERE japanese_text LIKE (
          SELECT '%' || group_concat(kanji, '%') || '%' 
          FROM word_kanji 
          WHERE word_id = ?
        )
        OR japanese_text LIKE (
          SELECT '%' || group_concat(reading, '%') || '%'
          FROM word_readings
          WHERE word_id = ?
        )
        LIMIT ?
      `, [wordId, wordId, limit]);

      return results.map((e: any) => ({
        japanese: e.japanese_text,
        english: e.english_text,
        furigana: e.furigana_text
      }));
    } catch (error) {
      console.error("Examples search failed:", error);
      return [];
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }

  /**
   * Map database result to WordResult interface
   */
  private mapToWordResult(row: any): WordResult {
    return {
      id: row.word_id || row.id,
      kanji: row.kanji_forms?.split(' ') || row.kanji?.split(' ') || [],
      readings: row.readings?.split(' ') || row.reading?.split(' ') || [],
      romaji: row.romaji?.split(' ') || [],
      glosses: row.glosses?.split('; ') || row.gloss?.split('; ') || [],
      partOfSpeech: row.parts_of_speech || row.pos
    };
  }
}

// Type definitions
export interface WordResult {
  id: number;
  kanji: string[];
  readings: string[];
  romaji: string[];
  glosses: string[];
  partOfSpeech?: string;
}

export interface WordDetails {
  id: number;
  kanji: string[];
  readings: {
    reading: string;
    romaji: string;
  }[];
  senses: {
    partOfSpeech: string;
    glosses: string[];
  }[];
}

export interface KanjiResult {
  character: string;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  grade?: number;
  strokeCount?: number;
  frequency?: number;
}

export interface ExampleResult {
  japanese: string;
  english: string;
  furigana?: string;
}

// Export singleton instance
export const newDb = new NewDatabaseService();