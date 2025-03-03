const fs = require('fs');
const readline = require('readline');
const { normalizeJapanese } = require('../utils/deduplication');

/**
 * Parse words from LJSON file with streaming for memory efficiency
 * @param {string} filePath - Path to the LJSON file
 * @return {Promise<Array>} - Array of parsed word entries
 */
function parseWords(filePath) {
  return new Promise((resolve, reject) => {
    const entries = [];
    const uniqueWordKeys = new Set(); // To track already seen words for deduplication

    try {
      // Stream the file line by line for better memory usage
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        if (!line || line.startsWith('//')) return;

        try {
          const data = JSON.parse(line);

          // Skip invalid entries
          if (!data) return;

          // Extract reading and kanji
          const readings = data.r || [];
          const kanjis = data.k || [];
          const senses = data.s || [];

          // Create entries for each reading and kanji combination
          for (const reading of readings) {
            // Create direct reading entry
            const readingKey = normalizeJapanese(reading);

            if (!uniqueWordKeys.has(readingKey)) {
              uniqueWordKeys.add(readingKey);

              entries.push({
                word: reading,
                reading: null,
                meanings: processSenses(senses)
              });
            }

            // Create entries with kanji as word and reading as reading
            for (const kanji of kanjis) {
              const kanjiKey = `${normalizeJapanese(kanji)}:${readingKey}`;

              if (!uniqueWordKeys.has(kanjiKey)) {
                uniqueWordKeys.add(kanjiKey);

                entries.push({
                  word: kanji,
                  reading: reading,
                  meanings: processSenses(senses)
                });
              }
            }
          }

          // Handle case with only kanji, no readings
          if (readings.length === 0 && kanjis.length > 0) {
            for (const kanji of kanjis) {
              const kanjiKey = normalizeJapanese(kanji);

              if (!uniqueWordKeys.has(kanjiKey)) {
                uniqueWordKeys.add(kanjiKey);

                entries.push({
                  word: kanji,
                  reading: null,
                  meanings: processSenses(senses)
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error parsing line: ${line.substring(0, 50)}...`, error.message);
        }
      });

      rl.on('close', () => {
        console.log(`Parsed ${entries.length} entries from ${filePath}`);
        resolve(entries);
      });

      rl.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Process senses into meaning objects
 * @param {Array} senses - Array of sense objects from JSON
 * @return {Array} - Array of meaning objects
 */
function processSenses(senses) {
  if (!senses || !Array.isArray(senses)) return [];

  return senses.map(sense => {
    const meanings = Array.isArray(sense.g) ? sense.g.join('; ') : '';
    const partOfSpeech = Array.isArray(sense.pos) ? sense.pos.join('; ') : '';
    const field = Array.isArray(sense.field) ? sense.field.join('; ') : '';
    const misc = Array.isArray(sense.misc) ? sense.misc.join('; ') : '';

    // Combine relevant tags
    let tags = [];
    if (field) tags.push(field);
    if (misc) tags.push(misc);

    // Convert tags array to string to prevent SQLite binding errors
    const tagsString = tags.length > 0 ? tags.join('; ') : null;

    return {
      meaning: meanings,
      part_of_speech: partOfSpeech,
      tags: tagsString
    };
  }).filter(meaning => meaning.meaning); // Remove empty meanings
}

module.exports = {
  parseWords
};
