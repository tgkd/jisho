import { useSubscription } from "@/providers/SubscriptionContext";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

export default function SubscriptionInfoScreen() {
  const subscription = useSubscription();
  const colorScheme = useColorScheme() ?? "light";
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await subscription.refreshSubscription();
    setRefreshing(false);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Card>
        <ThemedText size="md">
          Subscribe to access advanced AI capabilities and comprehensive JLPT
          practice materials
        </ThemedText>
        <View style={styles.featureList}>
          <View style={styles.feature}>
            <IconSymbol
              name="sparkles"
              size={24}
              color={Colors[colorScheme].tint}
            />
            <View style={{ flex: 1 }}>
              <ThemedText size="md" style={styles.featureTitle}>
                Cloud AI
              </ThemedText>
              <ThemedText
                size="sm"
                style={{
                  color: Colors[colorScheme].textSecondary,
                  lineHeight: 20,
                }}
              >
                Better voices, faster processing, and enhanced explanations
                powered by advanced cloud AI
              </ThemedText>
            </View>
          </View>

          <View style={styles.feature}>
            <IconSymbol
              name="book.fill"
              size={24}
              color={Colors[colorScheme].tint}
            />
            <View style={{ flex: 1 }}>
              <ThemedText size="md" style={styles.featureTitle}>
                JLPT Practice Passages
              </ThemedText>
              <ThemedText
                size="sm"
                style={{
                  color: Colors[colorScheme].textSecondary,
                  lineHeight: 20,
                }}
              >
                Access comprehensive reading practice materials for all JLPT
                levels (N5-N1)
              </ThemedText>
            </View>
          </View>

          <View style={styles.feature}>
            <IconSymbol
              name="bubble.left.and.bubble.right.fill"
              size={24}
              color={Colors[colorScheme].tint}
            />
            <View style={{ flex: 1 }}>
              <ThemedText size="md" style={styles.featureTitle}>
                Practice Chat
              </ThemedText>
              <ThemedText
                size="sm"
                style={{
                  color: Colors[colorScheme].textSecondary,
                  lineHeight: 20,
                }}
              >
                Interactive AI-powered conversations tailored to your JLPT level
                for immersive practice
              </ThemedText>
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <ThemedText size="md" style={styles.featureTitle}>
          AI Features Disclaimer
        </ThemedText>

        <View style={styles.disclaimerSection}>
          <ThemedText
            size="sm"
            style={{ color: Colors[colorScheme].textSecondary, lineHeight: 20 }}
          >
            <ThemedText size="sm" style={styles.featureTitle}>
              Third-Party AI Providers:
            </ThemedText>{" "}
            Premium AI features are provided through third-party services. We do
            not control the output or accuracy of AI-generated content.
          </ThemedText>
        </View>

        <View style={styles.disclaimerSection}>
          <ThemedText
            size="sm"
            style={{ color: Colors[colorScheme].textSecondary, lineHeight: 20 }}
          >
            <ThemedText size="sm" style={styles.featureTitle}>
              No Warranty of Accuracy:
            </ThemedText>{" "}
            AI-generated explanations, translations, and responses may contain
            errors, inaccuracies, or misleading information.
          </ThemedText>
        </View>

        <View style={styles.disclaimerSection}>
          <ThemedText
            size="sm"
            style={{ color: Colors[colorScheme].textSecondary, lineHeight: 20 }}
          >
            <ThemedText size="sm" style={styles.featureTitle}>
              Educational Use Only:
            </ThemedText>{" "}
            AI features are for educational and informational purposes only. Do
            not rely on them for professional, academic, business, legal, or
            medical contexts.
          </ThemedText>
        </View>

        <View style={styles.disclaimerSection}>
          <ThemedText
            size="sm"
            style={{ color: Colors[colorScheme].textSecondary, lineHeight: 20 }}
          >
            <ThemedText size="sm" style={styles.featureTitle}>
              Your Responsibility:
            </ThemedText>{" "}
            You are solely responsible for verifying AI-generated information
            with authoritative sources and evaluating its appropriateness for
            your use case.
          </ThemedText>
        </View>

        <View style={styles.disclaimerSection}>
          <ThemedText
            size="sm"
            style={{ color: Colors[colorScheme].textSecondary, lineHeight: 20 }}
          >
            See our full{" "}
            <ThemedText
              size="sm"
              style={{
                color: Colors[colorScheme].tint,
                fontWeight: "600",
                textDecorationLine: "underline",
              }}
              onPress={() => Linking.openURL("https://thetango.org/terms.html")}
            >
              Terms of Service
            </ThemedText>{" "}
            for complete details on AI feature limitations and liability.
          </ThemedText>
        </View>
      </Card>

      <Card>
        {subscription.isPremium ? (
          <View style={styles.premiumStatus}>
            <IconSymbol
              name="checkmark.circle.fill"
              size={32}
              color={Colors[colorScheme].tint}
            />
            <ThemedText
              size="md"
              style={{ flex: 1, color: Colors[colorScheme].tint }}
            >
              You have access to all premium features
            </ThemedText>
          </View>
        ) : (
          <HapticTab
            onPress={() => {
              subscription.showPaywall();
            }}
            style={[
              styles.subscribeButton,
              { backgroundColor: Colors[colorScheme].tint },
            ]}
          >
            <ThemedText size="md" style={styles.subscribeButtonText}>
              Subscribe Now
            </ThemedText>
          </HapticTab>
        )}

        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.refreshButton}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={Colors[colorScheme].tint} />
          ) : (
            <IconSymbol
              name="arrow.clockwise"
              size={20}
              color={Colors[colorScheme].text}
            />
          )}
          <ThemedText size="sm">Refresh Subscription Status</ThemedText>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 24,
  },
  featureList: {
    marginTop: 16,
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
  subscribeButton: {
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
  disclaimerSection: {
    marginTop: 12,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
});
