import { useSQLiteContext } from "expo-sqlite";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View
} from "react-native";
import { useMMKVString } from "react-native-mmkv";

import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors, getHighlightColorValue } from "@/constants/Colors";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import { clearHistory, resetDatabase } from "@/services/database";
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
  const ai = useUnifiedAI();

  const [highlightColorState, setHighlightColor] = useMMKVString(
    SETTINGS_KEYS.HIGHLIGHT_COLOR
  );
  const highlightColor = highlightColorState
    ? highlightColorOptions.find(
        (option) => option.value === highlightColorState
      ) ?? highlightColorOptions[0]
    : highlightColorOptions[0];
  const [apiAuthUsername, setApiAuthUsername] = useMMKVString(
    SETTINGS_KEYS.API_AUTH_USERNAME
  );
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

  const handleToggleRemoteApi = (value: boolean) => {
    ai.setCurrentProvider(value ? "remote" : "local");
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
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
            <ThemedText size="sm">{"Turn on remote API?"}</ThemedText>
            <Switch
              value={ai.currentProvider === "remote"}
              onValueChange={handleToggleRemoteApi}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
          <ThemedText size="xs" style={styles.description}>
            {ai.currentProvider === "remote"
              ? "Using remote API (requires credentials below)"
              : "Using local Apple Intelligence (requires iOS 18.1+)"
            }
          </ThemedText>
          <ThemedText size="xs" style={styles.description}>
            {"AI features: conversational chat, word explanations, example sentences, and text-to-speech"}
          </ThemedText>

          {ai.currentProvider === "remote" ? (
            <View>
              <View style={styles.settingItem}>
                <TextInput
                  style={styles.textInput}
                  value={apiAuthUsername}
                  onChangeText={setApiAuthUsername}
                  placeholder="Username"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.settingItem}>
                <TextInput
                  style={styles.textInput}
                  value={apiAuthPassword}
                  onChangeText={setApiAuthPassword}
                  placeholder="Password"
                  autoCapitalize="none"
                  secureTextEntry
                />
              </View>
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        <HapticTab onPress={handleClearHistory} style={styles.actionButton}>
          <IconSymbol
            name="clock.arrow.circlepath"
            size={20}
            color={Colors.light.error}
          />
          <ThemedText style={styles.warn}>{"Clear Search History"}</ThemedText>
        </HapticTab>

        <HapticTab onPress={handleDatabaseReset} style={styles.actionButton}>
          <IconSymbol
            name="arrow.clockwise"
            size={20}
            color={Colors.light.error}
          />
          <ThemedText style={styles.warn}>{"Reset Database"}</ThemedText>
        </HapticTab>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 24,
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
    padding: 12,
  },
  warn: {
    color: Colors.light.error,
  },
});
