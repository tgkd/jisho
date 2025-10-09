import { Linking, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { Colors } from "@/constants/Colors";
import { useSubscription } from "@/providers/SubscriptionContext";

export default function AboutScreen() {
  const sub = useSubscription();
  const subType = sub.subscriptionInfo.productId
    ? sub.subscriptionInfo.productId?.includes("lifetime")
      ? "lifetime"
      : "monthly"
    : null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Card>
        <View style={styles.section}>
          <ThemedText size="sm" style={styles.description}>
            Jisho is a comprehensive Japanese dictionary app featuring offline
            lookup capabilities, AI-powered explanations, and local machine
            learning. Perfect for students and enthusiasts of the Japanese
            language.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText size="md" style={styles.sectionTitle}>
            Data Sources
          </ThemedText>
          <ThemedText size="sm" style={styles.description}>
            Dictionary data sourced from JMdict and KANJIDIC projects, provided
            by the Electronic Dictionary Research and Development Group.
          </ThemedText>

          <View style={styles.linkSection}>
            <ThemedText
              onPress={() =>
                Linking.openURL(
                  "https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project"
                )
              }
              size="sm"
              style={styles.linkText}
            >
              JMdict Project
            </ThemedText>

            <ThemedText
              onPress={() =>
                Linking.openURL(
                  "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project"
                )
              }
              size="sm"
              style={styles.linkText}
            >
              KANJIDIC Project
            </ThemedText>
          </View>
        </View>
      </Card>
      <Card>
        <View style={styles.section}>
          <ThemedText size="md" style={styles.sectionTitle}>
            Subscription
          </ThemedText>
          <ThemedText size="sm" style={styles.description}>
            {sub.isPremium
              ? "Thank you for being a subscriber! Your support helps us continue to improve the app and add new features."
              : "Subscribe to unlock AI features, support future development, and help keep the app ad-free."}
          </ThemedText>
          <ThemedText
            size="sm"
            style={[styles.description, { marginTop: 8 }]}
            onPress={() => sub.showPaywall()}
          >
            {subType === "monthly"
              ? "You are subscribed to the monthly plan."
              : subType === "lifetime"
              ? "You have a lifetime subscription."
              : "You are not currently subscribed."}
          </ThemedText>
        </View>
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
  appInfo: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  appTitle: {
    fontWeight: "600",
    marginTop: 8,
  },
  version: {
    color: Colors.light.textSecondary,
  },
  section: {
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  description: {
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  featureList: {
    gap: 12,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  linkSection: {
    gap: 8,
    marginTop: 8,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  linkText: {
    color: Colors.light.tint,
  },
});
