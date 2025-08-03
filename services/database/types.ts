
// New normalized schema types
export type DBWord = {
  id: number;
  entry_id: number;
  sequence: number;
  created_at: string;
  updated_at: string;
  frequency_score: number;
  frequency_source: string | null;
};

export type DBWordKanji = {
  id: number;
  word_id: number;
  kanji: string;
  info_tags: string | null;
  priorities: string | null;
};

export type DBWordReading = {
  id: number;
  word_id: number;
  reading: string;
  romaji: string;
  info_tags: string | null;
  priorities: string | null;
  restrict_kanji: string | null;
};

export type DBWordSense = {
  id: number;
  word_id: number;
  sense_order: number;
  parts_of_speech: string; // JSON array
  field_tags: string; // JSON array
  misc_tags: string; // JSON array
  dialect_tags: string | null;
  info: string | null;
};

export type DBWordGloss = {
  id: number;
  sense_id: number;
  gloss: string;
  gloss_type: string | null;
  gender: string | null;
  gloss_order: number;
};

// Legacy type for compatibility - represents a flattened word entry
export type DBDictEntry = {
  id: number;
  word: string;
  reading: string;
  reading_hiragana: string | null;
  kanji: string | null;
  position: number;
};

export type DictionaryEntry = Omit<DBDictEntry, "reading_hiragana"> & {
  readingHiragana: string | null;
};

export type DBExampleSentence = {
  id: number;
  japanese_text: string;
  english_text: string;
  example_id: string;
  tokens?: string;
};

export type ExampleSentence = Omit<
  DBExampleSentence,
  "japanese_text" | "english_text" | "example_id"
> & {
  japaneseText: string;
  englishText: string;
  exampleId: string | null;
};

// Legacy meaning type - now mapped from senses + glosses
export type DBWordMeaning = {
  id: number;
  word_id: number;
  meaning: string;
  part_of_speech: string | null;
  field: string | null;
  misc: string | null;
  info: string | null;
};

export type WordMeaning = Omit<DBWordMeaning, "word_id" | "part_of_speech"> & {
  wordId: number;
  partOfSpeech: string | null;
};

export type DBHistoryEntry = {
  id: number;
  word_id: number;
  created_at: number;
  word: string;
  reading: string;
};

export type HistoryEntry = {
  id: number;
  wordId: number;
  createdAt: number;
  word: string;
  reading: string;
  meaning: string;
};

export type DBChat = {
  id: number;
  request: string;
  response: string;
  created_at: string;
};

export type Chat = Omit<DBChat, "created_at"> & {
  createdAt: string;
};

export type DBAudio = {
  id: number;
  file_path: string;
  word_id: number;
  example_id: number;
  audio_data: string;
  created_at: string;
};

export type AudioFile = {
  id: number;
  filePath: string;
  audioData: string;
};

export type DBKanji = {
  id: number;
  character: string;
  jis_code: number | null;
  unicode: string | null;
  on_readings: string | null;
  kun_readings: string | null;
  meanings: string | null;
  created_at: string;
};

export type KanjiEntry = Omit<
  DBKanji,
  "on_readings" | "kun_readings" | "meanings"
> & {
  onReadings: string[] | null;
  kunReadings: string[] | null;
  meanings: string[] | null;
};

export interface SearchQuery {
  original: string;
  hiragana?: string;
  katakana?: string;
  romaji?: string;
}

export interface SearchRankingConfig {
  frequencyWeight: number;        // 0.0 - 1.0, default 0.3
  lengthWeight: number;          // 0.0 - 1.0, default 0.2
  exactMatchBoost: number;       // Multiplier, default 10.0
  enableFrequencyRanking: boolean; // Feature flag, default true
}

export interface SearchDictionaryOptions {
  withMeanings?: boolean;
  limit?: number;
  minQueryLength?: number;
  signal?: AbortSignal;
  rankingConfig?: SearchRankingConfig;
}

export interface SearchDictionaryResult {
  words: DictionaryEntry[];
  meanings: Map<number, WordMeaning[]>;
  error?: string;
}