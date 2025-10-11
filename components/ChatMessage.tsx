import { FuriganaText } from "@/components/FuriganaText";
import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import type { FuriganaSegment } from "@/services/database";
import { getFuriganaForText } from "@/services/database";
import { SETTINGS_KEYS } from "@/services/storage";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  onWordPress?: (word: string) => void;
  onPlayAudio?: () => void;
  isPlaying?: boolean;
}

export function ChatMessage({
  role,
  content,
  timestamp,
  onWordPress,
  onPlayAudio,
  isPlaying = false,
}: ChatMessageProps) {
  const db = useSQLiteContext();
  const [showFurigana] = useMMKVBoolean(SETTINGS_KEYS.SHOW_FURIGANA);
  const [furiganaSegments, setFuriganaSegments] = useState<FuriganaSegment[]>(
    []
  );
  const [isLoadingFurigana, setIsLoadingFurigana] = useState(false);

  const isAssistant = role === "assistant";
  const showAudioButton = isAssistant && onPlayAudio;

  useEffect(() => {
    if (isAssistant && showFurigana && content) {
      loadFurigana();
    }
  }, [content, isAssistant, showFurigana]);

  const loadFurigana = async () => {
    try {
      setIsLoadingFurigana(true);
      const furiganaData = await getFuriganaForText(db, content);
      if (furiganaData) {
        setFuriganaSegments(furiganaData.segments);
      }
    } catch (error) {
      console.error("Failed to load furigana:", error);
    } finally {
      setIsLoadingFurigana(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleTextPress = () => {
    if (onWordPress) {
      onWordPress(content);
    }
  };

  return (
    <View
      style={[
        styles.container,
        isAssistant ? styles.assistantContainer : styles.userContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isAssistant ? styles.assistantBubble : styles.userBubble,
        ]}
      >
        <Pressable onPress={handleTextPress}>
          {isAssistant && furiganaSegments.length > 0 && showFurigana ? (
            <FuriganaText
              word={content}
              segments={furiganaSegments}
              reading=""
              textStyle={[
                styles.messageText,
                isAssistant ? styles.assistantText : styles.userText,
              ]}
            />
          ) : (
            <ThemedText
              size="sm"
              style={[
                styles.messageText,
                isAssistant ? styles.assistantText : styles.userText,
              ]}
            >
              {content}
            </ThemedText>
          )}
        </Pressable>

        {showAudioButton && (
          <HapticTab
            onPress={onPlayAudio}
            style={[
              styles.audioButton,
              isPlaying && styles.audioButtonPlaying,
            ]}
          >
            <IconSymbol
              name={isPlaying ? "stop.circle" : "play.circle"}
              size={20}
              color={isPlaying ? Colors.light.tint : Colors.light.textSecondary}
            />
          </HapticTab>
        )}
      </View>

      <View
        style={[
          styles.timestampContainer,
          isAssistant
            ? styles.timestampLeft
            : styles.timestampRight,
        ]}
      >
        <ThemedText size="xs" type="secondary" style={styles.timestamp}>
          {formatTime(timestamp)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  assistantContainer: {
    alignItems: "flex-start",
  },
  userContainer: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  assistantBubble: {
    backgroundColor: Colors.light.secondaryBackground,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: Colors.light.tint,
    borderBottomRightRadius: 4,
  },
  messageText: {
    lineHeight: 22,
  },
  assistantText: {
    color: Colors.light.text,
  },
  userText: {
    color: "#FFFFFF",
  },
  audioButton: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: Colors.light.accentLight,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  audioButtonPlaying: {
    backgroundColor: Colors.light.accentLight,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  timestampContainer: {
    marginTop: 2,
    paddingHorizontal: 4,
  },
  timestampLeft: {
    alignSelf: "flex-start",
  },
  timestampRight: {
    alignSelf: "flex-end",
  },
  timestamp: {
    fontSize: 11,
  },
});
