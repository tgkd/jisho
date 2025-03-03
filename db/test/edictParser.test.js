const fs = require('fs');
const path = require('path');
const { parseEdict } = require('../src/parsers/edictParser');

describe('EDICT Parser', () => {
  const testFilePath = path.join(__dirname, 'test-edict-data.txt');
  const testContent = `; Comment line that should be skipped
思いやり(P);思い遣り [おもいやり] /(n) consideration/thoughtfulness/sympathy/compassion/feeling/kindness/understanding/regard/kindheartedness/(P)/EntL1309180X/
思いやる(P);思い遣る [おもいやる] /(v5r,vt) (1) to sympathize with/to sympathise with/to feel for/to be considerate of/to show consideration for/to bear in mind/(v5r,vt) (2) to think of (a far-off person, place, etc.)/to cast one's mind to/(v5r,vt) (3) (as 思いやられる) to worry about/to feel anxious about/to be concerned about/(P)/EntL1851450X/
思いを寄せる;想いを寄せる;想いをよせる;思いをよせる [おもいをよせる] /(exp,v1) (1) to give one's heart to/to fall in love/(exp,v1) (2) to turn one's mind towards/to think of/EntL2099780/
`;

  let parsedEntries;

  beforeAll(() => {
    fs.writeFileSync(testFilePath, testContent);
    parsedEntries = parseEdict(testFilePath);
  });

  afterAll(() => {
    fs.unlinkSync(testFilePath);
  });

  test('should parse the correct number of entries', () => {
    expect(parsedEntries).toHaveLength(3);
  });

  test('first entry should be parsed correctly', () => {
    const firstEntry = parsedEntries[0];
    expect(firstEntry.word).toBe('思いやり(P);思い遣り');
    expect(firstEntry.reading).toBe('おもいやり');
    expect(firstEntry.entryId).toBe('EntL1309180X');
    expect(firstEntry.meanings[0].meaning).toBe('consideration/thoughtfulness/sympathy/compassion/feeling/kindness/understanding/regard/kindheartedness');
    expect(firstEntry.meanings[0].tags).toContain('n');
  });

  test('second entry should be parsed correctly with multiple meanings', () => {
    const secondEntry = parsedEntries[1];
    expect(secondEntry.word).toBe('思いやる(P);思い遣る');
    expect(secondEntry.reading).toBe('おもいやる');
    expect(secondEntry.entryId).toBe('EntL1851450X');
    expect(secondEntry.meanings).toHaveLength(3);
    expect(secondEntry.meanings[0].tags).toContain('v5r');
    expect(secondEntry.meanings[0].tags).toContain('vt');
  });

  test('third entry should be parsed correctly with multiple word forms', () => {
    const thirdEntry = parsedEntries[2];
    expect(thirdEntry.word).toBe('思いを寄せる;想いを寄せる;想いをよせる;思いをよせる');
    expect(thirdEntry.reading).toBe('おもいをよせる');
    expect(thirdEntry.entryId).toBe('EntL2099780');
  });
});
