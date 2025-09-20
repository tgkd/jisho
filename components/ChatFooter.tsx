import { memo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Host, TextField, TextFieldRef } from "@expo/ui/swift-ui";
import { useGenericKeyboardHandler } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticButton } from "@/components/HapticTab";
// Colors are resolved via useThemeColor; direct Colors import not needed here
import { useThemeColor } from "@/hooks/useThemeColor";
import { ExplainRequestType } from "@/services/request";
import { Pill } from "./ui/Pill";

const requestTypes = [
  { label: "Word", id: ExplainRequestType.V, icon: "vocabulary" },
  { label: "Grammar", id: ExplainRequestType.G, icon: "grammar" },
];

// const ICON_SIZE = 32; // Not used in this component
const HEIGHT = 204;

const useGradualKeyboardAnimation = () => {
  const height = useSharedValue(0);

  useGenericKeyboardHandler(
    {
      onMove: (e) => {
        "worklet";
        height.value = e.height;
      },
      onEnd: (e) => {
        "worklet";
        height.value = e.height;
      },
    },
    []
  );

  return height;
};

const ChatFooterView = memo(
  ({
    handleSubmit,
    loading,
  }: {
    handleSubmit: (value: string, req: ExplainRequestType) => Promise<void>;
    loading: boolean;
  }) => {
    const kb = useGradualKeyboardAnimation();
    const instets = useSafeAreaInsets();
    // Themed colors for iOS Messages-like input bubble
    const bubbleBg = useThemeColor({}, "secondaryBackground");
    const inputRef = useRef<TextFieldRef>(null);
    const [value, setValue] = useState("");
    const [requestType, setRequestType] = useState<ExplainRequestType>(
      ExplainRequestType.V
    );

    const handlePress = () => {

      handleSubmit(value, requestType);
      setValue("");
    };

    const animatedStyle = useAnimatedStyle(
      () => {
        "worklet";
        const progress = Math.min(Math.abs(kb.value) / HEIGHT, 1);
        return {
          transform: [{ translateY: -2 * progress }],
        };
      },
      []
    );

    return (
      <Animated.View
        style={[
          animatedStyle,
          styles.footerContainer,
          { bottom: instets.bottom },
        ]}
      >
        <View style={styles.type}>
          {requestTypes.map((e) => (
            <Pill
              key={e.id}
              text={e.label}
              onPress={() => {
                setRequestType(e.id);
              }}
              isActive={requestType === e.id}
            />
          ))}
        </View>

        <View style={styles.inputRow}>
          <View
            style={[
              styles.inputBubble,
              { backgroundColor: bubbleBg },
            ]}
          >
            <Host style={{ flex: 1, minHeight: 44 }}>
              <TextField
                multiline
                numberOfLines={3}
                onChangeText={setValue}
                ref={inputRef}
                placeholder="Text Message"
                modifiers={[
                  { $type: 'font', style: { fontSize: 17, lineHeight: 22 } },
                  { $type: 'textInput', style: styles.textArea },
                ]}
              />
            </Host>
          </View>

          <HapticButton
            onPress={handlePress}
            disabled={loading}
            systemImage="arrow.up.circle"
          />
        </View>
      </Animated.View>
    );
  }
);

ChatFooterView.displayName = "ChatFooterView";

export { ChatFooterView };

const styles = StyleSheet.create({
  footerContainer: {
    left: 0,
    right: 0,
    flexDirection: "column",
    alignItems: "stretch",
    paddingHorizontal: 16,
    gap: 24,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },

  inputBubble: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    // iOS subtle shadow to match Messages composer
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },

  textArea: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    maxHeight: 120,
    // Slightly smaller min height; overall container has 44 min height
    minHeight: 38,
    textAlignVertical: "top",
  },

  sendButton: {
    alignSelf: "flex-end",
    marginBottom: 6,
  },

  type: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 4,
  },
});
