import { Stack, useRouter } from "expo-router";
import { useCallback } from "react";

import { FlashList } from "@shopify/flash-list";
import { StyleSheet } from "react-native";

import { ListItem } from "@/components/ListItem";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { HistoryEntry } from "@/services/database";

export default function HistoryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const history = useSearchHistory();

  const handleHistoryItemPress = useCallback((item: HistoryEntry) => {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.wordId.toString(), title: item.word },
    });
  }, [router]);

  const renderListHeader = () => {
    let text = "";

    if (history.list.length === 0) {
      text = "No search history yet";
    }

    if (text.length === 0) {
      return null;
    }

    return (
      <ThemedText textAlign="center" type="secondary">
        {text}
      </ThemedText>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "History",
          headerLargeTitle: true,
          headerTransparent: true,
          headerTintColor: colorScheme === "dark" ? "white" : "black",
          headerLargeStyle: {
            backgroundColor: "transparent",
          },
        }}
      />
      <ThemedView style={styles.container}>
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
          ListHeaderComponent={renderListHeader}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
});
