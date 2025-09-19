import { Stack, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";

import { FlashList } from "@shopify/flash-list";
import { StyleSheet } from "react-native";

import { ListItem } from "@/components/ListItem";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  DictionaryEntry,
  getBookmarks,
  removeBookmark
} from "@/services/database";

export default function BookmarksScreen() {
  const [bookmarks, setBookmarks] = useState<DictionaryEntry[]>([]);
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();

  useFocusEffect(
    useCallback(() => {
      const fetchBookmarks = async () => {
        try {
          setLoading(true);
          const results = await getBookmarks(db);
          setBookmarks(results);
        } catch (error) {
          console.error("Failed to fetch bookmarks:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchBookmarks();
    }, [db])
  );

  const handleRemoveBookmark = async (item: DictionaryEntry & { meaning?: string }) => {
    await removeBookmark(db, item.id);
    setBookmarks((prev) => prev.filter((b) => b.id !== item.id));
  };

  const renderListHeader = () => {
    let text = "";

    if (loading) {
      text = "Loading bookmarks...";
    }

    if (bookmarks.length === 0) {
      text = "No bookmarks yet";
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
          title: "Bookmarks",
          headerLargeTitle: true,
          headerTransparent: true,
          headerTintColor: colorScheme === "dark" ? "white" : "black",
          headerLargeStyle: {
            backgroundColor: "transparent",
          },
        }}
      />
      <ThemedView
        style={styles.container}
        lightColor={Colors.light.background}
        darkColor={Colors.dark.background}
      >
        <FlashList
          contentInsetAdjustmentBehavior="automatic"
          data={bookmarks}
          renderItem={({ index, item }) => (
            <ListItem
              variant="bookmark"
              item={item}
              index={index}
              total={bookmarks.length}
              onRemove={handleRemoveBookmark}
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
