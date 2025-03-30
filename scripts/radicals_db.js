/**
 * radicals_db.js
 *
 * This script converts the kanji radicals CSV files into an SQLite database.
 * It reads from two CSV files:
 * 1. "Kanji Radicals Reference - Kanji > Radicals.csv" - Mapping kanji to radicals
 * 2. "Kanji Radicals Reference - Radicals > Kanji.csv" - Mapping radicals to kanji
 *
 * The script creates a unified database with a single table containing all information.
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');

// Paths for the input and output files
const DATA_DIR = path.join(__dirname, '../data');
const KANJI_TO_RADICALS_CSV = path.join(DATA_DIR, 'Kanji Radicals Reference - Kanji > Radicals.csv');
const RADICALS_TO_KANJI_CSV = path.join(DATA_DIR, 'Kanji Radicals Reference - Radicals > Kanji.csv');
const DB_PATH = path.join(DATA_DIR, 'radicals.db');

// Create a new database or open existing one
const db = new sqlite3.Database(DB_PATH);

// Create the tables
function setupDatabase() {
  return new Promise((resolve, reject) => {
    console.log('Setting up database...');

    // Drop existing tables if they exist
    db.run('DROP TABLE IF EXISTS kanji_radicals', (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Create a new kanji_radicals table
      db.run(`
        CREATE TABLE kanji_radicals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kanji TEXT NOT NULL,
          meaning TEXT,
          radicals TEXT,
          radical_names TEXT
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database tables created.');
          resolve();
        }
      });
    });
  });
}

// Process the Kanji to Radicals CSV file
function processKanjiToRadicals() {
  return new Promise((resolve, reject) => {
    console.log('Processing Kanji to Radicals CSV...');

    const kanjiData = {};

    fs.createReadStream(KANJI_TO_RADICALS_CSV)
      .pipe(csv())
      .on('data', (row) => {
        const kanji = row['Kanji'];
        const meaning = row['Meaning'];
        const radicals = row['Radicals'];

        if (kanji) {
          kanjiData[kanji] = {
            meaning,
            radicals
          };
        }
      })
      .on('end', () => {
        console.log(`Processed ${Object.keys(kanjiData).length} kanji entries.`);
        resolve(kanjiData);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

// Process the Radicals to Kanji CSV file
function processRadicalsToKanji(kanjiData) {
  return new Promise((resolve, reject) => {
    console.log('Processing Radicals to Kanji CSV...');

    const radicalData = {};

    fs.createReadStream(RADICALS_TO_KANJI_CSV)
      .pipe(csv())
      .on('data', (row) => {
        const radical = row['Radical'];
        const radicalName = row['Radical Name'];

        if (radical) {
          radicalData[radical] = radicalName;
        }
      })
      .on('end', () => {
        console.log(`Processed ${Object.keys(radicalData).length} radical entries.`);

        // Enhance kanji data with radical names
        for (const kanji in kanjiData) {
          const radicals = kanjiData[kanji].radicals.split(' + ');
          const radicalNames = radicals.map(r => {
            // Sometimes radicals in the data are names, not actual radical characters
            if (radicalData[r]) {
              return radicalData[r];
            }
            return r; // Use the radical name as is if we don't have mapping
          });

          kanjiData[kanji].radicalNames = radicalNames.join(', ');
        }

        resolve(kanjiData);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

// Insert data into the database
function insertData(kanjiData) {
  return new Promise((resolve, reject) => {
    console.log('Inserting data into database...');

    // Start a transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const stmt = db.prepare(`
        INSERT INTO kanji_radicals (kanji, meaning, radicals, radical_names)
        VALUES (?, ?, ?, ?)
      `);

      for (const kanji in kanjiData) {
        const data = kanjiData[kanji];
        stmt.run(
          kanji,
          data.meaning,
          data.radicals,
          data.radicalNames
        );
      }

      stmt.finalize();

      db.run('COMMIT', (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Successfully inserted data for ${Object.keys(kanjiData).length} kanji.`);
          resolve();
        }
      });
    });
  });
}

// Create indices for faster searches
function createIndices() {
  return new Promise((resolve, reject) => {
    console.log('Creating indices...');

    db.run('CREATE INDEX idx_kanji ON kanji_radicals (kanji)', (err) => {
      if (err) {
        reject(err);
      } else {
        db.run('CREATE INDEX idx_meaning ON kanji_radicals (meaning)', (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Indices created.');
            resolve();
          }
        });
      }
    });
  });
}

// Main function to orchestrate the conversion
async function main() {
  try {
    // Make sure directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Setup the database
    await setupDatabase();

    // Process the CSV files
    const kanjiData = await processKanjiToRadicals();
    const enhancedKanjiData = await processRadicalsToKanji(kanjiData);

    // Insert the data into the database
    await insertData(enhancedKanjiData);

    // Create indices for better performance
    await createIndices();

    console.log(`Conversion complete. Database saved to ${DB_PATH}`);

    // Close the database
    db.close();

  } catch (error) {
    console.error('Error:', error);
    db.close();
  }
}

// Run the script
main();
