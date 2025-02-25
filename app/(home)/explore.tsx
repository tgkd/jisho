import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useThrottledSearch } from '@/hooks/useThrottledSearch';
import { searchDictionary, type DictionaryEntry } from '@/services/database';

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const db = useSQLiteContext();
  const inputBackground = useThemeColor({ light: '#fff', dark: '#1c1c1c' }, 'background');

  const handleSearch = async (text: string) => {
    if (text.length < 1) {
      setResults([]);
      setTotalResults(0);
      return;
    }
    setIsLoading(true);
    try {
      const { results: searchResults, total } = await searchDictionary(db, text);
      setResults(searchResults);
      setTotalResults(total);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  };

  const { value: currentQuery, handleChange } = useThrottledSearch<
    typeof handleSearch,
    string
  >(handleSearch, 700);

  const onChangeText = (text: string) => {
    setQuery(text);
    handleChange(text);
  };

  const renderItem = useCallback(({ item }: { item: DictionaryEntry }) => (
    <ThemedView style={styles.resultItem}>
      <View style={styles.wordContainer}>
        {item.kanji?.[0] && (
          <ThemedText type="title" style={styles.kanji}>
            {item.kanji[0]}
          </ThemedText>
        )}
        <ThemedText style={styles.reading}>{item.reading[0]}</ThemedText>
      </View>
      <ThemedText style={styles.meanings}>
        {item.meanings.slice(0, 3).join('; ')}
      </ThemedText>
    </ThemedView>
  ), []);

  const renderListEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Loader />
          <ThemedText type="secondary" style={styles.statusText}>
            Searching...
          </ThemedText>
        </View>
      );
    }

    if (query && !isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ThemedText type="secondary" style={styles.statusText}>
            No results found
          </ThemedText>
          <ThemedText type="secondary" style={[styles.statusText, styles.suggestionText]}>
            Try a different search term
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <ThemedText type="secondary" style={styles.statusText}>
          Start typing to explore words
        </ThemedText>
      </View>
    );
  }, [isLoading, query]);

  const renderListHeader = useCallback(() => {
    if (!query || results.length === 0) return null;

    return (
      <View style={styles.headerContainer}>
        <ThemedText type="secondary" style={styles.headerText}>
          {isLoading ? 'Searching...' : `Found ${totalResults} results`}
        </ThemedText>
        {isLoading && <Loader style={styles.headerLoader} />}
      </View>
    );
  }, [query, results.length, totalResults, isLoading]);

  return (
    <ThemedView style={styles.container}>
      <TextInput
        style={[styles.searchInput, { backgroundColor: inputBackground }]}
        placeholder="Search in English or Japanese..."
        value={query}
        onChangeText={onChangeText}
        placeholderTextColor="#666"
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        autoCapitalize="none"
        enablesReturnKeyAutomatically={true}
        spellCheck={false}
      />

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={results.length === 0 ? styles.emptyListContent : styles.listContainer}
        ListEmptyComponent={renderListEmpty}
        ListHeaderComponent={renderListHeader}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListHeaderComponentStyle={styles.headerComponentStyle}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 17,
    backgroundColor: Colors.light.secondaryBackground,
    marginBottom: 16,
    color: Colors.light.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 32,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 32,
  },
  listContainer: {
    paddingBottom: 16,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  resultItem: {
    padding: 16,
    marginBottom: 8,
    borderRadius: 10,
  },
  wordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  kanji: {
    fontSize: 20,
    marginRight: 8,
  },
  reading: {
    fontSize: 17,
  },
  meanings: {
    fontSize: 15,
    opacity: 0.7,
  },
  statusText: {
    marginBottom: 8,
    textAlign: 'center',
  },
  suggestionText: {
    fontSize: 14,
    opacity: 0.7,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginBottom: 12,
    borderRadius: 8,
  },
  headerText: {
    fontSize: 14,
    marginRight: 8,
  },
  headerLoader: {
    width: 14,
    height: 14,
  },
  headerComponentStyle: {
    marginBottom: 8,
  },
});
