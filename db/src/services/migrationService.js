const fs = require("fs");
const path = require("path");
const { initializeDatabase } = require("../config/db");
const { parseEdict } = require("../parsers/edictParser");
const { parseWords } = require("../parsers/wordsParser");
const { parseExamples } = require("../parsers/exampleParser");
const {
  normalizeJapanese,
  deduplicateEntries,
  deduplicateMeanings,
  generateWordForms,
  extractWordTokens,
} = require("../utils/deduplication");

// Configuration
const DB_PATH = path.join(__dirname, "..", "out", "jisho.db");
const EDICT_PATH = path.join(__dirname, "..", "data", "edict2u");
const WORDS_PATH = path.join(__dirname, "..", "data", "words.ljson");
const EXAMPLES_PATH = path.join(__dirname, "..", "data", "examples.utf");

// Main migration function that handles the async operations
async function performMigration() {
  // Initialize the database with optimized settings
  const db = initializeDatabase(DB_PATH);

  // Apply optimization pragmas
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = 10000");
  db.pragma("temp_store = MEMORY");

  // Prepare statements
  const insertWord = db.prepare(
    "INSERT OR IGNORE INTO words (word, reading) VALUES (?, ?)"
  );
  const getWordId = db.prepare(
    "SELECT id FROM words WHERE word = ? AND (reading = ? OR (reading IS NULL AND ? IS NULL))"
  );
  const findWordByNormalized = db.prepare(`
    SELECT id FROM words
    WHERE (word = ? OR reading = ?)
    OR (word LIKE ? OR reading LIKE ?)
  `);
  const insertMeaning = db.prepare(
    "INSERT INTO meanings (word_id, meaning, part_of_speech, tags) VALUES (?, ?, ?, ?)"
  );
  const insertExample = db.prepare(
    "INSERT INTO examples (japanese, english, parsed_tokens) VALUES (?, ?, ?)"
  );
  const insertExampleWordMap = db.prepare(
    "INSERT OR IGNORE INTO example_word_map (example_id, word_id) VALUES (?, ?)"
  );
  const insertMeaningFts = db.prepare(
    "INSERT INTO meanings_fts (rowid, meaning) VALUES (?, ?)"
  );

  // Prepare batch statements for better performance
  const insertMeaningsBatch = db.prepare(`
    INSERT INTO meanings (word_id, meaning, part_of_speech, tags)
    VALUES (@wordId, @meaning, @partOfSpeech, @tags)
  `);

  const insertExampleWordMapBatch = db.prepare(`
    INSERT OR IGNORE INTO example_word_map (example_id, word_id)
    VALUES (@exampleId, @wordId)
  `);

  // Cache for words to avoid repeated database lookups
  const wordCache = new Map();

  // Add this batch statement for words
  const insertWordBatch = db.prepare(`
    INSERT OR IGNORE INTO words (word, reading)
    VALUES (@word, @reading)
  `);

  // Create a transaction for batch word insertion
  const insertWordTransaction = db.transaction((wordBatch) => {
    for (const wordData of wordBatch) {
      insertWordBatch.run({
        word: wordData.word,
        reading: wordData.reading,
      });
    }
  });

  function insertWordAndGetId(word, reading) {
    // Generate a cache key
    const normalizedWord = normalizeJapanese(word);
    const normalizedReading = normalizeJapanese(reading);
    const cacheKey = `${normalizedWord}:${normalizedReading}`;

    // Check cache first
    if (wordCache.has(cacheKey)) {
      return wordCache.get(cacheKey);
    }

    // Check for exact match in database
    let result = getWordId.get(
      normalizedWord,
      normalizedReading,
      normalizedReading
    );

    if (!result) {
      // Try fuzzy matching only if exact match fails
      result = findWordByNormalized.get(
        normalizedWord,
        normalizedReading,
        `%${normalizedWord}%`,
        `%${normalizedReading}%`
      );
    }

    if (result) {
      wordCache.set(cacheKey, result.id);
      return result.id;
    }

    // If not found, insert it
    insertWord.run(word, reading);

    // Get the ID of the inserted word
    const insertedResult = getWordId.get(word, reading, reading);
    const id = insertedResult ? insertedResult.id : null;

    // Cache the result
    if (id) {
      wordCache.set(cacheKey, id);
    }

    return id;
  }

  // Define transactions for batch processing
  const insertMeaningsTransaction = db.transaction((meaningsData) => {
    for (const data of meaningsData) {
      const info = insertMeaningsBatch.run({
        wordId: data.wordId,
        meaning: data.meaning,
        partOfSpeech: data.partOfSpeech,
        tags: data.tags,
      });
      // Store meaning IDs for later FTS indexing
      data.meaningId = info.lastInsertRowid;
    }
  });

  const insertExampleWordMapTransaction = db.transaction((mappings) => {
    for (const mapping of mappings) {
      insertExampleWordMapBatch.run({
        exampleId: mapping.exampleId,
        wordId: mapping.wordId,
      });
    }
  });

  const insertMeaningFtsTransaction = db.transaction((meaningData) => {
    for (const item of meaningData) {
      insertMeaningFts.run(item.meaningId, item.meaning);
    }
  });

  // Begin transaction for better performance
  db.exec("BEGIN TRANSACTION");

  try {
    console.log("Parsing EDICT file...");
    const edictEntries = parseEdict(EDICT_PATH);
    console.log(`Parsed ${edictEntries.length} entries from EDICT`);

    console.log("Parsing words LJSON file...");
    // Modified to await the Promise returned by parseWords
    const wordEntries = await parseWords(WORDS_PATH);
    console.log(`Parsed ${wordEntries.length} entries from words LJSON`);

    console.log("Deduplicating entries...");
    // Merge entries from both sources
    const allEntries = [...edictEntries, ...wordEntries];
    const uniqueEntries = deduplicateEntries(allEntries);
    console.log(`Deduplicated to ${uniqueEntries.length} unique entries`);

    console.log("Inserting deduplicated entries into the database...");

    // Process in batches
    const batchSize = 1000;
    let currentBatch = [];
    let processedCount = 0;
    const totalEntries = uniqueEntries.length;
    const allMeaningsForFts = [];

    for (const entry of uniqueEntries) {
      const wordId = insertWordAndGetId(entry.word, entry.reading);

      if (!wordId) {
        console.error(
          `Failed to insert or retrieve word: ${(entry.word, entry.reading)}`
        );
        continue;
      }

      // Add all meanings for this word to the current batch
      for (const meaning of entry.meanings) {
        // Convert part_of_speech and tags to strings or null to prevent SQLite binding errors
        const partOfSpeech = meaning.part_of_speech ? String(meaning.part_of_speech) : null;
        const tags = meaning.tags ? String(meaning.tags) : null;

        currentBatch.push({
          wordId,
          meaning: meaning.meaning,
          partOfSpeech: partOfSpeech,
          tags: tags,
        });
      }

      // Process batch when it reaches the batch size
      if (currentBatch.length >= batchSize) {
        insertMeaningsTransaction(currentBatch);

        // Save meanings for later FTS indexing
        allMeaningsForFts.push(...currentBatch);
        currentBatch = [];
      }

      processedCount++;

      if (processedCount % batchSize === 0 || processedCount >= totalEntries) {
        console.log(
          `Progress: (${processedCount}/${totalEntries} entries processed)`
        );
      }
    }

    // Process any remaining items in the batch
    if (currentBatch.length > 0) {
      insertMeaningsTransaction(currentBatch);
      allMeaningsForFts.push(...currentBatch);
    }

    console.log(
      `Completed inserting ${processedCount} entries into the database.`
    );

    // Commit the transaction for word and meaning insertion before starting FTS indexing
    // This creates a checkpoint and reduces memory pressure
    console.log("Committing initial transaction...");
    db.exec("COMMIT");
    db.exec("BEGIN TRANSACTION");

    // Build FTS index with optimized batching and transaction handling
    console.log("Building full-text search index...");
    const ftsBatchSize = 10000; // Increased batch size for better throughput

    // Use a prepared statement with direct insertion to bypass the transaction overhead
    const directFtsInsert = db.prepare(
      "INSERT INTO meanings_fts (rowid, meaning) VALUES (?, ?)"
    );

    // Process in smaller sub-batches with periodic commits to prevent transaction bloat
    const subBatchSize = 1000;
    let subBatch = [];
    let totalProcessed = 0;

    for (let i = 0; i < allMeaningsForFts.length; i++) {
      const item = allMeaningsForFts[i];
      subBatch.push(item);

      if (subBatch.length >= subBatchSize) {
        db.exec("SAVEPOINT fts_batch");
        try {
          for (const ftsItem of subBatch) {
            directFtsInsert.run(ftsItem.meaningId, ftsItem.meaning);
          }
          db.exec("RELEASE fts_batch");
        } catch (error) {
          db.exec("ROLLBACK TO fts_batch");
          console.error("Error in FTS batch:", error);
        }

        subBatch = [];
        totalProcessed += subBatchSize;

        if (
          totalProcessed % ftsBatchSize === 0 ||
          totalProcessed >= allMeaningsForFts.length
        ) {
          console.log(
            `FTS index progress: ${Math.min(
              totalProcessed,
              allMeaningsForFts.length
            )}/${allMeaningsForFts.length}`
          );
        }
      }
    }

    // Process any remaining items
    if (subBatch.length > 0) {
      db.exec("SAVEPOINT fts_batch");
      try {
        for (const ftsItem of subBatch) {
          directFtsInsert.run(ftsItem.meaningId, ftsItem.meaning);
        }
        db.exec("RELEASE fts_batch");
        totalProcessed += subBatch.length;
      } catch (error) {
        db.exec("ROLLBACK TO fts_batch");
        console.error("Error in final FTS batch:", error);
      }
    }

    // Commit the FTS transaction
    db.exec("COMMIT");
    console.log(`FTS indexing complete. Processed ${totalProcessed} meanings.`);

    // Start new transaction for examples processing
    db.exec("BEGIN TRANSACTION");

    console.log("Parsing examples file...");
    const examples = parseExamples(EXAMPLES_PATH);
    console.log(`Parsed ${examples.length} examples`);

    console.log("Creating word form map for example matching...");
    // Create a map of normalized word forms to word IDs for faster lookups
    const wordFormMap = new Map();

    // Populate the word form map in batches to reduce memory pressure
    const wordBatchSize = 10000;
    let offset = 0;
    let wordBatch;

    // Process words in chunks to avoid loading all into memory at once
    while (true) {
      // Create a new statement for each query with limit and offset values directly in the SQL
      const batchQuery = db.prepare(
        `SELECT id, word, reading FROM words LIMIT ${wordBatchSize} OFFSET ${offset}`
      );
      wordBatch = batchQuery.all();
      if (wordBatch.length === 0) break;

      for (const row of wordBatch) {
        const forms = generateWordForms({
          word: row.word,
          reading: row.reading,
        });

        forms.forEach((form) => {
          if (form && form.length > 0) wordFormMap.set(form, row.id);
        });
      }

      console.log(
        `Word form map progress: processed ${offset + wordBatch.length} words`
      );
      offset += wordBatch.length;

      // Periodic garbage collection hint to reduce memory pressure
      if (global.gc && offset % (wordBatchSize * 5) === 0) {
        global.gc();
      }
    }
    console.log(`Word form map created with ${wordFormMap.size} entries.`);

    console.log("Inserting examples into the database...");
    // Process examples in batches
    const exampleBatchSize = 500;

    // Prepare example batches and process them more efficiently
    const exampleStmt = db.prepare(`
      INSERT INTO examples (japanese, english, parsed_tokens)
      VALUES (?, ?, ?)
    `);

    // Use a fast lookup set for already linked words per example
    db.exec(
      "CREATE TEMPORARY TABLE temp_example_word_map (example_id INTEGER, word_id INTEGER, UNIQUE(example_id, word_id))"
    );
    const tempMapStmt = db.prepare(
      "INSERT OR IGNORE INTO temp_example_word_map VALUES (?, ?)"
    );

    let lastProgressReport = 0;
    let examplesProcessed = 0;

    for (let i = 0; i < examples.length; i += exampleBatchSize) {
      const exampleBatch = examples.slice(i, i + exampleBatchSize);
      db.exec("SAVEPOINT example_batch");

      try {
        for (const example of exampleBatch) {
          // Insert example
          const info = exampleStmt.run(
            example.japanese,
            example.english,
            example.parsed_tokens
          );
          const exampleId = info.lastInsertRowid;

          // Extract tokens and match them to words
          const tokens = extractWordTokens(example);
          const linkedWords = new Set();

          // First match tokens from parsed text
          for (const token of tokens) {
            if (token && wordFormMap.has(token)) {
              const wordId = wordFormMap.get(token);
              if (!linkedWords.has(wordId)) {
                tempMapStmt.run(exampleId, wordId);
                linkedWords.add(wordId);
              }
            }
          }

          // Then try to match the raw Japanese text against word forms
          // Focus only on longer words (3+ characters) and limit iterations for performance
          const normalizedJapanese = normalizeJapanese(example.japanese);

          // Using a smarter matching approach to reduce unnecessary comparisons
          // First check if any entry in wordFormMap is contained in this example
          for (const [form, wordId] of wordFormMap.entries()) {
            if (
              form &&
              form.length > 2 &&
              normalizedJapanese.includes(form) &&
              !linkedWords.has(wordId)
            ) {
              tempMapStmt.run(exampleId, wordId);
              linkedWords.add(wordId);

              // Limit the number of word form checks per example to improve performance
              if (linkedWords.size >= 20) break;
            }
          }
        }

        // Copy from temp table to permanent table in a single operation
        db.exec(`
          INSERT OR IGNORE INTO example_word_map (example_id, word_id)
          SELECT example_id, word_id FROM temp_example_word_map
        `);
        db.exec("DELETE FROM temp_example_word_map");

        db.exec("RELEASE example_batch");
        examplesProcessed += exampleBatch.length;

        // Report progress at reasonable intervals
        const currentTime = Date.now();
        if (
          currentTime - lastProgressReport > 5000 ||
          examplesProcessed >= examples.length
        ) {
          console.log(
            `Examples progress: ${examplesProcessed}/${examples.length}`
          );
          lastProgressReport = currentTime;
        }
      } catch (error) {
        db.exec("ROLLBACK TO example_batch");
        console.error("Error processing example batch:", error);
      }
    }

    // Create indexes after all data is inserted for better performance
    console.log("Creating database indexes...");
    db.exec(`CREATE INDEX IF NOT EXISTS idx_words_word ON words(word)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_words_reading ON words(reading)`);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_meanings_word_id ON meanings(word_id)`
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_example_word_map ON example_word_map(word_id)`
    );

    // Optimize database
    console.log("Optimizing database...");
    db.exec("ANALYZE");

    // Commit the transaction
    db.exec("COMMIT");

    try {
      // VACUUM must be run outside of a transaction
      console.log("Running VACUUM to optimize database size...");
      db.exec("VACUUM");
      console.log("VACUUM completed successfully");
    } catch (vacuumError) {
      console.error(
        "Error during VACUUM (database is still valid):",
        vacuumError
      );
    }

    console.log("Migration completed successfully!");
  } catch (error) {
    // Rollback on error
    db.exec("ROLLBACK");
    console.error("Migration failed:");
    console.error(error);
  } finally {
    // Close the database connection
    db.close();
  }
}

// Execute the migration
performMigration().catch((error) => {
  console.error("Unhandled error in migration:", error);
  process.exit(1);
});
