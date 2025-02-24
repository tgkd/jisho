import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';
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
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 17,
    backgroundColor: Colors.light.secondaryBackground,
    marginBottom: 16,
    color: Colors.light.text,
  },
  loading: {
    marginTop: 20,
  },
  listContainer: {
    paddingBottom: 16,
  },
  resultItem: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: Colors.light.groupedBackground,
  },
  wordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  kanji: {
    fontSize: 20,
    fontWeight: '600',
    marginRight: 8,
  },
  reading: {
    fontSize: 15,
    color: Colors.light.secondaryText,
  },
  meanings: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    lineHeight: 20,
  },
});
