import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Pill } from "@/components/ui/Pill";
import { Colors } from "@/constants/Colors";
import {
  deleteSession,
  getAllSessions,
  type SessionWithPreview,
} from "@/services/database/practice-sessions";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";

export default function PracticeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const flashListRef = useRef<FlashListRef<SessionWithPreview>>(null);
  const [sessions, setSessions] = useState<SessionWithPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const data = await getAllSessions(db);
      setSessions(data);
    } catch (error) {
      console.error("Failed to load sessions:", error);
      Alert.alert("Error", "Failed to load practice history");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    router.push("/practice/new" as any);
  };

  const handleSessionPress = (sessionId: number) => {
    router.push(`/practice/chat/${sessionId}` as any);
  };

  const handleDeleteSession = (sessionId: number) => {
    Alert.alert(
      "Delete Session",
      "Are you sure you want to delete this practice session? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSession(db, sessionId);
              await loadSessions();
            } catch (error) {
              console.error("Failed to delete session:", error);
              Alert.alert("Error", "Failed to delete session");
            }
          },
        },
      ]
    );
  };

  const getSessionTitle = (session: SessionWithPreview) => {
    if (session.title) {
      return session.title;
    }
    if (session.last_message) {
      return (
        session.last_message.substring(0, 50) +
        (session.last_message.length > 50 ? "..." : "")
      );
    }
    return `${session.level} Practice Session`;
  };

  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      <HapticTab onPress={handleNewChat} style={styles.newChatButton}>
        <Card style={styles.newChatCard}>
          <View style={styles.newChatContent}>
            <View style={styles.iconContainer}>
              <IconSymbol
                name="plus.circle.fill"
                size={28}
                color={Colors.light.tint}
              />
            </View>
            <View style={styles.newChatTextContainer}>
              <ThemedText size="md" style={styles.newChatTitle}>
                Start New Practice Session
              </ThemedText>
              <ThemedText size="sm" type="secondary">
                Choose your JLPT level and begin practicing
              </ThemedText>
            </View>
            <IconSymbol
              name="chevron.right"
              size={20}
              color={Colors.light.textSecondary}
            />
          </View>
        </Card>
      </HapticTab>

      {sessions.length > 0 && (
        <ThemedText size="sm" type="secondary" style={styles.historyTitle}>
          Previous Sessions
        </ThemedText>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      {renderListHeader()}
      <Card>
        <View style={styles.emptyState}>
          <IconSymbol
            name="bubble.left.and.bubble.right"
            size={48}
            color={Colors.light.textSecondary}
          />
          <ThemedText size="md" type="secondary" style={styles.emptyText}>
            No practice sessions yet
          </ThemedText>
          <ThemedText size="sm" type="secondary" style={styles.emptyHint}>
            Start your first practice session to begin learning
          </ThemedText>
        </View>
      </Card>
    </View>
  );

  const renderSession = ({ item }: { item: SessionWithPreview }) => (
    <HapticTab
      onPress={() => handleSessionPress(item.id)}
      style={styles.sessionCard}
    >
      <Card>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionInfo}>
            <View style={styles.sessionTitleRow}>
              <Pill text={item.level} onPress={() => {}} />
              <ThemedText size="xs" type="secondary">
                {item.message_count} message
                {item.message_count !== 1 ? "s" : ""}
              </ThemedText>
            </View>

            <ThemedText size="md" style={styles.sessionTitle} numberOfLines={1}>
              {getSessionTitle(item)}
            </ThemedText>
          </View>

          <View style={styles.sessionActions}>
            <HapticTab
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteSession(item.id);
              }}
              style={styles.deleteButton}
            >
              <IconSymbol
                name="trash"
                size={20}
                color={Colors.light.textSecondary}
              />
            </HapticTab>

            <IconSymbol
              name="chevron.right"
              size={16}
              color={Colors.light.textSecondary}
            />
          </View>
        </View>
      </Card>
    </HapticTab>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlashList
      contentInsetAdjustmentBehavior="automatic"
      ref={flashListRef}
      data={sessions}
      renderItem={renderSession}
      ListHeaderComponent={renderListHeader}
      ListEmptyComponent={renderEmptyState}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  headerContainer: {
    marginBottom: 16,
    gap: 16,
  },
  newChatButton: {
    borderRadius: 16,
  },
  newChatCard: {
    borderWidth: 2,
    borderColor: Colors.light.tint,
    borderStyle: "solid",
  },
  newChatContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  newChatTextContainer: {
    flex: 1,
    gap: 2,
  },
  newChatTitle: {
    fontWeight: "600",
  },
  historyTitle: {
    fontWeight: "600",
    paddingLeft: 4,
  },
  emptyStateContainer: {
    gap: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontWeight: "500",
  },
  emptyHint: {
    textAlign: "center",
  },
  separator: {
    height: 12,
  },
  sessionCard: {
    borderRadius: 16,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionInfo: {
    flex: 1,
    gap: 6,
  },
  sessionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sessionTitle: {
    fontWeight: "600",
  },
  sessionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteButton: {
    padding: 8,
  },
});
