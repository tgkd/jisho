import { SQLiteDatabase } from "expo-sqlite";
import { buildFuriganaSegmentsFromTokens, processJpExampleText } from "../parse";
import { AiExample } from "../request";
import {
  DBDictEntry,
  DBWordMeaning,
  DBExampleSentence,
  DictionaryEntry,
  WordMeaning,
  ExampleSentence,
  FuriganaSegment,
} from "./types";
import { dbWordToDictEntry } from "./utils";

function isSegment(value: unknown): value is FuriganaSegment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const segment = value as Record<string, unknown>;
  const ruby = segment.ruby;
  if (typeof ruby !== "string" || ruby.trim().length === 0) {
    return false;
  }

  const rt = segment.rt;
  if (rt !== undefined && typeof rt !== "string") {
    return false;
  }

  return true;
}

function parseSegmentsFromJson(raw: string): FuriganaSegment[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const segments = parsed.filter(isSegment) as FuriganaSegment[];
    return segments.length > 0 ? segments : null;
  } catch (error) {
    console.warn("Failed to parse example tokens JSON:", error);
    return null;
  }
}

function deriveExampleFurigana(tokens?: string | null): {
  segments: FuriganaSegment[];
  reading: string | null;
} {
  if (!tokens) {
    return { segments: [], reading: null };
  }

  const trimmed = tokens.trim();
  if (!trimmed) {
    return { segments: [], reading: null };
  }

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const jsonSegments = parseSegmentsFromJson(trimmed);
    if (jsonSegments) {
      const reading = jsonSegments
        .map((segment) => segment.rt?.trim() || segment.ruby)
        .join("")
        .trim();

      return {
        segments: jsonSegments,
        reading: reading.length > 0 ? reading : null,
      };
    }
  }

  const readingTokens = processJpExampleText(trimmed);
  if (readingTokens.length === 0) {
    return { segments: [], reading: null };
  }

  const segments = buildFuriganaSegmentsFromTokens(readingTokens);
  const reading = readingTokens
    .map((token) => token.reading?.trim() || token.form?.trim() || token.text?.trim() || "")
    .filter(Boolean)
    .join("")
    .trim();

  return {
    segments,
    reading: reading.length > 0 ? reading : null,
  };
}

function mapDbExampleSentence(row: DBExampleSentence): ExampleSentence {
  const tokens = row.tokens ?? null;
  const { segments, reading } = deriveExampleFurigana(tokens);
  const normalizedReading =
    typeof row.reading === "string" && row.reading.trim().length > 0
      ? row.reading
      : reading;

  return {
    id: row.id,
    tokens,
    reading: normalizedReading ?? null,
    segments,
    japaneseText: row.japanese_text,
    englishText: row.english_text,
    exampleId: row.example_id || null,
  };
}

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
      return examplesByWordId.map(mapDbExampleSentence);
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

    return examplesByText.map(mapDbExampleSentence);
  } catch (error) {
    console.error("Failed to get examples:", error);
    return [];
  }
}
