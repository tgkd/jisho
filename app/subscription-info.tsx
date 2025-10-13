import { useSubscription } from "@/providers/SubscriptionContext";
import { Stack, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";

export default function SubscriptionInfoScreen() {
  const router = useRouter();
  const subscription = useSubscription();

  return (
    <>
      <Stack.Screen
        options={{
          presentation: "modal",
          title: "Premium Features",
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <Card>
          <View style={styles.header}>
            <ThemedText size="lg" style={styles.title}>
              Unlock Premium Features
            </ThemedText>
            <ThemedText size="sm" style={styles.description}>
              Subscribe to access advanced AI capabilities and comprehensive JLPT
              practice materials
            </ThemedText>
          </View>
        </Card>

        <Card>
          <View style={styles.featureList}>
            <View style={styles.feature}>
              <IconSymbol
                name="sparkles"
                size={24}
                color={Colors.light.tint}
              />
              <View style={{ flex: 1 }}>
                <ThemedText size="md" style={styles.featureTitle}>
                  Cloud AI
                </ThemedText>
                <ThemedText size="sm" style={styles.featureDescription}>
                  Better voices, faster processing, and enhanced explanations
                  powered by advanced cloud AI
                </ThemedText>
              </View>
            </View>

            <View style={styles.feature}>
              <IconSymbol
                name="book.fill"
                size={24}
                color={Colors.light.tint}
              />
              <View style={{ flex: 1 }}>
                <ThemedText size="md" style={styles.featureTitle}>
                  JLPT Practice Passages
                </ThemedText>
                <ThemedText size="sm" style={styles.featureDescription}>
                  Access comprehensive reading practice materials for all JLPT
                  levels (N5-N1)
                </ThemedText>
              </View>
            </View>

            <View style={styles.feature}>
              <IconSymbol
                name="bubble.left.and.bubble.right.fill"
                size={24}
                color={Colors.light.tint}
              />
              <View style={{ flex: 1 }}>
                <ThemedText size="md" style={styles.featureTitle}>
                  Practice Chat
                </ThemedText>
                <ThemedText size="sm" style={styles.featureDescription}>
                  Interactive AI-powered conversations tailored to your JLPT
                  level for immersive practice
                </ThemedText>
              </View>
            </View>
          </View>
        </Card>

        {!subscription.isPremium && (
          <HapticTab
            onPress={() => {
              router.back();
              subscription.showPaywall();
            }}
            style={styles.subscribeButton}
          >
            <ThemedText size="md" style={styles.subscribeButtonText}>
              Subscribe Now
            </ThemedText>
          </HapticTab>
        )}

        {subscription.isPremium && (
          <Card>
            <View style={styles.premiumStatus}>
              <IconSymbol
                name="checkmark.circle.fill"
                size={32}
                color={Colors.light.tint}
              />
              <ThemedText size="md" style={styles.premiumText}>
                You have access to all premium features
              </ThemedText>
            </View>
          </Card>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 24,
  },
  header: {
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontWeight: "600",
  },
  description: {
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  featureList: {
    gap: 24,
  },
  feature: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  featureTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  featureDescription: {
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  subscribeButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  premiumStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
  },
  premiumText: {
    flex: 1,
    color: Colors.light.tint,
  },
});
