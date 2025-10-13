import { useSubscription } from "@/providers/SubscriptionContext";
import { useRouter } from "expo-router";
import { Linking, ScrollView, StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";

export default function SubscriptionInfoScreen() {
  const router = useRouter();
  const subscription = useSubscription();

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
            <IconSymbol name="sparkles" size={24} color={Colors.light.tint} />
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
            <IconSymbol name="book.fill" size={24} color={Colors.light.tint} />
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
                Interactive AI-powered conversations tailored to your JLPT level
                for immersive practice
              </ThemedText>
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <ThemedText size="md" style={styles.disclaimerTitle}>
          AI Features Disclaimer
        </ThemedText>

        <View style={styles.disclaimerSection}>
          <ThemedText size="sm" style={styles.disclaimerText}>
            <ThemedText size="sm" style={styles.disclaimerBold}>
              Third-Party AI Providers:
            </ThemedText>{" "}
            Premium AI features are provided through third-party services. We do
            not control the output or accuracy of AI-generated content.
          </ThemedText>
        </View>

        <View style={styles.disclaimerSection}>
          <ThemedText size="sm" style={styles.disclaimerText}>
            <ThemedText size="sm" style={styles.disclaimerBold}>
              No Warranty of Accuracy:
            </ThemedText>{" "}
            AI-generated explanations, translations, and responses may contain
            errors, inaccuracies, or misleading information.
          </ThemedText>
        </View>

        <View style={styles.disclaimerSection}>
          <ThemedText size="sm" style={styles.disclaimerText}>
            <ThemedText size="sm" style={styles.disclaimerBold}>
              Educational Use Only:
            </ThemedText>{" "}
            AI features are for educational and informational purposes only. Do
            not rely on them for professional, academic, business, legal, or
            medical contexts.
          </ThemedText>
        </View>

        <View style={styles.disclaimerSection}>
          <ThemedText size="sm" style={styles.disclaimerText}>
            <ThemedText size="sm" style={styles.disclaimerBold}>
              Your Responsibility:
            </ThemedText>{" "}
            You are solely responsible for verifying AI-generated information
            with authoritative sources and evaluating its appropriateness for
            your use case.
          </ThemedText>
        </View>

        <View style={styles.disclaimerSection}>
          <ThemedText size="sm" style={styles.disclaimerText}>
            See our full{" "}
            <ThemedText
              size="sm"
              style={styles.linkText}
              onPress={() => Linking.openURL("https://thetango.org/terms.html")}
            >
              Terms of Service
            </ThemedText>{" "}
            for complete details on AI feature limitations and liability.
          </ThemedText>
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
  disclaimerText: {
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  disclaimerTitle: {
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 12,
  },
  disclaimerSection: {
    marginTop: 12,
  },
  disclaimerBold: {
    fontWeight: "600",
    color: Colors.light.text,
  },
  linkText: {
    color: Colors.light.tint,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  legalLinks: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
  },
  legalLinkButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  legalLinkText: {
    color: Colors.light.tint,
    fontWeight: "600",
  },
});
