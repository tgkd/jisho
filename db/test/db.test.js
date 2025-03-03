const path = require("path");
const fs = require("fs-extra");
const Database = require("better-sqlite3");
const { initializeDatabase } = require("../src/config/db");

// meanings table schema
// [{"id":"14356","word_id":"5003","meaning":"to carry","part_of_speech":null,"tags":null}]

// words table schema
// [{"id":"15307","word":"亜熱帯高圧帯","reading":"あねったいこうあつたい"}]

// examples table schema
// [{"id":"52","japanese":"彼は宝石を盗んだといわれている。","english":"He is alleged to have stolen the jewelry.#ID=303645_100052","parsed_tokens":"彼(かれ)[01] は 宝石 を 盗む{盗んだ} と言われる{といわれている}"}]

// Test database path - use a separate test database
const TEST_DB_PATH = path.join(__dirname, "jisho_test.db");

describe("Database queries after migration", () => {
  let db;

  // Set up test database before all tests
  beforeAll(() => {
    // Create a fresh test database for each test run
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Initialize the database with test schema
    db = initializeDatabase(TEST_DB_PATH);
  });

  afterAll(() => {
    // Close database connection and clean up test DB
    if (db) db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  beforeEach(() => {
    // Insert test data
    db.prepare(`
      INSERT INTO words (id, word, reading) VALUES
      (1, '宝石', 'ほうせき'),
      (2, '盗む', 'ぬすむ'),
      (3, '言う', 'いう')
    `).run();

    db.prepare(`
      INSERT INTO meanings (id, word_id, meaning, part_of_speech, tags) VALUES
      (1, 1, 'jewel', 'noun', NULL),
      (2, 1, 'gem', 'noun', NULL),
      (3, 2, 'to steal', 'verb', NULL),
      (4, 3, 'to say', 'verb', NULL)
    `).run();

    db.prepare(`
      INSERT INTO examples (id, japanese, english, parsed_tokens) VALUES
      (1, '彼は宝石を盗んだといわれている。', 'He is alleged to have stolen the jewelry.', '彼(かれ)[01] は 宝石 を 盗む{盗んだ} と言われる{といわれている}'),
      (2, '彼女は宝石が大好きです。', 'She loves jewels.', '彼女 は 宝石 が 大好き です')
    `).run();
  });

  afterEach(() => {
    // Clear test data after each test
    db.prepare('DELETE FROM examples').run();
    db.prepare('DELETE FROM meanings').run();
    db.prepare('DELETE FROM words').run();
  });

  describe('Search functionality', () => {
    test('should find words by partial Japanese text', () => {
      const result = db.prepare(`
        SELECT DISTINCT w.*
        FROM words w
        WHERE w.word LIKE ? OR w.reading LIKE ?
      `).all('%宝石%', '%ほうせき%');

      expect(result.length).toBe(1);
      expect(result[0].word).toBe('宝石');
      expect(result[0].reading).toBe('ほうせき');
    });

    test('should find words by English meaning', () => {
      const result = db.prepare(`
        SELECT DISTINCT w.*
        FROM words w
        JOIN meanings m ON w.id = m.word_id
        WHERE m.meaning LIKE ?
      `).all('%steal%');

      expect(result.length).toBe(1);
      expect(result[0].word).toBe('盗む');
      expect(result[0].reading).toBe('ぬすむ');
    });

    test('should find examples for a given word', () => {
      const result = db.prepare(`
        SELECT e.*
        FROM examples e
        WHERE e.parsed_tokens LIKE ? OR e.japanese LIKE ?
      `).all('%宝石%', '%宝石%');

      expect(result.length).toBe(2);
      expect(result[0].japanese).toContain('宝石');
      expect(result[1].japanese).toContain('宝石');
    });

    test('should find word with its meanings and examples', () => {
      const word = db.prepare(`
        SELECT w.*, GROUP_CONCAT(DISTINCT m.meaning) as meanings
        FROM words w
        LEFT JOIN meanings m ON w.id = m.word_id
        WHERE w.word = ?
        GROUP BY w.id
      `).get('宝石');

      expect(word).toBeTruthy();
      expect(word.meanings).toContain('jewel');
      expect(word.meanings).toContain('gem');

      const examples = db.prepare(`
        SELECT * FROM examples
        WHERE japanese LIKE ? OR parsed_tokens LIKE ?
      `).all('%宝石%', '%宝石%');

      expect(examples.length).toBe(2);
      expect(examples[0].english).toContain('jewelry');
      expect(examples[1].english).toContain('jewels');
    });
  });
});
