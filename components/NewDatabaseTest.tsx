import { newDb, WordResult } from '@/services/database/new-schema';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

/**
 * Test component to verify the new database service works
 * This can be added to any screen for testing
 */
export function NewDatabaseTest() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WordResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchEnglish = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const searchResults = await newDb.searchEnglish(query, 10);
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const searchJapanese = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const searchResults = await newDb.searchJapanese(query, 10);
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const renderResult = ({ item }: { item: WordResult }) => (
    <View style={styles.resultItem}>
      <Text style={styles.kanji}>
        {item.kanji.length > 0 ? item.kanji.join(', ') : 'No kanji'}
      </Text>
      <Text style={styles.reading}>
        {item.readings.join(', ')}
      </Text>
      <Text style={styles.glosses}>
        {item.glosses.join('; ')}
      </Text>
      {item.partOfSpeech && (
        <Text style={styles.pos}>({item.partOfSpeech})</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Database Test</Text>
      
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Enter search term..."
        autoCapitalize="none"
      />
      
      <View style={styles.buttons}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={searchEnglish}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Search English</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={searchJapanese}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Search Japanese</Text>
        </TouchableOpacity>
      </View>

      {loading && <Text style={styles.loading}>Searching...</Text>}
      
      {error && <Text style={styles.error}>Error: {error}</Text>}
      
      <FlatList
        data={results}
        renderItem={renderResult}
        keyExtractor={(item) => item.id.toString()}
        style={styles.results}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  loading: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 16,
  },
  results: {
    flex: 1,
  },
  resultItem: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  kanji: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reading: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  glosses: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  pos: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
});