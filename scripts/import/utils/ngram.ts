/**
 * Pre-segments CJK runs into unigrams, bigrams, and trigrams joined by
 * spaces, so the default unicode61 FTS5 tokenizer indexes each n-gram as
 * a separate token. Lets queries like "曜" (single kanji) or "曜日"
 * (compound substring) match via FTS5 instead of falling back to LIKE.
 *
 * Latin / kana-only runs are skipped here because the existing word/
 * reading/reading_hiragana columns already cover prefix matching for
 * those scripts via unicode61's native word-boundary tokenization.
 */

const MAX_NGRAM_LEN = 3;

function isCjk(codePoint: number): boolean {
  return (
    (codePoint >= 0x3040 && codePoint <= 0x309f) || // hiragana
    (codePoint >= 0x30a0 && codePoint <= 0x30ff) || // katakana
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) || // CJK unified ideographs
    (codePoint >= 0x3400 && codePoint <= 0x4dbf)    // CJK unified ideographs ext A
  );
}

function extractCjkRuns(text: string): string[] {
  const runs: string[] = [];
  let current = '';
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && isCjk(cp)) {
      current += char;
    } else if (current) {
      runs.push(current);
      current = '';
    }
  }
  if (current) runs.push(current);
  return runs;
}

export function generateSearchNgrams(...fields: (string | null | undefined)[]): string {
  const tokens = new Set<string>();
  for (const field of fields) {
    if (!field) continue;
    for (const run of extractCjkRuns(field)) {
      const chars = [...run];
      const len = chars.length;
      for (let n = 1; n <= MAX_NGRAM_LEN && n <= len; n++) {
        for (let i = 0; i + n <= len; i++) {
          tokens.add(chars.slice(i, i + n).join(''));
        }
      }
    }
  }
  return [...tokens].join(' ');
}
