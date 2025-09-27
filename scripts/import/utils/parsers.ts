/**
 * Utilities for parsing various data formats
 */

export interface WordEntry {
  kanji?: string[];
  readings: string[];
  senses: WordSense[];
  entryId?: number;
}

export interface WordSense {
  glosses: string[];
  partsOfSpeech: string[];
  fieldTags?: string[];
  miscTags?: string[];
  info?: string;
  glossType?: number;
}

export interface KanjiEntry {
  character: string;
  jisCode?: string;
  unicode?: string;
  grade?: number;
  strokeCount?: number;
  frequency?: number;
  meanings: string[];
  kunReadings: string[];
  onReadings: string[];
  nanoriReadings: string[];
}

export interface ExampleEntry {
  japanese: string;
  english: string;
  japaneseParsed?: string;
  id?: string;
}

export interface FuriganaEntry {
  text: string;
  reading: string;
  ruby: {
    ruby: string;
    rt?: string;
  }[];
}

/**
 * Parse a raw furigana JSON entry
 */
export function parseFuriganaJson(value: unknown, index?: number): FuriganaEntry | null {
  if (!value || typeof value !== 'object') {
    console.warn(`Furigana entry${index !== undefined ? ` #${index}` : ''} is not an object`);
    return null;
  }

  const cast = value as Record<string, unknown>;
  const text = typeof cast.text === 'string' ? cast.text.trim() : '';
  const reading = typeof cast.reading === 'string' ? cast.reading.trim() : '';
  const furigana = Array.isArray(cast.furigana) ? cast.furigana : [];

  if (!text || !reading || furigana.length === 0) {
    console.warn(`Furigana entry${index !== undefined ? ` #${index}` : ''} missing required fields`);
    return null;
  }

  const ruby: { ruby: string; rt?: string }[] = [];

  for (const segment of furigana) {
    if (!segment || typeof segment !== 'object') {
      continue;
    }

    const seg = segment as Record<string, unknown>;
    const rubyText = typeof seg.ruby === 'string' ? seg.ruby : null;
    const rtText = typeof seg.rt === 'string' ? seg.rt : undefined;

    if (!rubyText) {
      continue;
    }

    ruby.push({ ruby: rubyText, rt: rtText });
  }

  if (ruby.length === 0) {
    console.warn(`Furigana entry${index !== undefined ? ` #${index}` : ''} missing ruby segments`);
    return null;
  }

  return {
    text,
    reading,
    ruby
  };
}

/**
 * Parse words.ljson format
 */
export function parseWordsLJson(line: string, lineNumber: number): WordEntry | null {
  try {
    const data = JSON.parse(line.trim());

    if (!data.r || !Array.isArray(data.r)) {
      console.warn(`Line ${lineNumber}: Missing or invalid readings`);
      return null;
    }

    if (!data.s || !Array.isArray(data.s)) {
      console.warn(`Line ${lineNumber}: Missing or invalid senses`);
      return null;
    }

    const entry: WordEntry = {
      readings: data.r,
      senses: data.s.map((sense: any, index: number) => ({
        glosses: sense.g || [],
        partsOfSpeech: sense.pos || [],
        fieldTags: sense.field || [],
        miscTags: sense.misc || [],
        info: sense.info,
        glossType: sense.gt
      }))
    };

    // Add kanji if present
    if (data.k && Array.isArray(data.k)) {
      entry.kanji = data.k;
    }

    return entry;
  } catch (error) {
    console.warn(`Line ${lineNumber}: Failed to parse JSON: ${error}`);
    return null;
  }
}

/**
 * Parse kanjidic format
 */
export function parseKanjidicLine(line: string): KanjiEntry | null {
  try {
    // Skip comment lines
    if (line.startsWith('#') || line.trim().length === 0) {
      return null;
    }

    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) {
      return null;
    }

    const character = parts[0];
    const entry: KanjiEntry = {
      character,
      meanings: [],
      kunReadings: [],
      onReadings: [],
      nanoriReadings: []
    };

    let currentMeaning = '';
    let inMeaning = false;
    let inNanoriSection = false;

    const katakanaRegex = /^[\u30A0-\u30FF・ーヽヾヵヶ]+$/u;
    const hiraganaRegex = /^[\-\.・\u3040-\u309Fー]+$/u;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];

      // Handle meanings in braces
      if (part.startsWith('{')) {
        inMeaning = true;
        currentMeaning = part.substring(1);
        if (part.endsWith('}')) {
          entry.meanings.push(currentMeaning.substring(0, currentMeaning.length - 1));
          inMeaning = false;
          currentMeaning = '';
        }
        continue;
      }

      if (inMeaning) {
        if (part.endsWith('}')) {
          currentMeaning += ' ' + part.substring(0, part.length - 1);
          entry.meanings.push(currentMeaning);
          inMeaning = false;
          currentMeaning = '';
        } else {
          currentMeaning += ' ' + part;
        }
        continue;
      }

      if (/^T\d+/.test(part)) {
        inNanoriSection = true;
        continue;
      }

      // Parse coded information
      if (part.startsWith('U')) {
        entry.unicode = part;
      } else if (part.startsWith('G') && part.length > 1) {
        entry.grade = parseInt(part.substring(1));
      } else if (part.startsWith('S') && part.length > 1) {
        entry.strokeCount = parseInt(part.substring(1));
      } else if (part.startsWith('F') && part.length > 1) {
        entry.frequency = parseInt(part.substring(1));
      } else if (/^\d+$/.test(part) && !entry.jisCode) {
        entry.jisCode = part;
      } else if (katakanaRegex.test(part) && /[\u30A0-\u30FF]/.test(part)) {
        entry.onReadings.push(part);
      } else if (hiraganaRegex.test(part) && /[\u3040-\u309F]/.test(part)) {
        if (inNanoriSection) {
          entry.nanoriReadings.push(part);
        } else {
          entry.kunReadings.push(part);
        }
      }
    }

    return entry;
  } catch (error) {
    console.warn(`Failed to parse kanjidic line: ${line.substring(0, 50)}... Error: ${error}`);
    return null;
  }
}

/**
 * Parse examples.utf format
 */
export function parseExamples(content: string): ExampleEntry[] {
  const lines = content.split('\n');
  const examples: ExampleEntry[] = [];

  let currentExample: Partial<ExampleEntry> = {};

  for (const line of lines) {
    if (line.startsWith('A: ')) {
      // English line
      const content = line.substring(3);
      const [english, idPart] = content.split('#ID=');

      currentExample = {
        english: english.trim(),
        id: idPart?.trim()
      };
    } else if (line.startsWith('B: ') && currentExample.english) {
      // Japanese line
      currentExample.japanese = line.substring(3).trim();
      currentExample.japaneseParsed = line.substring(3).trim();

      if (currentExample.english && currentExample.japanese) {
        examples.push(currentExample as ExampleEntry);
      }
      currentExample = {};
    }
  }

  return examples;
}

/**
 * Parse CSV with proper quote handling
 */
export function parseCSV(content: string): string[][] {
  const lines = content.split('\n');
  const result: string[][] = [];

  for (const line of lines) {
    if (line.trim().length === 0) continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    row.push(current.trim());
    result.push(row);
  }

  return result;
}

/**
 * Convert hiragana to romaji (basic conversion)
 */
export function hiraganaToRomaji(hiragana: string): string {
  const hiraganaToRomajiMap: Record<string, string> = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'ゐ': 'wi', 'ゑ': 'we', 'を': 'wo', 'ん': 'n',
    'ー': '-', 'っ': ''
  };

  let result = '';
  for (let i = 0; i < hiragana.length; i++) {
    const char = hiragana[i];

    // Handle small tsu (っ) - doubles next consonant
    if (char === 'っ' && i < hiragana.length - 1) {
      const nextChar = hiragana[i + 1];
      const nextRomaji = hiraganaToRomajiMap[nextChar];
      if (nextRomaji && nextRomaji[0]) {
        result += nextRomaji[0]; // Add first consonant
      }
      continue;
    }

    result += hiraganaToRomajiMap[char] || char;
  }

  return result;
}

/**
 * Normalize Japanese text for better search matching
 */
export function normalizeJapanese(text: string): string {
  // Convert full-width to half-width
  return text
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ') // Full-width space to regular space
    .trim();
}

/**
 * Validate word entry data
 */
export function validateWordEntry(entry: WordEntry, lineNumber?: number): boolean {
  const prefix = lineNumber ? `Line ${lineNumber}: ` : '';

  if (!entry.readings || entry.readings.length === 0) {
    console.warn(`${prefix}Entry missing readings`);
    return false;
  }

  if (!entry.senses || entry.senses.length === 0) {
    console.warn(`${prefix}Entry missing senses`);
    return false;
  }

  for (const sense of entry.senses) {
    if (!sense.glosses || sense.glosses.length === 0) {
      console.warn(`${prefix}Sense missing glosses`);
      return false;
    }
  }

  return true;
}
