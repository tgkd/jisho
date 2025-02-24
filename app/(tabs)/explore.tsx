import { StyleSheet, TextInput, FlatList, View, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useSQLiteContext } from 'expo-sqlite';
import { searchDictionary, type DictionaryEntry } from '@/services/database';

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const db = useSQLiteContext();
  const inputBackground = useThemeColor({ light: '#fff', dark: '#1c1c1c' }, 'background');

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length < 1) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const searchResults = await searchDictionary(db, text);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = ({ item }: { item: DictionaryEntry }) => (
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
  );

  return (
    <ThemedView style={styles.container}>
      <TextInput
        style={[styles.searchInput, { backgroundColor: inputBackground }]}
        placeholder="Search in English or Japanese..."
        value={query}
        onChangeText={handleSearch}
        placeholderTextColor="#666"
      />

      {isLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  loading: {
    marginTop: 20,
  },
  listContainer: {
    paddingBottom: 16,
  },
  resultItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
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
    fontSize: 16,
  },
  meanings: {
    fontSize: 14,
    opacity: 0.7,
  },
});
