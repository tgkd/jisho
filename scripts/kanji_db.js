const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

/**
 * Parses raw kanji data and converts it to structured JSON
 * @param {string} rawData - The raw kanji data input
 * @returns {Array} Array of structured kanji objects
 */
function parseKanjiData(rawData) {
  // Split the input text into lines, filtering out empty lines
  const lines = rawData.split("\n").filter((line) => line.trim());

  const kanjiList = [];

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Skip comment lines
    if (line.startsWith('#')) continue;

    // Split by spaces (first few entries are specific fields)
    const parts = line.trim().split(" ");

    // Extract the kanji character and codes
    const kanji = parts[0];
    const jisCode = parseInt(parts[1], 10);
    const unicode = parts[2];

    // Find where the meanings begin (enclosed in curly braces)
    const meaningStart = line.indexOf("{");
    if (meaningStart === -1) continue; // Skip if no meanings found

    // Extract all meanings
    const meaningsSection = line.substring(meaningStart);
    const meaningMatches = meaningsSection.match(/{([^}]+)}/g);

    if (!meaningMatches) continue;

    const meanings = meaningMatches.map(
      (match) => match.substring(1, match.length - 1) // Remove the curly braces
    );

    // Extract readings
    const readingSection = line.substring(0, meaningStart).trim();
    const readingParts = readingSection.split(" ");

    // Japanese readings typically come after the codes, before meanings
    // On-yomi readings are typically in katakana (uppercase in romaji)
    // Kun-yomi readings are typically in hiragana (lowercase in romaji)
    const onReadings = [];
    const kunReadings = [];

    // Start from where kanji definitions end (after unicode, jis code)
    // and extract readings before the meanings section
    let readingStarted = false;
    for (let i = 3; i < readingParts.length; i++) {
      const part = readingParts[i];

      // Skip non-reading parts (codes, metadata)
      if (part.startsWith('B') || part.startsWith('C') ||
          part.startsWith('G') || part.startsWith('S') ||
          part.startsWith('X') || part.startsWith('F') ||
          part.startsWith('J') || part.startsWith('N') ||
          part.startsWith('V') || part.startsWith('H') ||
          part.startsWith('D') || part.startsWith('K') ||
          part.startsWith('L') || part.startsWith('O') ||
          part.startsWith('M') || part.startsWith('E') ||
          part.startsWith('I') || part.startsWith('Q') ||
          part.startsWith('R') || part.startsWith('Z') ||
          part.startsWith('Y') || part.startsWith('W')) {
        continue;
      }

      // When we start seeing kana or readings, mark reading section started
      if (/[\u3040-\u309F\u30A0-\u30FF]/.test(part) ||
          part.match(/^[A-Z]+$/) || part.includes('.')) {
        readingStarted = true;
      }

      if (readingStarted) {
        // On-yomi readings are typically in katakana or ALL CAPS in romaji
        if (part.match(/^[A-Z]+$/) || /[\u30A0-\u30FF]/.test(part)) {
          onReadings.push(part);
        }
        // Kun-yomi readings typically have a dot or are in hiragana
        else if (part.includes('.') || /[\u3040-\u309F]/.test(part)) {
          kunReadings.push(part);
        }
        // T1 marks nanori readings, which we can skip for now
        else if (part === 'T1') {
          break;
        }
      }
    }

    // Create the structured kanji object
    kanjiList.push({
      kanji,
      jis_code: jisCode,
      unicode,
      on_readings: onReadings,
      kun_readings: kunReadings,
      meanings,
    });
  }

  return kanjiList;
}

/**
 * Creates a SQLite database and table for kanji data
 * @param {string} dbPath - Path to the SQLite database file
 * @returns {Promise<sqlite3.Database>} - Database connection
 */
function initializeDatabase(dbPath) {
  // Ensure the database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Drop the kanji table if it exists and create a new one
      db.run(`DROP TABLE IF EXISTS kanji`, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create the kanji table
        db.run(
          `
          CREATE TABLE IF NOT EXISTS kanji (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character TEXT NOT NULL,
            jis_code INTEGER,
            unicode TEXT,
            on_readings TEXT,
            kun_readings TEXT,
            meanings TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `,
          (err) => {
            if (err) {
              reject(err);
              return;
            }

            resolve(db);
          }
        );
      });
    });
  });
}

/**
 * Inserts kanji data into the SQLite database
 * @param {sqlite3.Database} db - SQLite database connection
 * @param {Array} kanjiList - List of kanji objects to insert
 * @returns {Promise<void>}
 */
async function insertKanjiData(db, kanjiList) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Begin transaction for better performance
      db.run("BEGIN TRANSACTION");

      const kanjiStmt = db.prepare(
        "INSERT INTO kanji (character, jis_code, unicode, on_readings, kun_readings, meanings) VALUES (?, ?, ?, ?, ?, ?)"
      );

      let successCount = 0;
      let errorCount = 0;

      for (const kanjiObj of kanjiList) {
        try {
          // Serialize readings and meanings as JSON strings
          const onReadingsJson = JSON.stringify(kanjiObj.on_readings);
          const kunReadingsJson = JSON.stringify(kanjiObj.kun_readings);
          const meaningsJson = JSON.stringify(kanjiObj.meanings);

          // Insert kanji record with readings and meanings
          kanjiStmt.run(
            kanjiObj.kanji,
            kanjiObj.jis_code,
            kanjiObj.unicode,
            onReadingsJson,
            kunReadingsJson,
            meaningsJson,
            function (err) {
              if (err) {
                console.error(`Error inserting kanji ${kanjiObj.kanji}:`, err);
                errorCount++;
                return;
              }

              successCount++;
            }
          );
        } catch (error) {
          console.error(`Error processing kanji ${kanjiObj.kanji}:`, error);
          errorCount++;
        }
      }

      // Finalize prepared statement
      kanjiStmt.finalize();

      // Commit transaction
      db.run("COMMIT", (err) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(
          `Database insertion complete: ${successCount} successful, ${errorCount} errors`
        );
        resolve();
      });
    });
  });
}

/**
 * Main function to process kanji data
 * @param {string} inputFile - Optional path to override the default input file
 * @param {string} outputFile - Optional path to override the default output JSON file
 * @param {string} dbPath - Optional path to override the default database path
 */
async function processKanjiData(inputFile, dbPath) {
  try {
    console.log(`Reading kanji data from: ${inputFile}`);
    const data = fs.readFileSync(inputFile, "utf8");
    const parsedData = parseKanjiData(data);

    console.log(`Successfully parsed ${parsedData.length} kanji entries`);

    // Write to SQLite database
    console.log(`Initializing database at: ${dbPath}`);
    const db = await initializeDatabase(dbPath);

    console.log("Inserting data into database...");
    await insertKanjiData(db, parsedData);

    console.log(`SQLite data written to: ${dbPath}`);

    // Close the database connection
    db.close((err) => {
      if (err) {
        console.error("Error closing database:", err);
      } else {
        console.log("Database connection closed");
      }
    });
  } catch (error) {
    console.error("Error processing kanji data:", error);
  }
}

(async () => {
  try {
    await processKanjiData(
      path.resolve(__dirname, "../data/kanjidic_comb_utf8"),
      path.resolve(__dirname, "../assets/db/dict_2.db")
    );

    console.log("Conversion completed successfully");
  } catch (err) {
    console.error("Error during conversion:", err);
  }
})();
