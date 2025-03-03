const path = require('path');
const Database = require('better-sqlite3');
const { program } = require('commander');

// Configuration
const DB_PATH = path.join(__dirname, '..', 'jisho.db');

program
  .name('jisho-search')
  .description('Search the Japanese dictionary')
  .version('1.0.0')
  .option('-j, --japanese <word>', 'search by Japanese word')
  .option('-e, --english <word>', 'search by English meaning')
  .option('-x, --examples', 'include example sentences')
  .option('-l, --limit <number>', 'limit the number of results', '10')
  .parse(process.argv);

const options = program.opts();
const searchTerm = options.japanese || options.english;
const includeExamples = options.examples;
const limit = parseInt(options.limit, 10);

if (!searchTerm) {
  console.error('Error: Please provide a search term with --japanese or --english');
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

try {
  let results;

  if (options.japanese) {
    // Search by Japanese word
    results = db.prepare(`
      SELECT w.id as word_id, w.word, w.reading, m.meaning, m.part_of_speech, m.tags
      FROM words w
      LEFT JOIN meanings m ON w.id = m.word_id
      WHERE w.word LIKE ?
      LIMIT ?
    `).all(`%${options.japanese}%`, limit);
  } else if (options.english) {
    // Search by English meaning using FTS
    results = db.prepare(`
      SELECT w.id as word_id, w.word, w.reading, m.meaning, m.part_of_speech, m.tags
      FROM meanings_fts fts
      JOIN meanings m ON fts.rowid = m.id
      JOIN words w ON m.word_id = w.id
      WHERE fts.meaning MATCH ?
      LIMIT ?
    `).all(options.english, limit);
  }

  // Group results by word
  const groupedResults = {};
  for (const result of results) {
    const { word_id, word, reading, meaning, part_of_speech, tags } = result;

    if (!groupedResults[word_id]) {
      groupedResults[word_id] = {
        word,
        reading,
        meanings: [],
        examples: []
      };
    }

    groupedResults[word_id].meanings.push({
      meaning,
      part_of_speech,
      tags
    });
  }

  // Fetch examples if requested
  if (includeExamples) {
    for (const wordId of Object.keys(groupedResults)) {
      const examples = db.prepare(`
        SELECT e.japanese, e.english
        FROM examples e
        JOIN example_word_map ewm ON e.id = ewm.example_id
        WHERE ewm.word_id = ?
        LIMIT 3
      `).all(wordId);

      groupedResults[wordId].examples = examples;
    }
  }

  // Output results
  console.log(`\nSearch results for "${searchTerm}":`);
  console.log('-'.repeat(50));

  const entries = Object.values(groupedResults);
  if (entries.length === 0) {
    console.log('No results found.');
  } else {
    for (const entry of entries) {
      console.log(`Word: ${entry.word}${entry.reading ? ` [${entry.reading}]` : ''}`);

      console.log('\nMeanings:');
      entry.meanings.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.meaning}${m.part_of_speech ? ` (${m.part_of_speech})` : ''}${m.tags ? ` [${m.tags}]` : ''}`);
      });

      if (includeExamples && entry.examples.length > 0) {
        console.log('\nExamples:');
        entry.examples.forEach((ex, i) => {
          console.log(`  ${i + 1}. ${ex.japanese}`);
          console.log(`     ${ex.english}`);
        });
      }

      console.log('-'.repeat(50));
    }
  }

} catch (error) {
  console.error('Search failed:');
  console.error(error);
} finally {
  // Close the database connection
  db.close();
}
