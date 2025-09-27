import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { DatabaseManager } from '../scripts/import/utils/database';
import { FuriganaImporter } from '../scripts/import/furigana-importer';

const schemaPath = path.join(__dirname, '../schema.sql');

interface FuriganaRow {
  text: string;
  reading: string;
  reading_hiragana: string | null;
  segments: string;
}

function createTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'furigana-import-'));
}

describe('FuriganaImporter', () => {
  let tempDir: string;
  let dbPath: string;
  let dataPath: string;

  beforeEach(async () => {
    tempDir = createTempDir();
    dbPath = path.join(tempDir, 'test.db');
    dataPath = path.join(tempDir, 'furigana.json');

    const db = new DatabaseManager({ path: dbPath });
    try {
      await db.initializeSchema(schemaPath);
    } finally {
      db.close();
    }
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('imports furigana entries and updates existing rows on conflict', async () => {
    const firstPayload = [
      {
        text: '漢字',
        reading: 'かんじ',
        furigana: [
          { ruby: '漢', rt: 'かん' },
          { ruby: '字', rt: 'じ' }
        ]
      }
    ];

    writeFileSync(dataPath, JSON.stringify(firstPayload), 'utf8');

    const importer = new FuriganaImporter(dbPath);
    await importer.import(dataPath);
    importer.close();

    const db = new DatabaseManager({ path: dbPath, readonly: true });
    const initialRow = db
      .getConnection()
      .prepare('SELECT text, reading, reading_hiragana, segments FROM furigana WHERE text = ?')
      .get('漢字') as FuriganaRow | undefined;
    db.close();

  expect(initialRow).toBeTruthy();
  const insertedRow = initialRow as FuriganaRow;
  expect(insertedRow.text).toBe('漢字');
  expect(insertedRow.reading).toBe('かんじ');
  expect(insertedRow.reading_hiragana).toBe('かんじ');
  expect(JSON.parse(insertedRow.segments)).toEqual(firstPayload[0].furigana);

    const secondPayload = [
      {
        text: '漢字',
        reading: 'かんじ',
        furigana: [
          { ruby: '漢字', rt: 'かんじ' }
        ]
      }
    ];

    writeFileSync(dataPath, JSON.stringify(secondPayload), 'utf8');

    const updateImporter = new FuriganaImporter(dbPath);
    await updateImporter.import(dataPath);
    updateImporter.close();

    const dbAfterUpdate = new DatabaseManager({ path: dbPath, readonly: true });
    const updatedRow = dbAfterUpdate
      .getConnection()
      .prepare('SELECT segments FROM furigana WHERE text = ?')
      .get('漢字') as Pick<FuriganaRow, 'segments'> | undefined;
    dbAfterUpdate.close();

    expect(updatedRow).toBeTruthy();
    expect(JSON.parse((updatedRow as { segments: string }).segments)).toEqual(secondPayload[0].furigana);
  });
});
