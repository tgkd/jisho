import React from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { Pill } from "./ui/Pill";

type TagsListProps = {
  items: Array<{ label: string; id: string }>;
  onSelect: (id: string) => void;
};

export default function TagsList({ items, onSelect }: TagsListProps) {
  const renderItem = ({ item }: { item: { label: string; id: string } }) => {
    return (
      <Pill
        onPress={() => {
          onSelect(item.id);
        }}
        text={item.label}
      />
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        maxToRenderPerBatch={5}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  listContent: {
    paddingHorizontal: 8,
  },
});
