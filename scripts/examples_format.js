const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

// line: Sentence id [tab] Lang [tab] Script name [tab] Username [tab] Transcription

/**
 * Parses a Japanese transcription with furigana notation
 * @param {string} transcription - The transcription text with [kanji|reading] format
 * @return {Object} - Object with parsedText and readings
 */
function parseTranscription(transcription) {
  const result = {
    parsedText: "",
    readings: [],
  };

  let position = 0;
  const regex = /\[([^|]+)\|([^\]]+)\]/g;
  let match;

  while ((match = regex.exec(transcription)) !== null) {
    // Add any text before this match
    const textBefore = transcription.substring(position, match.index);
    result.parsedText += textBefore;

    const kanji = match[1];
    const readingParts = match[2].split("|");

    // Add the kanji to the plain text
    result.parsedText += kanji;

    // Add reading information
    result.readings.push({
      kanji: kanji,
      reading: readingParts.join(""),
      position: result.parsedText.length - kanji.length,
    });

    // Update position for next iteration
    position = match.index + match[0].length;
  }

  // Add any remaining text after the last match
  result.parsedText += transcription.substring(position);

  return result;
}

/**
 * Parses a line from the examples file
 * @param {string} line - A single line from the examples file
 * @return {Object} - Parsed sentence data
 */
function parseLine(line) {
  const parts = line.split("\t");
  if (parts.length < 5) return null;

  const [id, lang, script, username, transcription] = parts;
  const parsedTranscription = parseTranscription(transcription);

  console.log(parsedTranscription);

  return {
    text: parsedTranscription.parsedText,
    readings: parsedTranscription.readings,
  };
}

const DB_OUT = path.resolve(__dirname, "../assets/db/dict_2.db");
const DATA_IN = path.resolve(__dirname, "../data/jpn_transcriptions.tsv");

async function main() {
  const db = new sqlite3.Database(DB_OUT);
  const data = await fs.promises.readFile(DATA_IN, "utf8");
  const lines = data.split("\n").filter((line) => line.trim());
  const rows = lines
    .map((line) => parseLine(line))
    .filter((item) => item !== null);

  /* rows:
    {
  parsedText: '申し訳ありませんが、本日の営業は終了いたしました。',
  readings: [
    { kanji: '申', reading: 'もう', position: 0 },
    { kanji: '訳', reading: 'わけ', position: 2 },
    { kanji: '本日', reading: 'ほんじつ', position: 10 },
    { kanji: '営業', reading: 'えいぎょう', position: 13 },
    { kanji: '終了', reading: 'しゅうりょう', position: 16 }
  ]
}
{
  parsedText: '小額の札にいたしますか、それとも高額の札にいたしましょうか。',
  readings: [
    { kanji: '小額', reading: 'しょうがく', position: 0 },
    { kanji: '札', reading: 'さつ', position: 3 },
    { kanji: '高額', reading: 'こうがく', position: 16 },
    { kanji: '札', reading: 'さつ', position: 19 }
  ]
}
    */
  new Promise((resolve, reject) => {
    db.run("BEGIN TRANSACTION", async (err) => {
      if (err) return reject(err);

      try {
        const stmt = db.prepare(`
            INSERT INTO transcriptions (text, readings)
            VALUES (?, ?)
          `);

        for (const r of rows) {
          await new Promise((resolve, reject) => {
            stmt.run(r.parsedText, JSON.stringify(r.readings), (err) => {
              if (err) {
                console.error(`Error inserting example: ${err.message}`);
                reject(err);
              } else {
                resolve();
              }
            });
          });
        }

        await new Promise((resolve, reject) => {
          stmt.finalize((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        db.run("COMMIT", (err) => {
          if (err) reject(err);
          else {
            console.log(
              `Inserted ${examples.length} example sentences into database`
            );
            resolve();
          }
        });
      } catch (e) {
        db.run("ROLLBACK", () => reject(e));
      }
    });
  });
  return results;
}

(async () => {
  try {
    main();
  } catch (error) {
    console.error(error);
  }
})();
