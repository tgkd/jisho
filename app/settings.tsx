import { Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";

import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors, getHighlightColorValue } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useLocalAI } from "@/providers/LocalAIProvider";
import {
  clearBookmarks,
  clearHistory,
  resetDatabase,
} from "@/services/database";
import { SETTINGS_KEYS } from "@/services/storage";

const highlightColorOptions: {
  label: string;
  value: string;
}[] = [
  { label: "黄色", value: "yellow" },
  { label: "青色", value: "blue" },
  { label: "緑色", value: "green" },
  { label: "桃色", value: "pink" },
];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [hiddenTapCount, setHiddenTapCount] = useState(0);
  const [showCredentials, setShowCredentials] = useState(false);

  const [highlightColorState, setHighlightColor] = useMMKVString(
    SETTINGS_KEYS.HIGHLIGHT_COLOR
  );
  const highlightColor = highlightColorState
    ? highlightColorOptions.find(
        (option) => option.value === highlightColorState
      ) ?? highlightColorOptions[0]
    : highlightColorOptions[0];
  const backgroundColor = useThemeColor({}, "background");

  const [autoPaste, setAutoPaste] = useMMKVBoolean(SETTINGS_KEYS.AUTO_PASTE);
  const [apiAuthUsername, setApiAuthUsername] = useMMKVString(
    SETTINGS_KEYS.API_AUTH_USERNAME
  );
  const localAi = useLocalAI();
  const [apiAuthPassword, setApiAuthPassword] = useMMKVString(
    SETTINGS_KEYS.API_AUTH_PASSWORD
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

  const handleClearHistory = () => {
    Alert.alert(
      "Clear History",
      "This will clear your search history. This operation cannot be undone. Are you sure you want to continue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearHistory(db);
              Alert.alert("Success", "Search history has been cleared.");
            } catch (error) {
              console.error("Failed to clear history:", error);
              Alert.alert(
                "Error",
                "Failed to clear search history. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const handleClearBookmarks = () => {
    Alert.alert(
      "Clear Bookmarks",
      "This will clear all your bookmarks. This operation cannot be undone. Are you sure you want to continue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearBookmarks(db);
              Alert.alert("Success", "Bookmarks have been cleared.");
            } catch (error) {
              console.error("Failed to clear bookmarks:", error);
              Alert.alert(
                "Error",
                "Failed to clear bookmarks. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const handleHiddenTap = () => {
    setHiddenTapCount((p) => p + 1);

    if (hiddenTapCount >= 7) {
      setShowCredentials(true);
      setHiddenTapCount(0);
    }
  };

  const handleChangeLocalAiEnabled = (value: boolean) => {
    localAi.toggleState();
  };

  return (
    <ScrollView>
      <ThemedView style={styles.container}>
        <Stack.Screen
          options={{
            headerTitle: "設定",
            presentation: "modal",
          }}
        />

        <Card>
          <View style={styles.settingItem}>
            <ThemedText size="sm">{"Highlight Color"}</ThemedText>
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
              <ThemedText size="sm">{"Auto Paste"}</ThemedText>
              <Switch
                value={autoPaste}
                onValueChange={setAutoPaste}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
            <ThemedText size="xs" style={styles.description}>
              {"Automatically paste clipboard content into the search box"}
            </ThemedText>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.row}>
              <ThemedText size="sm">{"Local AI Enabled"}</ThemedText>
              <Switch
                value={localAi.enabled}
                onValueChange={handleChangeLocalAiEnabled}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
            {localAi.enabled && localAi.downloadProgress ? (
              <View style={styles.row}>
                <ThemedText size="xs" style={styles.description}>
                  {`Downloading model: ${Math.round(
                    localAi.downloadProgress * 100
                  )}%`}
                </ThemedText>
              </View>
            ) : null}
            <ThemedText size="xs" style={styles.description}>
              {"Enable local AI features (requires model download)"}
            </ThemedText>
          </View>

          {/* <View style={styles.settingItem}>
          <View style={styles.row}>
            <ThemedText size="sm">{"Show Furigana"}</ThemedText>
            <ThemedText size="sm" style={styles.description}>
              {"not available yet"}
            </ThemedText>
            <Switch
              value={showFurigana}
              disabled
              onValueChange={setShowFurigana}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
          <View style={styles.center}>
            <FuriganaText word="振り仮名" reading="ふりがな" />
          </View>
        </View> */}
        </Card>

        <Card>
          <HapticTab onPress={handleClearHistory} style={styles.actionButton}>
            <IconSymbol
              name="clock.arrow.circlepath"
              size={20}
              color={Colors.light.error}
            />
            <ThemedText
              darkColor={Colors.dark.error}
              lightColor={Colors.light.error}
            >
              {"Clear Search History"}
            </ThemedText>
          </HapticTab>

          <HapticTab onPress={handleClearBookmarks} style={styles.actionButton}>
            <IconSymbol
              name="bookmark.slash"
              size={20}
              color={Colors.light.error}
            />
            <ThemedText
              darkColor={Colors.dark.error}
              lightColor={Colors.light.error}
            >
              {"Clear Bookmarks"}
            </ThemedText>
          </HapticTab>
          <HapticTab onPress={handleDatabaseReset} style={styles.actionButton}>
            <IconSymbol
              name="arrow.clockwise"
              size={20}
              color={Colors.light.error}
            />
            <ThemedText
              darkColor={Colors.dark.error}
              lightColor={Colors.light.error}
            >
              {"Reset Database"}
            </ThemedText>
          </HapticTab>
        </Card>

        <TouchableOpacity
          onPress={handleHiddenTap}
          style={[styles.hiddenButton, { backgroundColor }]}
          activeOpacity={1}
        ></TouchableOpacity>

        {showCredentials && (
          <Card style={{ marginBottom: 16 }}>
            <ThemedText size="sm" style={styles.sectionTitle}>
              {"Credentials"}
            </ThemedText>
            <View style={styles.settingItem}>
              <ThemedText size="sm">{"User"}</ThemedText>
              <TextInput
                style={styles.textInput}
                value={apiAuthUsername}
                onChangeText={setApiAuthUsername}
                placeholder="Username"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.settingItem}>
              <ThemedText size="sm">{"Password"}</ThemedText>
              <TextInput
                style={styles.textInput}
                value={apiAuthPassword}
                onChangeText={setApiAuthPassword}
                placeholder="Password"
                autoCapitalize="none"
                secureTextEntry
              />
            </View>
            <ThemedText size="xs" style={styles.description}>
              {"Provide API credentials to enable AI features"}
            </ThemedText>
          </Card>
        )}
      </ThemedView>
    </ScrollView>
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
  sectionTitle: {
    marginBottom: 12,
    fontWeight: "500",
  },
  actionButton: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
  },
  textInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  hiddenButton: {
    height: 48,
    width: 48,
  },
});
