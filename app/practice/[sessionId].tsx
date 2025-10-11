import { ThemedText } from "@/components/ThemedText";
import { useMdStyles } from "@/hooks/useMdStyles";
import {
  getSession,
  type PracticeSession
} from "@/services/database/practice-sessions";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";
import Markdown from "react-native-markdown-display";

export default function PracticeSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const markdownStyles = useMdStyles();

  const [session, setSession] = useState<PracticeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSessionData = useCallback(async () => {
    try {
      setIsLoading(true);
      const sessionData = await getSession(db, Number(sessionId));
      if (!sessionData) {
        Alert.alert("Error", "Practice session not found");
        router.back();
        return;
      }

      setSession(sessionData);
    } catch (error) {
      console.error("Failed to load session:", error);
      Alert.alert("Error", "Failed to load practice session");
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [db, sessionId, router]);

  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centerContainer}>
        <ThemedText>Session not found</ThemedText>
      </View>
    );
  }

  if (!session.content) {
    return (
      <View style={styles.centerContainer}>
        <ThemedText type="secondary">No content available</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Markdown style={markdownStyles}>
        {session.content}
      </Markdown>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
});
