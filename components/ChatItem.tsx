import { memo } from "react";
import { Alert, StyleSheet, View } from "react-native";
import Markdown from "react-native-markdown-display";

import { Collapsible } from "@/components/Collapsible";
import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useMdStyles } from "@/hooks/useMdStyles";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Chat } from "@/services/database";
import { MenuActions } from "./MenuActions";

interface Props {
  data: Chat;
  handleDelete: (id: number) => void;
  isLast: boolean;
}

export const ChatListItem = memo(({ data: c, handleDelete, isLast }: Props) => {
  const markdownStyles = useMdStyles();

  return (
    <View style={styles.list}>
      <MenuActions key={c.id} text={c.response}>
        <Collapsible
          rightButton={<RemoveButton chat={c} handleDelete={handleDelete} />}
          title={c.request || c.id.toString()}
          initOpened={isLast}
        >
          <Markdown style={markdownStyles}>{c.response}</Markdown>
        </Collapsible>
      </MenuActions>
    </View>
  );
});

export const RemoveButton = memo(
  ({
    chat,
    handleDelete,
  }: {
    chat: Chat;
    handleDelete: (id: number) => void;
  }) => {
    const iconColor = useThemeColor({}, "text");

    const handlePress = async () => {
      Alert.alert("Delete chat", "Are you sure you want to delete this chat?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDelete(chat.id),
        },
      ]);
    };

    return (
      <HapticTab onPress={handlePress}>
        <IconSymbol name="trash" color={iconColor} size={20} />
      </HapticTab>
    );
  }
);

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
});
