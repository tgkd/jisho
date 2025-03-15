import React from "react";
import { StyleSheet, FlatList, Pressable, Text, View } from "react-native";
import { useThemeColor } from "../hooks/useThemeColor";
import { HapticTab } from "./HapticTab";
import { Colors } from "@/constants/Colors";

type TagsListProps = {
  items: Array<{ label: string; id: string }>;
  onSelect: (id: string) => void;
};

export default function TagsList({ items, onSelect }: TagsListProps) {
  const backgroundColor = useThemeColor({}, "secondaryBackground");
  const textColor = useThemeColor({}, "text");

  const renderItem = ({ item }: { item: { label: string; id: string } }) => {
    return (
      <HapticTab
        onPress={() => onSelect(item.id)}
        style={[styles.pill, { backgroundColor }]}
      >
        <Text style={[styles.pillText, { color: textColor }]}>
          {item.label}
        </Text>
      </HapticTab>
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
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 32,
    borderRadius: 18,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.textSecondary,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
