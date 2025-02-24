const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

function createTables(db) {
  return new Promise((resolve, reject) => {
    console.log("Creating tables...");
    db.serialize(() => {
      // Drop existing tables if they exist
      db.run("DROP TABLE IF EXISTS meanings");
      db.run("DROP TABLE IF EXISTS words");

      // Create words table
      db.run(`
        CREATE TABLE words (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT,
          reading TEXT,
          reading_hiragana TEXT,
          kanji TEXT,
          position INTEGER
        )
      `);

      // Create meanings table
      db.run(`
        CREATE TABLE meanings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word_id INTEGER,
          meaning TEXT,
          part_of_speech TEXT,
          field TEXT,
          misc TEXT,
          info TEXT,
          FOREIGN KEY (word_id) REFERENCES words (id)
        )
      `);

      // Create indexes
      db.run("CREATE INDEX idx_word ON words(word)");
      db.run("CREATE INDEX idx_reading ON words(reading)");
      db.run("CREATE INDEX idx_position ON words(position)");
      db.run("CREATE INDEX idx_kanji ON words(kanji)");

      console.log("Tables and indexes created successfully");
      resolve();
    });
  });
}
async function loadIndexFile(indexPath) {
  console.log("Loading index file...");
  const indexContent = await fs.promises.readFile(indexPath, "utf8");
  const indexMap = new Map();

  indexContent.split("\n").forEach((line) => {
    if (line && !line.startsWith("//")) {
      const [word, ...positions] = line.split(",");
      indexMap.set(word, positions.map(Number));
    }
  });

  console.log(`Loaded ${indexMap.size} index entries`);
  return indexMap;
}

function processReadings(readings) {
  const reading = readings.join(";");
  const readingHiragana = readings[0] || null;
  return [reading, readingHiragana];
}

function processKanji(kanji) {
  return kanji ? kanji.join(";") : null;
}

// ... keep existing imports and helper functions ...

function insertWord(db, word, data, position) {
  return new Promise((resolve, reject) => {
    const [reading, readingHiragana] = processReadings(data.r || []);
    const kanji = processKanji(data.k || []);

    db.run(
      `INSERT INTO words (word, reading, reading_hiragana, kanji, position)
       VALUES (?, ?, ?, ?, ?)`,
      [word, reading, readingHiragana, kanji, position],
      function (err) {
        if (err) {
          console.error(`Error inserting word: ${err.message}`);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

async function insertMeanings(db, wordId, senses) {
  if (!senses) return;

  for (const sense of senses) {
    const meanings = (sense.g || []).join(";");
    const pos = (sense.pos || []).join(";");
    const field = (sense.field || []).join(";");
    const misc = (sense.misc || []).join(";");
    const info = sense.inf;

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO meanings (word_id, meaning, part_of_speech, field, misc, info)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [wordId, meanings, pos, field, misc, info],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

async function convertToSqlite(ljsonPath, indexPath, outputDb) {
  const db = new sqlite3.Database(outputDb);

  try {
    await createTables(db);
    const indexMap = await loadIndexFile(indexPath);

    console.log("Reading LJSON file...");
    const fileContent = await fs.promises.readFile(ljsonPath, "utf8");
    const lines = fileContent
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("//"));

    const total = lines.length;
    console.log(`Found ${total} entries to process`);
    let processed = 0;
    let errors = 0;

    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < lines.length; i += batchSize) {
      const batch = lines.slice(i, i + batchSize);

      await new Promise((resolve, reject) => {
        db.run("BEGIN TRANSACTION", async (err) => {
          if (err) return reject(err);

          try {
            for (const line of batch) {
              try {
                const data = JSON.parse(line);
                const words = [];

                if (data.k) words.push(...data.k);
                if (data.r) words.push(...data.r);

                for (const word of words) {
                  const positions = indexMap.get(word) || [];
                  for (const position of positions) {
                    const wordId = await insertWord(db, word, data, position);
                    await insertMeanings(db, wordId, data.s);
                  }
                }
                processed++;
              } catch (e) {
                errors++;
                console.error(`Error processing line:`, e.message);
              }
            }

            db.run("COMMIT", (err) => {
              if (err) reject(err);
              else resolve();
            });
          } catch (e) {
            db.run("ROLLBACK", () => reject(e));
          }
        });
      });

      // Log progress
      console.log(
        `Processed ${processed}/${total} entries (${(
          (processed / total) *
          100
        ).toFixed(2)}%)`
      );
    }

    // Verify results
    const wordCount = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM words", (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    const meaningCount = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM meanings", (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    console.log("\nFinal Statistics:");
    console.log(`Total entries processed: ${processed}`);
    console.log(`Words in database: ${wordCount}`);
    console.log(`Meanings in database: ${meaningCount}`);
    console.log(`Errors encountered: ${errors}`);
  } catch (err) {
    console.error("Fatal error:", err);
    throw err;
  } finally {
    db.close();
  }
}

// ... keep existing promisify and main execution code ...

function promisify(fn) {
  return (...args) => {
    return new Promise((resolve, reject) => {
      fn(...args, function (err, ...results) {
        if (err) return reject(err);
        resolve(...results);
      });
    });
  };
}

(async () => {
  try {
    await convertToSqlite(
      path.resolve(__dirname, "../data/words.ljson"),
      path.resolve(__dirname, "../data/words.idx"),
      path.resolve(__dirname, "../assets/db/dict.db")
    );
    console.log("Conversion completed successfully");
  } catch (err) {
    console.error("Error during conversion:", err);
  }
})();
