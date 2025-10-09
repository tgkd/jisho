import { useSQLiteContext } from "expo-sqlite";
import { Alert, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv";

import { FuriganaText } from "@/components/FuriganaText";
import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors, getHighlightColorValue } from "@/constants/Colors";
import { useSubscription } from "@/providers/SubscriptionContext";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";
import { clearHistory, resetDatabase } from "@/services/database";
import { SETTINGS_KEYS } from "@/services/storage";
import { useRouter } from "expo-router";

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
  const router = useRouter();
  const db = useSQLiteContext();
  const ai = useUnifiedAI();
  const subscription = useSubscription();

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
            <ThemedText size="sm">{"Show Furigana"}</ThemedText>
            <Switch value={showFurigana} onValueChange={handleToggleFurigana} />
          </View>
          <View
            style={[
              styles.furiganaExample,
              { backgroundColor: getHighlightColorValue(highlightColor.value) },
            ]}
          >
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

        <HapticTab
          onPress={() => router.push("/settings/subscription")}
          style={styles.subscriptionCard}
        >
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <ThemedText size="sm">
                {subscription.isPremium ? "Premium ✨" : "Free Plan"}
              </ThemedText>
              {!subscription.isPremium && (
                <ThemedText size="xs" type="secondary">
                  Unlimited AI queries included
                </ThemedText>
              )}
            </View>
            <IconSymbol
              name="chevron.right"
              size={16}
              color={Colors.light.textSecondary}
            />
          </View>
        </HapticTab>

        <View style={styles.settingItem}>
          <ThemedText size="sm">{"AI Features"}</ThemedText>
          <ThemedText size="xs" style={styles.description}>
            {"Choose between on-device AI or cloud-powered AI"}
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

          <ThemedText size="xs" style={styles.description}>
            {ai.currentProvider === "remote"
              ? "✨ Using cloud AI - premium features enabled"
              : "📱 Using on-device Apple Intelligence (free)"}
          </ThemedText>
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

      <HapticTab
        onPress={() => router.push("/settings/about")}
        style={styles.aboutBtn}
      >
        <ThemedText size="sm" type="secondary">
          {"About"}
        </ThemedText>
      </HapticTab>
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
});
