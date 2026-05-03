export { migrateDbIfNeeded } from "./core";
export { addExamplesList, getDictionaryEntry, getWordExamples } from "./dictionary";
export { getFuriganaForText } from "./furigana";
export { addKanjiToHistory, addToHistory, clearHistory, getHistory, removeHistoryById } from "./history";
export { getKanji, getKanjiById, searchKanji } from "./kanji";
export { searchDictionary } from "./search";
export type {
  DictionaryEntry,
  ExampleSentence,
  FuriganaEntry,
  FuriganaSegment,
  HistoryEntry,
  KanjiEntry,
  KanjiHistoryEntry,
  SearchDictionaryOptions,
  SearchDictionaryResult,
  WordHistoryEntry,
  WordMeaning
} from "./types";
export { resetDatabase } from "./utils";
