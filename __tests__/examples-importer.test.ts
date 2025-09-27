import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { DatabaseManager } from '../scripts/import/utils/database';
import { ExamplesImporter } from '../scripts/import/examples-importer';

const schemaPath = path.join(__dirname, '../schema.sql');

interface ExampleRow {
  japanese_text: string;
  english_text: string;
  tokens: string;
  example_id: string | null;
}

function createTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'examples-import-'));
}

describe('ExamplesImporter', () => {
  let tempDir: string;
  let dbPath: string;
  let dataPath: string;

  beforeEach(async () => {
    tempDir = createTempDir();
    dbPath = path.join(tempDir, 'test.db');
    dataPath = path.join(tempDir, 'examples.utf');

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

  it('imports example sentences and resets table on subsequent runs', async () => {
    const initialContent = [
      'A: 日本語の文です。   This is a sentence.#ID=example_1',
      'B: 日本語(にほんご) の 文{文です。}',
      'A: 二つ目の文です。   Second sentence.#ID=example_2',
      'B: 二(ふた) つ 目(め) の 文{文です。}'
    ].join('\n');

    writeFileSync(dataPath, initialContent, 'utf8');

    const importer = new ExamplesImporter(dbPath);
    await importer.import(dataPath);
    importer.close();

    const db = new DatabaseManager({ path: dbPath, readonly: true });
    const firstRows = db
      .getConnection()
      .prepare('SELECT japanese_text, english_text, tokens, example_id FROM examples ORDER BY id')
      .all() as ExampleRow[];
    db.close();

    expect(firstRows).toHaveLength(2);
    expect(firstRows[0]).toMatchObject({
      japanese_text: '日本語の文です。',
      english_text: 'This is a sentence.',
      tokens: '日本語(にほんご) の 文{文です。}',
      example_id: 'example_1'
    });

    const updatedContent = [
      'A: 日本語の文です。   Updated translation.#ID=example_1',
      'B: 日本語(にほんご) の 文{文です。}'
    ].join('\n');

    writeFileSync(dataPath, updatedContent, 'utf8');

    const rerunImporter = new ExamplesImporter(dbPath);
    await rerunImporter.import(dataPath);
    rerunImporter.close();

    const dbAfter = new DatabaseManager({ path: dbPath, readonly: true });
    const rowsAfter = dbAfter
      .getConnection()
      .prepare('SELECT japanese_text, english_text, tokens, example_id FROM examples ORDER BY id')
      .all() as ExampleRow[];
    dbAfter.close();

    expect(rowsAfter).toHaveLength(1);
    expect(rowsAfter[0]).toMatchObject({
      japanese_text: '日本語の文です。',
      english_text: 'Updated translation.',
      tokens: '日本語(にほんご) の 文{文です。}',
      example_id: 'example_1'
    });
  });
});
