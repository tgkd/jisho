import { memo, useRef, useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/HapticTab";
import { useThemeColor } from "@/hooks/useThemeColor";
import { IconSymbol } from "./ui/IconSymbol.ios";

const ChatFooterView = memo(
  ({
    handleSubmit,
    loading,
  }: {
    handleSubmit: (value: string) => Promise<void>;
    loading: boolean;
  }) => {
    const instets = useSafeAreaInsets();
    const inputRef = useRef<TextInput>(null);
    const bg = useThemeColor({}, "secondaryBackground");
    const textColor = useThemeColor({}, "text");
    const placeholderColor = useThemeColor({}, "secondaryText");
    const tintColor = useThemeColor({}, "tint");
    const [value, setValue] = useState("");

    const handlePress = () => {
      inputRef.current?.blur();
      handleSubmit(value);
      setValue("");
    };

    return (
      <View style={[styles.container, { paddingBottom: instets.bottom }]}>
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.inputBubble, { backgroundColor: bg }]}
            onPress={() => inputRef.current?.focus()}
          >
            <TextInput
              multiline
              numberOfLines={3}
              onChangeText={setValue}
              ref={inputRef}
              placeholder="Type a message..."
              placeholderTextColor={placeholderColor}
              value={value}
              style={{ color: textColor }}
            />
          </TouchableOpacity>

          <HapticTab
            style={styles.sendButton}
            onPress={handlePress}
            disabled={loading}
          >
            <IconSymbol
              name="arrow.up.circle"
              size={32}
              color={loading ? placeholderColor : tintColor}
            />
          </HapticTab>
        </View>
      </View>
    );
  }
);

ChatFooterView.displayName = "ChatFooterView";

export { ChatFooterView };

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },

  inputBubble: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  sendButton: {
    height: 36,
    width: 36,
    justifyContent: "center",
    alignItems: "center",
  },

  type: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 4,
  },
});
