import { SQLiteDatabase } from "expo-sqlite";
import { AiExample } from "../request";
import {
  DBDictEntry,
  DBWordMeaning,
  DBExampleSentence,
  DictionaryEntry,
  WordMeaning,
  ExampleSentence,
} from "./types";
import { dbWordToDictEntry } from "./utils";

export async function addExamplesList(
  wId: number,
  examples: AiExample[],
  db: SQLiteDatabase
) {
  try {
    await db.withTransactionAsync(async () => {
      for (const example of examples) {
        await db.runAsync(
          "INSERT INTO examples (japanese_text, english_text, word_id) VALUES (?, ?, ?)",
          [example.jp, example.en, wId]
        );
      }
    });
  } catch (error) {
    console.error("Failed to add examples:", error);
    throw error;
  }
}

export async function getDictionaryEntry(
  db: SQLiteDatabase,
  id: number,
  withExamples: boolean
): Promise<{
  word: DictionaryEntry;
  meanings: WordMeaning[];
  examples: ExampleSentence[];
} | null> {
  try {
    const word = await db.getFirstAsync<DBDictEntry>(
      "SELECT * FROM words WHERE id = ?",
      [id]
    );

    if (!word) {
      return null;
    }

    const meanings = await db.getAllAsync<DBWordMeaning>(
      "SELECT * FROM meanings WHERE word_id = ?",
      [id]
    );

    if (withExamples) {
      const examples = await getWordExamples(db, dbWordToDictEntry(word));

      return {
        word: {
          ...word,
          readingHiragana: word?.reading_hiragana || null,
        },
        meanings: meanings.map((m) => ({
          ...m,
          wordId: id,
          partOfSpeech: m.part_of_speech || null,
        })),
        examples,
      };
    }

    return {
      word: dbWordToDictEntry(word),
      meanings: meanings.map((m) => ({
        ...m,
        wordId: id,
        partOfSpeech: m.part_of_speech || null,
      })),
      examples: [],
    };
  } catch (error) {
    console.error("Failed to get dictionary entry:", error);
    return null;
  }
}

export async function getWordExamples(
  db: SQLiteDatabase,
  word: DictionaryEntry
): Promise<ExampleSentence[]> {
  try {
    const id = word.id;
    const examplesByWordId = await db.getAllAsync<DBExampleSentence>(
      `
      SELECT id, japanese_text, english_text, tokens, example_id
      FROM examples
      WHERE word_id = ?
      ORDER BY length(japanese_text)
      LIMIT 5
      `,
      [id]
    );

    if (examplesByWordId && examplesByWordId.length > 0) {
      return examplesByWordId.map((e) => ({
        ...e,
        japaneseText: e.japanese_text,
        englishText: e.english_text,
        exampleId: e.example_id || null,
      }));
    }

    const examplesByText = await db.getAllAsync<DBExampleSentence>(
      `
      SELECT id, japanese_text, english_text, tokens, example_id
      FROM examples
      WHERE
        (tokens IS NOT NULL AND tokens != '' AND
         (json_valid(tokens) AND
          EXISTS(SELECT 1 FROM json_each(tokens) WHERE value = ?)))
        OR
        (japanese_text LIKE ? AND
         (japanese_text LIKE ? || '%' OR
          japanese_text LIKE '%' || ? OR
          japanese_text LIKE '%' || ? || '%'))
      ORDER BY length(japanese_text)
      LIMIT 5
      `,
      [word.word, `%${word.word}%`, word.word, word.word, word.word]
    );

    return examplesByText.map((e) => ({
      ...e,
      japaneseText: e.japanese_text,
      englishText: e.english_text,
      exampleId: e.example_id || null,
    }));
  } catch (error) {
    console.error("Failed to get examples:", error);
    return [];
  }
}
