import { extractJapaneseFromPassage } from '../services/parse';

describe('extractJapaneseFromPassage', () => {
  describe('with standard format markers', () => {
    test('extracts Japanese text between [日本語] and [English] markers', () => {
      const markdown = `
[Topic Category: Daily Life]

[日本語]
毎朝、私は六時に起きます。起きたら、すぐに顔を洗ったり、歯を磨いたりします。
それから、朝ごはんを作ります。今日は、卵焼きとご飯を作るように思います。

[English]
Every morning, I wake up at six o'clock. After I wake up, I immediately wash my face and brush my teeth.
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).toContain('それから、朝ごはんを作ります');
      expect(result).not.toContain('Every morning');
      expect(result).not.toContain('[English]');
    });

    test('extracts Japanese text with "Japanese" header', () => {
      const markdown = `
## Japanese

毎朝、私は六時に起きます。

## English

Every morning, I wake up at six o'clock.
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).not.toContain('Every morning');
    });

    test('extracts Japanese text with case-insensitive "nihongo" header', () => {
      const markdown = `
**NIHONGO**
毎朝、私は六時に起きます。

**Translation**
Every morning, I wake up at six o'clock.
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).not.toContain('Every morning');
    });

    test('stops extraction at [Vocabulary] marker', () => {
      const markdown = `
[日本語]
毎朝、私は六時に起きます。

[Vocabulary]
毎朝 – まいあさ – every morning
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).not.toContain('まいあさ');
      expect(result).not.toContain('every morning');
    });
  });

  describe('without section markers (fallback mode)', () => {
    test('extracts lines with 30%+ Japanese characters', () => {
      const markdown = `
毎朝、私は六時に起きます。
Every morning, I wake up at six.
それから、朝ごはんを作ります。
Then I make breakfast.
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).toContain('それから、朝ごはんを作ります');
      expect(result).not.toContain('Every morning');
      expect(result).not.toContain('Then I make breakfast');
    });

    test('extracts mixed content with high Japanese character ratio', () => {
      const markdown = `
日本語を勉強します
仕事は九時から始まります
English text with minimal Japanese
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('勉強');
      expect(result).toContain('仕事');
      expect(result).not.toContain('English text with minimal');
    });

    test('handles hiragana, katakana, and kanji', () => {
      const markdown = `
ひらがな
カタカナ
漢字
English text here
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('ひらがな');
      expect(result).toContain('カタカナ');
      expect(result).toContain('漢字');
      expect(result).not.toContain('English text here');
    });
  });

  describe('markdown formatting handling', () => {
    test('removes markdown formatting from Japanese text', () => {
      const markdown = `
[日本語]
**毎朝**、私は六時に*起きます*。
\`\`\`
今日は、卵焼きを作ります。
\`\`\`

[English]
Every morning
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝');
      expect(result).toContain('起きます');
      expect(result).not.toContain('**');
      expect(result).not.toContain('*');
    });

    test('handles markdown headers in Japanese text', () => {
      const markdown = `
[日本語]
## 毎日のルーティン
毎朝、私は六時に起きます。

[English]
Daily Routine
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎日のルーティン');
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).not.toContain('Daily Routine');
    });

    test('handles bullet points and numbered lists', () => {
      const markdown = `
[日本語]
- 毎朝、起きます
- 顔を洗います
1. 朝ごはんを食べます
2. 仕事に行きます

[English]
- Wake up every morning
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝、起きます');
      expect(result).toContain('仕事に行きます');
      expect(result).not.toContain('Wake up every morning');
    });
  });

  describe('edge cases', () => {
    test('returns empty string for empty input', () => {
      expect(extractJapaneseFromPassage('')).toBe('');
    });

    test('returns empty string for null input', () => {
      expect(extractJapaneseFromPassage(null as any)).toBe('');
    });

    test('returns empty string for undefined input', () => {
      expect(extractJapaneseFromPassage(undefined as any)).toBe('');
    });

    test('handles text with only English', () => {
      const markdown = `
[English]
Every morning, I wake up at six o'clock.
This is a test with no Japanese text.
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toBe('');
    });

    test('handles text with no section markers and no Japanese', () => {
      const markdown = `
This is just English text.
No Japanese characters here.
Just testing edge cases.
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toBe('');
    });

    test('handles multiple consecutive blank lines', () => {
      const markdown = `
[日本語]


毎朝、私は六時に起きます。



それから、朝ごはんを作ります。


[English]
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).toContain('それから、朝ごはんを作ります');
    });

    test('handles Japanese characters in section markers', () => {
      const markdown = `
日本語セクション
毎朝、私は六時に起きます。

English Section
Every morning, I wake up at six.
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('日本語セクション');
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).not.toContain('English Section');
    });
  });

  describe('real-world LLM output formats', () => {
    test('handles format with header and paragraph structure', () => {
      const markdown = `
# Daily Life Reading Passage

## Japanese Text

毎朝、私は六時に起きます。起きたら、すぐに顔を洗ったり、歯を磨いたりします。
それから、朝ごはんを作ります。今日は、卵焼きとご飯を作るように思います。

仕事は九時から始まります。私の仕事は、データを整理したり、メールを送ったりすることです。

## Translation

Every morning, I wake up at six o'clock.
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).toContain('仕事は九時から始まります');
      expect(result).not.toContain('Every morning');
      expect(result).not.toContain('Translation');
    });

    test('handles format with inline English notes', () => {
      const markdown = `
[日本語]
毎朝、私は六時に起きます。(I wake up at 6am)
それから、朝ごはんを作ります。(Then I make breakfast)

[Vocabulary]
毎朝 - every morning
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).toContain('それから、朝ごはんを作ります');
    });

    test('handles format without clear sections', () => {
      const markdown = `
Reading Practice - JLPT N5 Level

毎朝、私は六時に起きます。起きたら、すぐに顔を洗ったり、歯を磨いたりします。

Translation:
Every morning, I wake up at six o'clock.
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).not.toContain('Every morning');
    });

    test('handles mixed format with romaji', () => {
      const markdown = `
日本語:
毎朝、私は六時に起きます。
Maiasa, watashi wa rokuji ni okimasu.

English:
Every morning, I wake up at six.
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).not.toContain('Maiasa');
      expect(result).not.toContain('Every morning');
    });
  });

  describe('performance and length', () => {
    test('handles long passages efficiently', () => {
      const longPassage = `
[日本語]
${'毎朝、私は六時に起きます。'.repeat(100)}

[English]
${'Every morning, I wake up at six.'.repeat(100)}
`;

      const startTime = Date.now();
      const result = extractJapaneseFromPassage(longPassage);
      const duration = Date.now() - startTime;

      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).not.toContain('Every morning');
      expect(duration).toBeLessThan(100);
    });

    test('joins multiple lines with spaces', () => {
      const markdown = `
[日本語]
毎朝、私は六時に起きます。
それから、朝ごはんを作ります。
今日は卵焼きを作ります。

[English]
Test
`;

      const result = extractJapaneseFromPassage(markdown);
      expect(result.split(' ').length).toBeGreaterThan(1);
      expect(result).toContain('毎朝、私は六時に起きます');
      expect(result).toContain('それから、朝ごはんを作ります');
    });
  });
});
