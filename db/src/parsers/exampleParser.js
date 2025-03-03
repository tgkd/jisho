const fs = require('fs');

function parseExamples(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() !== '' && !line.startsWith('//'));

  const examples = [];
  let currentExample = null;

  for (const line of lines) {
    try {
      // Lines starting with A: contain the Japanese and English sentences
      if (line.startsWith('A:')) {
        const parts = line.substring(2).split('\t');
        if (parts.length >= 2) {
          currentExample = {
            japanese: parts[0].trim(),
            english: parts[1].trim(),
            parsed_tokens: null
          };
          examples.push(currentExample);
        }
      }
      // Lines starting with B: contain parsed tokens
      else if (line.startsWith('B:') && currentExample) {
        currentExample.parsed_tokens = line.substring(2).trim();
      }
    } catch (error) {
      console.error(`Error parsing example line: ${line}`);
      console.error(error);
    }
  }

  return examples;
}

module.exports = {
  parseExamples
};
