import { StyleSheet, View, ScrollView } from 'react-native';
import { Stack, useGlobalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function WordDetailScreen() {
  const params = useGlobalSearchParams();
  const meanings = JSON.parse(params.meanings as string || '[]');
  const reading = JSON.parse(params.reading as string || '[]')[0];
  const tintColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  
  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: params.kanji as string || reading,
          headerBackTitle: 'Search',
        }}
      />
      
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerSection}>
          {params.kanji && (
            <ThemedText type="title" style={styles.kanji}>
              {params.kanji as string}
            </ThemedText>
          )}
          <ThemedText style={styles.reading}>{reading}</ThemedText>
        </View>

        <View style={styles.meaningsSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Meanings
          </ThemedText>
          {meanings.map((meaning: string, index: number) => (
            <View key={index} style={styles.meaningItem}>
              <IconSymbol 
                name="circle.fill" 
                size={6} 
                color={tintColor}
                style={styles.bullet} 
              />
              <ThemedText style={styles.meaningText}>{meaning}</ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  headerSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  kanji: {
    fontSize: 48,
    marginBottom: 8,
  },
  reading: {
    fontSize: 24,
    opacity: 0.7,
  },
  meaningsSection: {
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  meaningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  bullet: {
    opacity: 0.5,
  },
  meaningText: {
    flex: 1,
  },
});