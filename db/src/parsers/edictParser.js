const fs = require('fs');
const path = require('path');

function parseEdict(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() !== '');

  // Skip the first line if it's a copyright notice
  const entries = lines[0].startsWith(';') ? lines.slice(1) : lines;

  const results = [];

  for (const entry of entries) {
    try {
      // Skip comment lines
      if (entry.startsWith(';')) continue;

      // Format is "word [reading] /(part-of-speech,etc.)meaning1/(part-of-speech,etc.)meaning2/.../EntryID/"
      const match = entry.match(/^(.+?)\s+\[(.*?)\]\s+\/(.+)\/$/);

      if (!match) continue;

      const [, word, reading, meaningsAndIdStr] = match;

      // Extract the EntL ID from the last section
      const entryIdMatch = meaningsAndIdStr.match(/Ent([^\/]+)$/);
      const entryId = entryIdMatch ? `Ent${entryIdMatch[1]}` : null;

      // Remove the EntL ID from the meanings string
      let meaningsStr = meaningsAndIdStr;
      if (entryId) {
        meaningsStr = meaningsStr.replace(`/${entryId}`, '');
      }

      // Split meanings by the "/" character, but respect those inside parentheses
      const meanings = [];
      let currentMeaning = '';
      let insideParentheses = 0;

      for (let i = 0; i < meaningsStr.length; i++) {
        const char = meaningsStr[i];
        if (char === '(' && meaningsStr[i-1] !== '\\') insideParentheses++;
        else if (char === ')' && meaningsStr[i-1] !== '\\') insideParentheses--;
        else if (char === '/' && insideParentheses === 0) {
          if (currentMeaning.trim() !== '') {
            meanings.push(currentMeaning.trim());
          }
          currentMeaning = '';
          continue;
        }
        currentMeaning += char;
      }

      // Add the last meaning if any
      if (currentMeaning.trim() !== '') {
        meanings.push(currentMeaning.trim());
      }

      // Process each meaning to extract tags and the actual meaning
      const processedMeanings = meanings.map(meaning => {
        const tags = [];

        // Extract part of speech and other tags enclosed in parentheses
        const cleanMeaning = meaning.replace(/\(([^)]+)\)/g, (match, tagContent) => {
          // Check if this is actually part of the meaning (e.g. an explanation in parentheses)
          if (tagContent.match(/^(adj|v|n|adv|exp|pn|prt|aux|conj|int|prefix|suffix|P)-?/i) ||
              tagContent.match(/^(See|lit|fig|fam|hon|hum|sl|vulg|arch|obs|rare|poet|m|f|X|col|id|uk|proverb|yoji|abbr|gikun|ksb|ateji)/i)) {
            tags.push(tagContent);
            return '';
          }
          // If it doesn't look like a tag, keep it in the meaning
          return match;
        }).trim();

        // Convert tags array to string to prevent SQLite binding errors
        const tagsString = tags.length > 0 ? tags.join('; ') : null;

        return {
          meaning: cleanMeaning,
          tags: tagsString,
          part_of_speech: null // Include part_of_speech to match the structure from wordsParser
        };
      });

      results.push({
        word: word.trim(),
        reading: reading ? reading.trim() : null,
        meanings: processedMeanings,
        entryId
      });
    } catch (error) {
      console.error(`Error parsing entry: ${entry}`);
      console.error(error);
    }
  }

  return results;
}

module.exports = {
  parseEdict
};
