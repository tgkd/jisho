const fs = require('fs');
const path = require('path');
const { parseExamples } = require('../src/parsers/exampleParser');

describe('Example Parser', () => {
  const testFilePath = path.join(__dirname, 'test-example-data.txt');
  const testContent = `// Comment line that should be skipped
A: 彼女は昨日ここに来ました。	She came here yesterday.
B: 彼女/は/昨日/ここ/に/来/まし/た/。
A: これは何ですか？	What is this?
B: これ/は/何/です/か/？
A: 日本語を勉強しています。	I am studying Japanese.
B: 日本語/を/勉強/し/て/い/ます/。
`;

  let parsedExamples;

  beforeAll(() => {
    fs.writeFileSync(testFilePath, testContent);
    parsedExamples = parseExamples(testFilePath);
  });

  afterAll(() => {
    fs.unlinkSync(testFilePath);
  });

  test('should parse the correct number of examples', () => {
    expect(parsedExamples).toHaveLength(3);
  });

  test('first example should be parsed correctly', () => {
    const firstExample = parsedExamples[0];
    expect(firstExample.japanese).toBe('彼女は昨日ここに来ました。');
    expect(firstExample.english).toBe('She came here yesterday.');
    expect(firstExample.parsed_tokens).toBe('彼女/は/昨日/ここ/に/来/まし/た/。');
  });

  test('second example should be parsed correctly', () => {
    const secondExample = parsedExamples[1];
    expect(secondExample.japanese).toBe('これは何ですか？');
    expect(secondExample.english).toBe('What is this?');
    expect(secondExample.parsed_tokens).toBe('これ/は/何/です/か/？');
  });

  test('third example should be parsed correctly', () => {
    const thirdExample = parsedExamples[2];
    expect(thirdExample.japanese).toBe('日本語を勉強しています。');
    expect(thirdExample.english).toBe('I am studying Japanese.');
    expect(thirdExample.parsed_tokens).toBe('日本語/を/勉強/し/て/い/ます/。');
  });

  test('all examples should have valid structure and data types', () => {
    parsedExamples.forEach((example, index) => {
      expect(typeof example.japanese).toBe('string');
      expect(typeof example.english).toBe('string');

      if (example.parsed_tokens !== null) {
        expect(typeof example.parsed_tokens).toBe('string');
      }
    });
  });
});
