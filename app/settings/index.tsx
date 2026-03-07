import { useSQLiteContext } from "expo-sqlite";
import { Alert, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";

import { FuriganaText } from "@/components/FuriganaText";
import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useSubscription } from "@/providers/SubscriptionContext";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import { clearHistory, resetDatabase } from "@/services/database";
import { SETTINGS_KEYS } from "@/services/storage";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const ai = useUnifiedAI();
  const subscription = useSubscription();

  const [showFurigana = true, setShowFurigana] = useMMKVBoolean(
    SETTINGS_KEYS.SHOW_FURIGANA
  );

  const handleDatabaseReset = () => {
    Alert.alert(
      "Clear Cache",
      "This will clear all cached data including audio and examples. This operation cannot be undone. Are you sure you want to continue?",
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
              await resetDatabase(db);
            } catch (error) {
              console.error("Failed to reset database:", error);
              Alert.alert("Error", "Failed to clear cache. Please try again.");
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
    if (value && !subscription.isPremium) {
      subscription.showPaywall();
      return;
    }
    ai.setCurrentProvider(value ? "remote" : "local");
  };

  const handleToggleFurigana = (value: boolean) => {
    setShowFurigana(value);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Card>
        <View style={styles.settingItem}>
          <View style={styles.row}>
            <ThemedText size="sm">{"Show Furigana"}</ThemedText>
            <Switch value={showFurigana} onValueChange={handleToggleFurigana} />
          </View>
          <View style={styles.furiganaExample}>
            <FuriganaText
              word="食べ物"
              segments={[
                { ruby: "食", rt: "た" },
                { ruby: "べ", rt: "" },
                { ruby: "物", rt: "もの" },
              ]}
              reading="たべもの"
            />
          </View>
        </View>

        <View style={styles.settingItem}>
          <ThemedText size="sm">{"AI Features"}</ThemedText>

          <ThemedText size="xs" style={styles.description}>
            {ai.currentProvider === "remote"
              ? "✨ Using cloud AI"
              : "📱 Using on-device Apple Intelligence"}
          </ThemedText>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <ThemedText size="sm">{"Cloud AI (Premium)"}</ThemedText>
              <ThemedText size="xs" style={styles.description}>
                {"Better voices, faster processing"}
              </ThemedText>
            </View>
            <Switch
              value={ai.currentProvider === "remote"}
              onValueChange={handleToggleRemoteApi}
            />
          </View>

          <HapticTab
            onPress={() => router.push("/settings/subscription-info")}
            style={styles.subscriptionLink}
          >
            <IconSymbol
              name="info.circle"
              size={16}
              color={Colors.light.tint}
            />
            <ThemedText size="sm" style={styles.linkText}>
              {"Learn about Premium Features"}
            </ThemedText>
          </HapticTab>
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
          <ThemedText style={styles.warn}>{"Clear Cache"}</ThemedText>
        </HapticTab>
      </Card>

      <View style={styles.settingItem}>
        <HapticTab
          onPress={() => router.push("/settings/about")}
          style={styles.aboutBtn}
        >
          <ThemedText size="sm" type="secondary">
            {"About"}
          </ThemedText>
        </HapticTab>
      </View>
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
    width: 48,
    height: 32,
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
  aboutBtn: {
    justifyContent: "center",
    alignItems: "center",
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
  furiganaExample: {
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
    margin: "auto",
    marginTop: 8,
    minHeight: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.separator,
    borderRadius: 8,
    width: "100%",
  },
  subscriptionCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.accentLight,
    marginBottom: 16,
  },
  subscriptionLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  linkText: {
    color: Colors.light.tint,
  },
});
