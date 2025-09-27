import { openDatabaseSync } from 'expo-sqlite';
import { getFuriganaForText, searchFuriganaByPartialReading, searchTextsByReading } from '../services/database/furigana';

describe('Furigana Database Operations', () => {
  let db: any;

  beforeAll(() => {
    db = openDatabaseSync(':memory:');

    // Create furigana table for testing
    db.execSync(`
      CREATE TABLE furigana (
        id INTEGER PRIMARY KEY,
        text TEXT NOT NULL,
        reading TEXT NOT NULL,
        reading_hiragana TEXT,
        segments TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.execSync(`
      CREATE INDEX idx_furigana_text ON furigana(text)
    `);

    db.execSync(`
      CREATE INDEX idx_furigana_reading ON furigana(reading)
    `);

    // Insert test data
    db.execSync(`
      INSERT INTO furigana (text, reading, reading_hiragana, segments) VALUES
      ('言う', 'いう', 'いう', '[{"ruby":"言","rt":"い"},{"ruby":"う"}]'),
      ('間', 'ま', 'ま', '[{"ruby":"間","rt":"ま"}]'),
      ('あっと言う間に', 'あっというまに', 'あっというまに', '[{"ruby":"あっと"},{"ruby":"言","rt":"い"},{"ruby":"う"},{"ruby":"間","rt":"ま"},{"ruby":"に"}]'),
      ('今日', 'きょう', 'きょう', '[{"ruby":"今日","rt":"きょう"}]')
    `);
  });

  afterAll(() => {
    db.closeSync();
  });

  test('getFuriganaForText returns correct furigana data', async () => {
    const result = await getFuriganaForText(db, '言う');

    expect(result).toBeTruthy();
    expect(result?.text).toBe('言う');
    expect(result?.reading).toBe('いう');
    expect(result?.segments).toHaveLength(2);
    expect(result?.segments[0]).toEqual({ ruby: '言', rt: 'い' });
    expect(result?.segments[1]).toEqual({ ruby: 'う' });
  });

  test('getFuriganaForText returns null for non-existent text', async () => {
    const result = await getFuriganaForText(db, '存在しない');
    expect(result).toBeNull();
  });

  test('searchTextsByReading finds texts by reading', async () => {
    const results = await searchTextsByReading(db, 'いう');

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('言う');
    expect(results[0].reading).toBe('いう');
  });

  test('searchFuriganaByPartialReading finds texts by partial reading', async () => {
    const results = await searchFuriganaByPartialReading(db, 'あっと');

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('あっと言う間に');
    expect(results[0].reading).toBe('あっというまに');
  });

  test('furigana segments are parsed correctly', async () => {
    const result = await getFuriganaForText(db, 'あっと言う間に');

    expect(result?.segments).toHaveLength(5);
    expect(result?.segments[0]).toEqual({ ruby: 'あっと' });
    expect(result?.segments[1]).toEqual({ ruby: '言', rt: 'い' });
    expect(result?.segments[2]).toEqual({ ruby: 'う' });
    expect(result?.segments[3]).toEqual({ ruby: '間', rt: 'ま' });
    expect(result?.segments[4]).toEqual({ ruby: 'に' });
  });

  test('special readings like 義訓 are handled correctly', async () => {
    const result = await getFuriganaForText(db, '今日');

    expect(result?.segments).toHaveLength(1);
    expect(result?.segments[0]).toEqual({ ruby: '今日', rt: 'きょう' });
  });
});