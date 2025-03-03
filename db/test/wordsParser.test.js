const fs = require('fs');
const path = require('path');
const { parseWords } = require('../src/parsers/wordsParser');

describe('Words Parser', () => {
  const testFilePath = path.join(__dirname, 'test-words-data.json');
  const testContent = `// Comment line that should be skipped
{"r":["あおい"],"k":["青い"],"s":[{"g":["blue"],"pos":["adj-i"]}]}
{"r":["いぬ"],"k":["犬"],"s":[{"g":["dog"],"pos":["n"],"field":["animal"]}]}
{"k":["東京"],"r":["とうきょう"],"s":[{"g":["Tokyo"],"pos":["n","prop"],"misc":["city"]}]}
{"r":["たべる"],"k":["食べる"],"s":[{"g":["to eat"],"pos":["v1","vt"]},{"g":["to live on (e.g. a salary)","to live off"],"pos":["v1","vt"]}]}
{"k":["日本語"],"r":["にほんご"],"s":[{"g":["Japanese language"],"pos":["n"],"field":["linguistics"]}]}
`;

  let parsedWords;

  beforeAll(async () => {
    fs.writeFileSync(testFilePath, testContent);
    parsedWords = await parseWords(testFilePath);
  });

  afterAll(() => {
    fs.unlinkSync(testFilePath);
  });

  test('should parse all word entries correctly', () => {
    // We should have entries for each word and possibly more due to combinations
    expect(parsedWords.length).toBeGreaterThanOrEqual(5);

    // Check unique word forms
    const wordForms = new Set(parsedWords.map(entry => entry.word));
    expect(wordForms.size).toBeGreaterThanOrEqual(5);
  });

  test('blue entry should be parsed correctly', () => {
    const blueEntry = parsedWords.find(entry => entry.word === '青い' && entry.reading === 'あおい');
    expect(blueEntry).toBeDefined();
    expect(blueEntry.word).toBe('青い');
    expect(blueEntry.reading).toBe('あおい');
    expect(blueEntry.meanings[0].meaning).toBe('blue');
    expect(blueEntry.meanings[0].part_of_speech).toBe('adj-i');
  });

  test('eat entry should have multiple meanings', () => {
    const eatEntry = parsedWords.find(entry => entry.word === '食べる' && entry.reading === 'たべる');
    expect(eatEntry).toBeDefined();
    expect(eatEntry.word).toBe('食べる');
    expect(eatEntry.reading).toBe('たべる');
    expect(eatEntry.meanings.length).toBe(2);
    expect(eatEntry.meanings[0].meaning).toBe('to eat');
    expect(eatEntry.meanings[0].part_of_speech).toBe('v1,vt');
    expect(eatEntry.meanings[1].meaning).toBe('to live on (e.g. a salary),to live off');
    expect(eatEntry.meanings[1].part_of_speech).toBe('v1,vt');
  });

  test('tokyo entry should have field and misc tags', () => {
    const tokyoEntry = parsedWords.find(entry => entry.word === '東京' && entry.reading === 'とうきょう');
    expect(tokyoEntry).toBeDefined();
    expect(tokyoEntry.word).toBe('東京');
    expect(tokyoEntry.reading).toBe('とうきょう');
    expect(tokyoEntry.meanings[0].tags).toBe('n,prop,city');
  });

  test('all entries should have valid structure', () => {
    parsedWords.forEach((entry, index) => {
      // Word should be a string
      expect(typeof entry.word).toBe('string');

      // Reading can be a string or null
      expect(entry.reading === null || typeof entry.reading === 'string').toBeTruthy();

      // Meanings should be an array
      expect(Array.isArray(entry.meanings)).toBeTruthy();

      // Check each meaning
      entry.meanings.forEach((meaning, meaningIndex) => {
        expect(typeof meaning.meaning).toBe('string');
        expect(meaning.part_of_speech === null || typeof meaning.part_of_speech === 'string').toBeTruthy();
        expect(meaning.tags === null || typeof meaning.tags === 'string').toBeTruthy();
      });
    });
  });
});
