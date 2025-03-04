export const markerMap = {
  P: "Common word",
  uk: "Usually written using kana alone",
  arch: "Archaic word",
  obs: "Obsolete word",
  sl: "Slang",
  hum: "Humble speech",
  pol: "Polite speech",
  fem: "Feminine language",
  male: "Masculine language",
  vulg: "Vulgar language",
  id: "Idiomatic expression",
  "on-mim": "Onomatopoeia/mimetic word",
  int: "Interjection",
  chn: "Children's language",
  rare: "Rare word",
  sk: "Special kanji usage",
  abbr: "Abbreviation",
  exp: "Expression",
  col: "Colloquialism",
  anat: "Anatomical term",
  ling: "Linguistics terminology",
  math: "Mathematics",
  phys: "Physics terminology",
  chem: "Chemistry terminology",
  biol: "Biology terminology",
  med: "Medical terminology",
  bus: "Business terminology",
  law: "Legal terminology",
  finc: "Finance terminology",
  comp: "Computer terminology",
  engr: "Engineering terminology",
  archit: "Architecture terminology",
  music: "Music terminology",
  shogi: "Shogi terminology",
  sumo: "Sumo terminology",
  mahj: "Mahjong terminology",
  shinto: "Shinto terminology",
  bud: "Buddhist terminology",
  o: "Honorific or respectful (sonkeigo) language",
  h: "Humble (kenjougo) language",
  v1: "Ichidan verb",
  v5: "Godan verb",
  v5aru: "Godan verb - -aru special class",
  v5b: "Godan verb with 'bu' ending",
  v5g: "Godan verb with 'gu' ending",
  v5k: "Godan verb with 'ku' ending",
  "v5k-s": "Godan verb - Iku/Yuku special class",
  v5m: "Godan verb with 'mu' ending",
  v5n: "Godan verb with 'nu' ending",
  v5r: "Godan verb with 'ru' ending",
  "v5r-i": "Godan verb with 'ru' ending (irregular verb)",
  v5s: "Godan verb with 'su' ending",
  v5t: "Godan verb with 'tsu' ending",
  v5u: "Godan verb with 'u' ending",
  "v5u-s": "Godan verb with 'u' ending (special class)",
  v5uru: "Godan verb - Uru old class verb (old form of Eru)",
  v5z: "Godan verb with 'zu' ending",
  vi: "Intransitive verb",
  vk: "Kuru verb - special class",
  vn: "Irregular nu verb",
  vr: "Ichidan verb - zuru verb (alternative form of -jiru verbs)",
  vs: "Noun or participle which takes the aux. verb suru",
  "vs-c": "su verb - precursor to the modern suru",
  joc: "Jocular, humorous, or playful language",
  an: "Antonym",
  abbrv: "Abbreviation",
  adj: "Adjective",
  "adj-i": "I-adjective",
};

/*
(joc) sorry
excuse me
excuse me, pardon me, I'm sorry, I beg your pardon
*/

/*
(1) (used to apologize or get someone's attention)
excuse me
(2) thank you
*/

export type Marker = keyof typeof markerMap;

/**
 * Extracts markers and their positions from text containing patterns like (P), (rare), etc.
 * Example input: "すみません(P); スミマセン(rare)"
 * @param text The input text containing markers in parentheses
 * @returns Array of objects with marker, startIndex, and endIndex properties
 */
export interface MarkerWithPosition {
  marker: Marker;
  startIndex: number;
  endIndex: number;
  rawText: string;
}

export function extractMarkers(text: string): MarkerWithPosition[] {
  if (!text) {
    return [];
  }

  const result: MarkerWithPosition[] = [];
  const markerPattern = /\(([^)]+)\)/g;
  let match;

  while ((match = markerPattern.exec(text)) !== null) {
    const potentialMarker = match[1];

    // Check if this is a valid marker in our map
    if (potentialMarker in markerMap) {
      result.push({
        marker: potentialMarker as Marker,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        rawText: match[0],
      });
    }
  }

  return result;
}

/**
 * Extracts clean text with markers removed
 * @param text Original text with markers like "すみません(P); スミマセン(rare)"
 * @returns Text with marker annotations removed: "すみません; スミマセン"
 */
export function removeMarkers(text: string): string {
  if (!text) {
    return "";
  }

  return text
    .replace(/\([^)]+\)/g, "")
    .replace(/;/g, "; ")
    .trim();
}
