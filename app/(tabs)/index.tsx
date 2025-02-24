import { StyleSheet, TextInput, FlatList, View, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { databaseService } from '@/services/database';
import { useThemeColor } from '@/hooks/useThemeColor';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface SearchResult {
  id: number;
  kanji?: string[];
  reading: string[];
  meanings: string[];
}

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const inputBackground = useThemeColor({ light: '#fff', dark: '#1c1c1c' }, 'background');

  useEffect(() => {
    const initDb = async () => {
      try {
        await databaseService.init();
        setIsDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };
    initDb();
  }, []);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length < 1) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const searchResults = await databaseService.searchByQuery(text);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWordPress = (item: SearchResult) => {
    router.push({
      pathname: '/(tabs)/word-detail',
      params: {
        id: item.id.toString(),
        kanji: item.kanji?.[0],
        reading: JSON.stringify(item.reading),
        meanings: JSON.stringify(item.meanings),
      },
    });
  };

  const renderItem = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity onPress={() => handleWordPress(item)}>
      <ThemedView style={styles.resultItem}>
        <View style={styles.wordContainer}>
          {item.kanji && item.kanji.length > 0 && (
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
    </TouchableOpacity>
  );

  if (!isDbReady) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading dictionary...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollView
        enableOnAndroid
        enableResetScrollToCoords={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: inputBackground }]}
            placeholder="Search in English or Japanese..."
            value={query}
            onChangeText={handleSearch}
            placeholderTextColor="#666"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        
        {isLoading ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false} // The parent KeyboardAwareScrollView handles scrolling
          />
        )}
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  searchContainer: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16, // Account for status bar on iOS
    backgroundColor: 'transparent',
  },
  searchInput: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  loading: {
    marginTop: 20,
  },
  listContainer: {
    padding: 16,
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
    fontSize: 24,
    marginRight: 8,
  },
  reading: {
    fontSize: 18,
  },
  meanings: {
    fontSize: 14,
    opacity: 0.7,
  },
  headerIcon: {
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  scrollContent: {
    flexGrow: 1,
  },
});
