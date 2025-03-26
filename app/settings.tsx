import { Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Alert, StyleSheet, Switch, View } from "react-native";
import { useMMKVString, useMMKVBoolean } from "react-native-mmkv";

import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors, getHighlightColorValue } from "@/constants/Colors";
import { SETTINGS_KEYS } from "@/services/storage";
import { useThemeColor } from "@/hooks/useThemeColor";
import { resetDatabase } from "@/services/database";
import { FuriganaText } from "@/components/FuriganaText";
import { Card } from "@/components/ui/Card";

const highlightColorOptions: Array<{
  label: string;
  value: string;
}> = [
  { label: "黄色", value: "yellow" },
  { label: "青色", value: "blue" },
  { label: "緑色", value: "green" },
  { label: "桃色", value: "pink" },
];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const dividerColor = useThemeColor({}, "separator");
  const [highlightColorState, setHighlightColor] = useMMKVString(
    SETTINGS_KEYS.HIGHLIGHT_COLOR
  );
  const highlightColor = highlightColorState
    ? highlightColorOptions.find(
        (option) => option.value === highlightColorState
      ) ?? highlightColorOptions[0]
    : highlightColorOptions[0];
  const [showFurigana, setShowFurigana] = useMMKVBoolean(
    SETTINGS_KEYS.SHOW_FURIGANA
  );
  const [autoPaste, setAutoPaste] = useMMKVBoolean(
    SETTINGS_KEYS.AUTO_PASTE
  );

  const handleDatabaseReset = () => {
    Alert.alert(
      "Reset Database",
      "This will reset all database caches. This operation cannot be undone. Are you sure you want to continue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await resetDatabase(db);
            } catch (error) {
              console.error("Failed to reset database:", error);
              Alert.alert(
                "Error",
                "Failed to reset database. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: "設定",
          presentation: "modal",
        }}
      />

      <Card>
        <View style={styles.settingItem}>
          <ThemedText size="sm">{"ハイライト色"}</ThemedText>
          <View style={styles.row}>
            {highlightColorOptions.map((o) => (
              <HapticTab
                key={o.value}
                onPress={() => {
                  setHighlightColor(o.value);
                }}
              >
                <View
                  style={[
                    styles.colorPreview,
                    o.value === highlightColor.value ? styles.active : null,
                    {
                      backgroundColor: getHighlightColorValue(o.value),
                    },
                  ]}
                />
              </HapticTab>
            ))}
          </View>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.row}>
            <ThemedText size="sm">{"フリガナ表示"}</ThemedText>
            <Switch
              value={showFurigana}
              onValueChange={setShowFurigana}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
          <View style={styles.center}>
            <FuriganaText
              word="振り仮名"
              reading="ふりがな"
              showFuri={showFurigana}
            />
          </View>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.row}>
            <ThemedText size="sm">{"自動ペースト"}</ThemedText>
            <Switch
              value={autoPaste}
              onValueChange={setAutoPaste}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
          <ThemedText size="xs" style={styles.description}>
            クリップボードの内容を自動的に検索ボックスに貼り付けます
          </ThemedText>
        </View>
      </Card>

      <HapticTab onPress={handleDatabaseReset} style={styles.destructive}>
        <IconSymbol
          name="arrow.clockwise"
          size={20}
          color={Colors.light.error}
        />
        <ThemedText
          darkColor={Colors.dark.error}
          lightColor={Colors.light.error}
        >
          {"データベースをリセット"}
        </ThemedText>
      </HapticTab>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 16,
  },
  settingItem: {
    flexDirection: "column",
    gap: 8,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  colorPreview: {
    width: 40,
    height: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 8,
  },
  destructive: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
  },
  active: {
    borderColor: "rgba(0, 0, 0, 0.2)",
    borderWidth: 2,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.light.accentLight,
  },
  description: {
    color: Colors.light.textSecondary,
  },
});
