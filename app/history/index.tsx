import { useRouter } from "expo-router";
import { useCallback } from "react";

import { FlashList } from "@shopify/flash-list";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ListItem } from "@/components/ListItem";
import { ThemedText } from "@/components/ThemedText";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { HistoryEntry } from "@/services/database";

export default function HistoryScreen() {
  const router = useRouter();
  const history = useSearchHistory();

  const handleHistoryItemPress = useCallback(
    (item: HistoryEntry) => {
      router.push({
        pathname: "/word/[id]",
        params: { id: item.wordId.toString(), title: item.word },
      });
    },
    [router]
  );

  return (
    <FlashList
      contentInsetAdjustmentBehavior="automatic"
      data={history.list}
      renderItem={({ index, item }) => (
        <ListItem
          variant="history"
          item={item}
          index={index}
          total={history.list.length}
          onPress={() => handleHistoryItemPress(item)}
          onRemove={history.removeItem}
        />
      )}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={styles.scrollContainer}
      ListHeaderComponent={() =>
        history.list.length === 0 && !history.isLoading ? (
          <View style={styles.emptyText}>
            <ThemedText type="secondary">{"No search history yet."}</ThemedText>
          </View>
        ) : null
      }
      ListFooterComponent={() =>
        history.isLoading && history.list.length > 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" />
          </View>
        ) : null
      }
      onEndReached={history.loadMore}
      onEndReachedThreshold={0.5}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyText: {
    flex: 1,
    alignItems: "center",
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
