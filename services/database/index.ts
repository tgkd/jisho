export { migrateDbIfNeeded } from "./core";
export { searchDictionary } from "./search";
export { getDictionaryEntry, getWordExamples, addExamplesList } from "./dictionary";
export { getBookmarks, isBookmarked, addBookmark, removeBookmark, clearBookmarks } from "./bookmarks";
export { addToHistory, getHistory, clearHistory, removeHistoryById } from "./history";
export { getChats, addChat, removeChatById, clearChats } from "./chats";
export { getKanji, searchKanji, getKanjiByUnicode, getKanjiById, getKanjiList } from "./kanji";
export { saveAudioFile, getAudioFile } from "./audio";
export { resetDatabase } from "./utils";

export type {
  DictionaryEntry,
  ExampleSentence,
  WordMeaning,
  HistoryEntry,
  Chat,
  AudioFile,
  KanjiEntry,
  SearchDictionaryOptions,
  SearchDictionaryResult,
} from "./types";