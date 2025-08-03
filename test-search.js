#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'assets/db/d_3.db');

// Test search functionality with the new normalized schema
async function testSearch() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      console.log('Connected to database successfully');

      // Test 1: Check database structure
      console.log('\n=== Testing Database Structure ===');
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
          reject(err);
          return;
        }

        console.log('Tables found:', tables.map(t => t.name).slice(0, 10).join(', '), '...');

        // Test 2: Search for a word with the new schema
        console.log('\n=== Testing Search with New Schema ===');
        const query = `
          SELECT DISTINCT
            w.id,
            w.entry_id,
            w.frequency_score,
            wk.kanji,
            wr.reading,
            wr.romaji
          FROM words w
          LEFT JOIN word_kanji wk ON w.id = wk.word_id
          LEFT JOIN word_readings wr ON w.id = wr.word_id
          WHERE wr.reading = 'かど'
          LIMIT 5
        `;

        db.all(query, (err, results) => {
          if (err) {
            reject(err);
            return;
          }

          console.log('Search results for "かど":');
          results.forEach((result, index) => {
            console.log(`${index + 1}. ID: ${result.id}, Kanji: ${result.kanji}, Reading: ${result.reading}`);
          });

          // Test 3: Get meanings for a word
          if (results.length > 0) {
            const wordId = results[0].id;
            console.log(`\n=== Getting meanings for word ID ${wordId} ===`);

            const meaningQuery = `
              SELECT
                ws.parts_of_speech,
                wg.gloss
              FROM word_senses ws
              JOIN word_glosses wg ON ws.id = wg.sense_id
              WHERE ws.word_id = ?
              ORDER BY ws.sense_order, wg.gloss_order
              LIMIT 5
            `;

            db.all(meaningQuery, [wordId], (err, meanings) => {
              if (err) {
                reject(err);
                return;
              }

              console.log('Meanings:');
              meanings.forEach((meaning, index) => {
                console.log(`${index + 1}. ${meaning.gloss} (${meaning.parts_of_speech})`);
              });

              db.close();
              resolve();
            });
          } else {
            console.log('No results found');
            db.close();
            resolve();
          }
        });
      });
    });
  });
}

testSearch().then(() => {
  console.log('\n=== Test completed successfully ===');
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
