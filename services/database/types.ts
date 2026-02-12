
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
  tokens?: string | null;
  reading?: string | null;
};

export type ExampleSentence = Omit<
  DBExampleSentence,
  "japanese_text" | "english_text" | "example_id"
> & {
  japaneseText: string;
  englishText: string;
  exampleId: string | null;
  reading?: string | null;
  segments?: FuriganaSegment[];
};

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
  entry_type: 'word' | 'kanji';
  // Word fields (nullable for kanji entries)
  word_id: number | null;
  created_at: number;
  word: string | null;
  reading: string | null;
  // Kanji fields (nullable for word entries)
  kanji_id: number | null;
  kanji_character: string | null;
  kanji_meaning: string | null;
  kanji_on_readings: string | null;
  kanji_kun_readings: string | null;
};

export type BaseHistoryEntry = {
  id: number;
  createdAt: number;
};

export type WordHistoryEntry = BaseHistoryEntry & {
  entryType: 'word';
  wordId: number;
  word: string;
  reading: string;
  meaning: string;
};

export type KanjiHistoryEntry = BaseHistoryEntry & {
  entryType: 'kanji';
  kanjiId: number;
  character: string;
  meaning: string;
  onReadings: string[];
  kunReadings: string[];
};

export type HistoryEntry = WordHistoryEntry | KanjiHistoryEntry;


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
  grade: number | null;
  stroke_count: number | null;
  frequency: number | null;
  created_at: string;
};

export type KanjiEntry = Omit<
  DBKanji,
  "on_readings" | "kun_readings" | "meanings" | "stroke_count"
> & {
  onReadings: string[] | null;
  kunReadings: string[] | null;
  meanings: string[] | null;
  strokeCount: number | null;
};

export interface SearchQuery {
  original: string;
  hiragana?: string;
  katakana?: string;
  romaji?: string;
}

export interface SearchDictionaryOptions {
  withMeanings?: boolean;
  limit?: number;
  minQueryLength?: number;
  signal?: AbortSignal;
}

export interface SearchDictionaryResult {
  words: DictionaryEntry[];
  meanings: Map<number, WordMeaning[]>;
  error?: string;
}

export type FuriganaSegment = {
  ruby: string;
  rt?: string;
};

export type DBFuriganaEntry = {
  id: number;
  text: string;
  reading: string;
  reading_hiragana: string | null;
  segments: string;
  created_at: string;
};

export type FuriganaEntry = Omit<DBFuriganaEntry, 'reading_hiragana' | 'segments' | 'created_at'> & {
  readingHiragana: string | null;
  segments: FuriganaSegment[];
  createdAt: string;
};
