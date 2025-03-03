// Utilities for normalizing and deduplicating Japanese words and meanings

/**
 * Normalize Japanese text for consistent comparison
 * @param {string} text - Japanese text to normalize
 * @return {string} Normalized text
 */
function normalizeJapanese(text) {
  if (!text) return '';

  // Remove all whitespace and convert to half-width
  return text
    .trim()
    .replace(/\s+/g, '')
    .normalize('NFKC');
}

/**
 * Deduplicate entries based on normalized word and reading
 * @param {Array} entries - Array of word entries
 * @return {Array} Deduplicated entries
 */
function deduplicateEntries(entries) {
  const entryMap = new Map();

  for (const entry of entries) {
    if (!entry.word) continue;

    const normalizedWord = normalizeJapanese(entry.word);
    const normalizedReading = normalizeJapanese(entry.reading || '');
    const key = `${normalizedWord}:${normalizedReading}`;

    if (!entryMap.has(key)) {
      entryMap.set(key, {
        word: entry.word,
        reading: entry.reading,
        meanings: entry.meanings || []
      });
    } else {
      // Merge meanings
      const existingEntry = entryMap.get(key);
      existingEntry.meanings = deduplicateMeanings([
        ...existingEntry.meanings,
        ...(entry.meanings || [])
      ]);
    }
  }

  return Array.from(entryMap.values());
}

/**
 * Deduplicate meanings
 * @param {Array} meanings - Array of meaning objects
 * @return {Array} Deduplicated meanings
 */
function deduplicateMeanings(meanings) {
  const meaningMap = new Map();

  for (const meaning of meanings) {
    if (!meaning.meaning) continue;

    const normalizedMeaning = normalizeJapanese(meaning.meaning);
    const key = `${normalizedMeaning}:${meaning.part_of_speech || ''}`;

    if (!meaningMap.has(key)) {
      meaningMap.set(key, meaning);
    }
  }

  return Array.from(meaningMap.values());
}

/**
 * Generate possible word forms for matching
 * Optimized version that uses a Set for faster lookups and better memory usage
 * @param {Object} word - Word object with word and/or reading
 * @return {Set<string>} Set of possible word forms
 */
function generateWordForms(word) {
  const forms = new Set();

  if (!word) return forms;

  // Add the main word and reading
  if (word.word) {
    const normalizedWord = normalizeJapanese(word.word);
    forms.add(normalizedWord);

    // Add variations without long vowels
    forms.add(normalizedWord.replace(/[ーｰ]/g, ''));

    // Add variations with different particle cases
    if (normalizedWord.endsWith('する')) {
      forms.add(normalizedWord.slice(0, -2));
    }

    // Handle common inflections for verbs
    if (normalizedWord.length > 2) {
      // For i-adjectives
      if (normalizedWord.endsWith('い')) {
        forms.add(normalizedWord.slice(0, -1) + 'く'); // -ku form
        forms.add(normalizedWord.slice(0, -1) + 'くて'); // -kute form
      }

      // For verbs - only process if longer than 2 chars to avoid false positives
      if (normalizedWord.length > 2) {
        // Godan verb forms (simplified approach)
        if (normalizedWord.endsWith('る')) {
          forms.add(normalizedWord.slice(0, -1) + 'た'); // past
          forms.add(normalizedWord.slice(0, -1) + 'て'); // te-form
          forms.add(normalizedWord.slice(0, -1) + 'ない'); // negative
        }

        if (normalizedWord.endsWith('う')) {
          forms.add(normalizedWord.slice(0, -1) + 'った'); // past
          forms.add(normalizedWord.slice(0, -1) + 'って'); // te-form
        }
      }
    }
  }

  if (word.reading) {
    const normalizedReading = normalizeJapanese(word.reading);
    forms.add(normalizedReading);

    // Add variations without long vowels
    forms.add(normalizedReading.replace(/[ーｰ]/g, ''));
  }

  return forms;
}

/**
 * Extract word tokens from example sentences
 * Optimized for speed using RegExp
 * @param {Object} example - Example object with parsed_tokens
 * @return {Array<string>} Array of tokens
 */
function extractWordTokens(example) {
  if (!example || !example.parsed_tokens) return [];

  // Cache regex for better performance
  const tokenRegex = /\[(.*?)\]/g;
  const tokens = new Set();
  const matches = example.parsed_tokens.match(tokenRegex);

  if (matches) {
    for (const match of matches) {
      const token = match.slice(1, -1); // Remove the square brackets
      const normalizedToken = normalizeJapanese(token);
      if (normalizedToken && normalizedToken.length > 1) {
        tokens.add(normalizedToken);
      }
    }
  }

  // Also add direct tokens if available
  if (example.japanese) {
    const words = example.japanese.split(' ');
    for (const word of words) {
      const normalized = normalizeJapanese(word);
      if (normalized && normalized.length > 1) {
        tokens.add(normalized);
      }
    }
  }

  return Array.from(tokens);
}

module.exports = {
  normalizeJapanese,
  deduplicateEntries,
  deduplicateMeanings,
  generateWordForms,
  extractWordTokens
};
