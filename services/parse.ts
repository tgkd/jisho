import {
  isHiragana,
  isJapanese,
  isKana,
  isKanji,
  isKatakana,
  stripOkurigana,
  tokenize
} from "wanakana";
import type { FuriganaSegment } from "./database/types";
import segmenter from "./tsegmenter";

type Marker = "numbered" | "bullet" | "dash" | "rows" | "none";

type Divider = "comma" | "semicolon" | "dot" | "none";

type FormatOptions = {
  truncateRow?: number;
  truncateAll?: number;
};

export function deduplicateEn(meanings: string[]): string[] {
  return Array.from(
    new Set(
      meanings.flatMap((meaning) =>
        meaning.split(";").map((part) => part.trim())
      )
    )
  );
}

export function formatEn(
  meaning: string,
  listStyle: Marker = "none",
  options?: FormatOptions
): string {
  // Return empty string for null, undefined, or empty input
  if (!meaning) return "";

  // Split the string by semicolons and filter out any empty items
  const parts = meaning
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  // Return the original string if no valid parts found
  if (parts.length === 0) return meaning;

  // Apply truncation if specified in options
  if (options?.truncateRow && options.truncateRow > 0) {
    parts.forEach((part, index) => {
      if (part.length > options.truncateRow!) {
        parts[index] = part.substring(0, options.truncateRow) + "…";
      }
    });
  }

  // For a single item, just return it trimmed
  if (parts.length === 1) return parts[0];

  if (options?.truncateAll && options.truncateAll > 0) {
    let totalLength = 0;
    const keptParts = [];

    for (const part of parts) {
      // Add length of part plus the separator ("; " or "\n" depending on list style)
      const separatorLength =
        listStyle === "none" || listStyle === "rows" ? 2 : 1; // "; " is 2 chars, "\n" is 1 char
      const partLength =
        part.length + (keptParts.length > 0 ? separatorLength : 0);

      if (totalLength + partLength <= options.truncateAll) {
        keptParts.push(part);
        totalLength += partLength;
      } else {
        break; // Stop adding parts once we exceed the limit
      }
    }

    // Update parts with only the items that fit the total size limit
    parts.splice(0, parts.length, ...keptParts);
  }

  // Format multiple items based on the specified list style
  switch (listStyle) {
    case "bullet":
      return parts.map((part) => `• ${part}`).join("\n");
    case "dash":
      return parts.map((part) => `- ${part}`).join("\n");
    case "numbered":
      return parts.map((part, index) => `${index + 1}. ${part}`).join("\n");
    case "rows":
      return parts.join("\n");

    default:
      return parts.join("; ");
  }
}

export function formatJp(
  reading: string,
  withBrackets = true,
  divider: Divider = "comma"
): string {
  // Return empty string for null, undefined, or empty input
  if (!reading) return "";

  // Split the string by semicolons and filter out any empty items
  const parts = reading
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  // Return the original string if no valid parts found
  if (parts.length === 0) return reading;

  // For a single item, just return it trimmed
  if (parts.length === 1) return parts[0];

  let result = "";
  // Format multiple items based on the specified divider
  switch (divider) {
    case "semicolon":
      result = parts.join(";");
    case "dot":
      result = parts.join("・");
    case "none":
      result = parts.join(" ");
    default:
      result = parts.join("、");
  }

  if (withBrackets) {
    return `【${result}】`;
  }

  return result;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PARTS_OF_SPEECH: Record<string, string> = {
  n: "Noun",
  v1: "Ichidan verb",
  v5: "Godan verb",
  "adj-i": "I-adjective",
  "adj-na": "Na-adjective",
  "adj-t": "Taru adjective",
  adv: "Adverb",
  exp: "Expression",
  int: "Interjection",
  num: "Number",
  pref: "Prefix",
  suf: "Suffix",
  vs: "Suru verb",
  v5r: "Godan verb (irregular)",
  vz: "Ichidan verb (zuru)",
  vi: "Intransitive verb",
  vk: "Kuru verb",
  vn: "Irregular nu verb",
  vr: "Ru verb",
  "vs-c": "Suru verb - special class",
  "vs-i": "Suru verb - irregular",
  "vs-s": "Suru verb - special class",
};

export type FuriPair = [furigana: string, text: string];
type FuriLocation = [[start: number, end: number], content: string];

/**
 * Combines furigana with kanji into an array of string pairs.
 * @param  {String} word vocab kanji word
 * @param  {String} reading vocab kana reading
 * @param  {String|Object} furi furigana placement info
 * @return {Array} furigana/kanji pairs
 * @example
 * combineFuri('お世辞', 'おせじ', '1:せ;2:じ')
 * // => [['', 'お'], ['せ', '世'], ['じ', '辞']]
 * combineFuri('大人しい', 'おとなしい') // smart fallbacks
 * // => [['おとな', '大人'], ['', 'しい']]
 * combineFuri('使い方', 'つかいかた') // smart fallbacks
 * // => [['つか', '使'], ['', 'い'], ['かた', '方']]
 *
 * // special compound readings (義訓/熟字訓) are spread across relevant kanji
 * combineFuri('胡座', 'あぐら', '0:あぐら')
 * // => [['あぐら', '胡座']]
 */
export function combineFuri(word = "", reading = "", furi = "") {
  const furiLocs = parseFuri(furi);
  // 義訓/熟字訓 words with a single furi loc: 今日 "0:きょう"
  const isSpecialReading = furiLocs.length === 1 && [...word].every(isKanji);
  const isKanaWord = [...word].every(isKana);
  const isWanikaniMadness =
    [...reading].some(isHiragana) && [...reading].some(isKatakana);

  if (word === reading || isKanaWord) {
    return [["", word]];
  }

  if (!furi || isSpecialReading || isWanikaniMadness) {
    return basicFuri(word, reading);
  }

  return generatePairs(word, furiLocs);
}

/**
 * Displays simple furigana by removing redundant kana
 * @param  {String} [word=''] 'お見舞い'
 * @param  {String} [reading=''] 'おみまい'
 * @return {Array} [['', 'お'], ['見舞', 'みま'], ['', 'い']]
 */
export function basicFuri(word = "", reading = "") {
  if ([...word].every((c) => !isKana(c))) {
    return [[reading, word]];
  }

  const [bikago, okurigana] = [
    reading.slice(
      0,
      word.length -
        stripOkurigana(word, { leading: true, matchKanji: undefined }).length
    ),
    reading.slice(
      stripOkurigana(reading, { matchKanji: word, leading: undefined }).length
    ),
  ];

  const innerWordTokens = tokenize(
    removeExtraneousKana(word, bikago, okurigana)
  );
  const innerReadingString = removeExtraneousKana(reading, bikago, okurigana);

  const kanjiOddKanaEvenRegex = RegExp(
    innerWordTokens
      .map((c) => (isKanji(c as string) ? "(.*)" : `(${c})`))
      .join("")
  );

  const matchResult = innerReadingString.match(kanjiOddKanaEvenRegex) || [];
  const innerReadingChars = matchResult.slice(1);

  const ret = zip(innerReadingChars, innerWordTokens).map(
    ([reading, word = ""]) =>
      !reading || reading === word ? ["", word] : [reading, word]
  );

  if (bikago) {
    ret.unshift(["", bikago]);
  }

  if (okurigana) {
    ret.push(["", okurigana]);
  }

  return ret;
}

function removeExtraneousKana(str = "", leading = "", trailing = "") {
  return str
    .replace(RegExp(`^${leading}`), "")
    .replace(RegExp(`${trailing}$`), "");
}

export function parseFuri(
  data: string | Record<string, string>
): FuriLocation[] {
  if (typeof data === "object") {
    return Object.entries(data).map(([start, content]) => [
      [Number(start), Number(start) + 1],
      content,
    ]);
  }

  return data.split(";").map((entry) => {
    const [indexes, content] = entry.split(":");
    const [start, end] = indexes.split("-").map(Number);
    return [[start, end ? end + 1 : start + 1], content];
  });
}

/**
 * Generates array pairs via furigana location data
 * @param  {String} word 'お世辞'
 * @param  {Array} furiLocs [[[1, 2], 'せ'], [[2, 3], 'じ']]
 * @return {Array} [['', 'お'], ['せ', '世'], ['じ', '辞']]
 */
export function generatePairs(
  word = "",
  furiLocs: FuriLocation[] = []
): FuriPair[] {
  let prevCharEnd = 0;

  return furiLocs.reduce((pairs, [[start, end], furiText], index, source) => {
    if (start !== prevCharEnd) {
      pairs.push(["", word.slice(prevCharEnd, start)]);
    }

    pairs.push([furiText, word.slice(start, end)]);

    if (end < word.length && !source[index + 1]) {
      pairs.push(["", word.slice(end)]);
    }

    prevCharEnd = end;
    return pairs;
  }, [] as FuriPair[]);
}

export type ReadingToken = {
  text: string;
  reading?: string;
  form?: string;
};

/**
 * Parses a Japanese text breakdown into structured JSON format without references
 * @param {string} input - The breakdown text
 * @return {Array} - Array of parsed tokens
 */
function parseJapaneseBreakdown(input: string): ReadingToken[] {
  const result = [];
  const words = input.split(" ");

  for (let word of words) {
    if (!word.trim()) continue;

    const token = {} as ReadingToken;
    let remaining = word;

    // Extract kanji readings in parentheses like 彼(かれ)
    const readingMatch = remaining.match(/([^\(]+)\(([^\)]+)\)/);
    if (readingMatch) {
      token.text = readingMatch[1];
      token.reading = readingMatch[2];
      remaining = remaining.replace(/\([^\)]+\)/, "");
    } else {
      // If no reading parentheses, the whole text might be the token
      const textMatch = remaining.match(/^([^{[\]~]+)/);
      if (textMatch) {
        token.text = textMatch[1];
        remaining = remaining.replace(textMatch[1], "");
      }
    }

    // Remove reference numbers in square brackets like [01]
    remaining = remaining.replace(/\[\d+\]/, "");

    // Extract dictionary/alternative forms in curly brackets like {忙しかった}
    const formMatch = remaining.match(/{([^}]+)}/);
    if (formMatch) {
      token.form = formMatch[1];
      remaining = remaining.replace(/{[^}]+}/, "");
    }

    // Remove tildes that indicate compound words
    remaining = remaining.replace(/~/g, "");

    // Remove special reference numbers with hashtags
    remaining = remaining.replace(/(#\d+)/, "");

    // Clean up any remaining text
    remaining = remaining.trim();
    if (remaining && !token.text) {
      token.text = remaining;
    }

    if (Object.keys(token).length > 0) {
      result.push(token);
    }
  }

  return result;
}

/**
 * Process multiple lines of Japanese breakdown text
 * @param {string} text - Multiple lines of breakdown text
 * @return {Array} - Array of parsed lines
 */
export function processJpExampleText(text: string | undefined) {
  if (!text) return [];
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.flatMap((l) => parseJapaneseBreakdown(l));
}

/**
 * Converts parsed reading tokens into furigana segments that match the ruby/rt shape
 * used by {@link FuriganaText}.
 *
 * @param {ReadingToken[]} tokens - Structured reading tokens derived from {@link processJpExampleText}.
 * @returns {FuriganaSegment[]} Array of furigana segments ready for rendering.
 */
export function buildFuriganaSegmentsFromTokens(
  tokens: ReadingToken[]
): FuriganaSegment[] {
  return tokens
    .map((token) => {
      const surface = token.form ?? token.text;

      if (!surface?.trim()) {
        return null;
      }

      const segment: FuriganaSegment = {
        ruby: surface,
      };

      if (token.reading && token.reading.trim()) {
        segment.rt = token.reading.trim();
      }

      return segment;
    })
    .filter((segment): segment is FuriganaSegment => segment !== null);
}

/**
 * Combines elements from multiple arrays into arrays of corresponding elements.
 * Strings are treated as arrays of characters.
 * @param  {...Array|string} arrays - Arrays or strings to zip together
 * @return {Array} Array of arrays containing corresponding elements
 * @throws {Error} If no arguments are provided
 * @example
 * zip([1, 2, 3], ['a', 'b', 'c']) // [[1, 'a'], [2, 'b'], [3, 'c']]
 * zip([1, 2], ['a', 'b'], [true, false]) // [[1, 'a', true], [2, 'b', false]]
 * zip([1, 2, 3], ['a', 'b']) // [[1, 'a'], [2, 'b'], [3, undefined]]
 * zip('abc', 'xyz') // [['a', 'x'], ['b', 'y'], ['c', 'z']]
 * zip('abc', [1, 2, 3]) // [['a', 1], ['b', 2], ['c', 3]]
 */
export function zip(...arrays: (any[] | string)[]): any[][] {
  if (arrays.length === 0) {
    throw new Error("At least one array or string argument is required");
  }

  // Convert strings to arrays of characters
  const processedArrays = arrays.map((arr) =>
    typeof arr === "string" ? [...arr] : arr
  );

  const maxLength = Math.max(
    ...processedArrays
      .filter((arr) => Array.isArray(arr))
      .map((arr) => arr.length)
  );

  const result = [];

  for (let i = 0; i < maxLength; i++) {
    const row = [];
    for (const arr of processedArrays) {
      row.push(arr ? arr[i] : undefined);
    }
    result.push(row);
  }

  return result;
}

function removeJpSymbols(text: string): string {
  return text.replace(/[\u3000-\u303F\uFF00-\uFFEF]/g, "");
}

// Memoization cache for token segmentation
const tokenCache = new Map<string, string[]>();

export function getJpTokens(text: string): string[] {
  if (tokenCache.has(text)) {
    return tokenCache.get(text)!;
  }

  const tokens = segmenter(text)
    .map(removeJpSymbols)
    .filter((t) => t.length > 1 && isJapanese(t));

  // Cache result (limit cache size to prevent memory leaks)
  if (tokenCache.size > 100) {
    const firstKey = tokenCache.keys().next().value;
    if (firstKey !== undefined) {
      tokenCache.delete(firstKey);
    }
  }
  tokenCache.set(text, tokens);

  return tokens;
}

export function cleanupMdStr(text: string): string {
  if (!text) return "";

  return (
    text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, "")
      // Remove inline code
      .replace(/`([^`]+)`/g, "$1")
      // Remove bold/italic formatting
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Remove headers
      .replace(/^#+\s+/gm, "")
      // Remove blockquotes
      .replace(/^>\s+/gm, "")
      // Remove horizontal rules
      .replace(/^\s*[-*_]{3,}\s*$/gm, "")
      // Remove links but keep link text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove image tags
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
      // Remove HTML tags
      .replace(/<[^>]*>/g, "")
      // Preserve line breaks but normalize whitespace
      .replace(/\s+/g, " ")
      // md tables
      .replace(/\|/g, "")
      .replace(/-----/g, "")
      .trim()
  );
}

/**
 * Find all kanji characters in a given text
 * @param {string} text - The text to search for kanji characters
 * @return {string[]} - Array of unique kanji characters found in the text
 */
export function findKanji(text: string): string[] {
  return Array.from(new Set(Array.from(text).filter(char => {
    const code = char.charCodeAt(0);
    return code >= 0x4e00 && code <= 0x9faf;
  })));
}

/**
 * Removes furigana readings in square brackets from Japanese text
 * @param {string} text - The text containing furigana in square brackets
 * @return {string} - The text with furigana readings removed
 * @example
 * cleanupReadings('この譬話[たとえばなし]は、大切[たいせつ]な教訓[きょうくん]を含んでいます。')
 * // => 'この譬話は、大切な教訓を含んでいます。'
 */
export function cleanupJpReadings(text: string): string {
  if (!text) return "";
  return text.replace(/\[[^\]]*\]/g, "");
}

export type ChatPromptType = "word" | "passage";

interface WordPromptParams {
  word: string;
  reading: string;
  kanji?: string;
}

interface PassagePromptParams {
  text: string;
}

export function createChatPrompt(
  type: ChatPromptType,
  params: WordPromptParams | PassagePromptParams
): string {
  if (type === "word") {
    const { reading, kanji } = params as WordPromptParams;
    const displayWord = kanji || reading;
    return `Tell me about the Japanese word ${displayWord} (${reading}). What does it mean and how is it used?`;
  }

  if (type === "passage") {
    const { text } = params as PassagePromptParams;
    return `Help me understand this Japanese text:\n\n${text}`;
  }

  return "";
}

export function extractJapaneseTextWithParagraphs(markdown: string): string {
  if (!markdown) return "";

  const lines = markdown.split("\n");
  const japaneseLines: string[] = [];
  let inJapaneseSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (/###\s*日本語/i.test(trimmedLine)) {
      inJapaneseSection = true;
      continue;
    }

    if (/###\s*(English|Vocabulary|Grammar)/i.test(trimmedLine)) {
      break;
    }

    if (inJapaneseSection) {
      if (!trimmedLine) {
        japaneseLines.push("");
      } else {
        const hasJapanese = Array.from(trimmedLine).some((char) =>
          isJapanese(char)
        );
        if (hasJapanese) {
          japaneseLines.push(cleanupMdStr(trimmedLine));
        }
      }
    }
  }

  return japaneseLines.join("\n").trim();
}

export function extractJapaneseFromPassage(markdown: string): string {
  if (!markdown) return "";

  const lines = markdown.split("\n");
  const japaneseLines: string[] = [];
  let inJapaneseSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (
      /\[日本語\]|Japanese|nihongo/i.test(trimmedLine) &&
      !isJapanese(trimmedLine)
    ) {
      inJapaneseSection = true;
      continue;
    }

    if (
      /\[English\]|\[Vocabulary\]|Vocabulary|Translation/i.test(trimmedLine) &&
      !isJapanese(trimmedLine)
    ) {
      inJapaneseSection = false;
      continue;
    }

    if (inJapaneseSection && trimmedLine) {
      const hasJapanese = Array.from(trimmedLine).some((char) =>
        isJapanese(char)
      );
      if (hasJapanese) {
        japaneseLines.push(cleanupMdStr(trimmedLine));
      }
    }
  }

  if (japaneseLines.length > 0) {
    return japaneseLines.join(" ");
  }

  const allJapaneseText = lines
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      const japChars = Array.from(trimmed).filter((char) => isJapanese(char));
      return japChars.length > trimmed.length * 0.3;
    })
    .map((line) => cleanupMdStr(line))
    .filter(Boolean)
    .join(" ");

  return allJapaneseText;
}
