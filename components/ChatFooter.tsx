import {
  ClipboardPasteButton,
  isPasteButtonAvailable,
  PasteEventPayload,
} from "expo-clipboard";
import { memo, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useGenericKeyboardHandler } from "react-native-keyboard-controller";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Pill } from "./ui/Pill";
import { ExplainRequestType } from "@/services/request";

const requestTypes = [
  { label: "Kanji", id: ExplainRequestType.K, icon: "kanji" },
  { label: "Vocabulary", id: ExplainRequestType.V, icon: "vocabulary" },
  { label: "Grammar", id: ExplainRequestType.G, icon: "grammar" },
];

const ICON_SIZE = 36;
const HEIGHT = 96;

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

export const ChatFooterView = memo(
  ({
    handleSubmit,
    loading,
  }: {
    handleSubmit: (value: string, req: ExplainRequestType) => Promise<void>;
    loading: boolean;
  }) => {
    const kb = useGradualKeyboardAnimation();
    const instets = useSafeAreaInsets();
    const bg = useThemeColor({}, "secondaryBackground");
    const iconC = useThemeColor({}, "tint");
    const inputC = useThemeColor({}, "text");
    const inputBg = useThemeColor({}, "background");
    const inputRef = useRef<TextInput>(null);
    const [value, setValue] = useState("");
    const [requestType, setRequestType] = useState<ExplainRequestType>(
      ExplainRequestType.V
    );

    const handlePress = () => {
      handleSubmit(value, requestType);
      inputRef.current?.blur();
      setValue("");
    };

    const handlePasteClipboard = (data: PasteEventPayload) => {
      if (data.type === "text") {
        setValue(data.text);
      }
    };

    const animatedStyle = useAnimatedStyle(
      () => ({
        transform: [
          { translateY: interpolate(kb.value, [0, -HEIGHT], [0, -8]) },
        ],
      }),
      []
    );

    return (
      <Animated.View
        style={[
          animatedStyle,
          styles.footerContainer,
          { backgroundColor: bg, paddingBottom: instets.bottom },
        ]}
      >
        <TextInput
          scrollEnabled={false}
          multiline
          numberOfLines={4}
          onChangeText={setValue}
          ref={inputRef}
          value={value}
          style={[styles.textArea, { color: inputC, backgroundColor: inputBg }]}
          placeholder="What does りんご mean?"
        />
        <View style={styles.buttons}>
          {isPasteButtonAvailable ? (
            <ClipboardPasteButton
              onPress={handlePasteClipboard}
              style={styles.paste}
              cornerStyle="capsule"
              displayMode="iconOnly"
            />
          ) : null}

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

          <HapticTab onPress={handlePress} disabled={loading}>
            <IconSymbol
              color={loading ? Colors.light.disabled : iconC}
              name="arrow.up.circle.fill"
              size={ICON_SIZE}
            />
          </HapticTab>
        </View>
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  footerContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
    flexDirection: "column",
    alignItems: "stretch",
    padding: 12,
    gap: 8,
  },

  textArea: {
    flexGrow: 1,
    padding: 10,
    borderRadius: 12,
    fontSize: 16,
    maxHeight: 200,
  },

  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paste: {
    height: 32,
    width: 32,
  },
  type: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  }
});
