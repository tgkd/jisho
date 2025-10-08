import { Colors } from "@/constants/Colors";
import { useSubscription } from "@/providers/SubscriptionContext";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { HapticTab } from "./HapticTab";
import { PremiumBadge } from "./PremiumBadge";
import { ThemedText } from "./ThemedText";
import { Card } from "./ui/Card";
import { IconSymbol } from "./ui/IconSymbol";

interface PaywallPromptProps {
  visible: boolean;
  onClose: () => void;
  feature?: string;
}

const PREMIUM_FEATURES = [
  {
    icon: "waveform",
    title: "Natural Voice Pronunciation",
    description: "Hear authentic Japanese pronunciation with cloud TTS, just like a native speaker",
  },
  {
    icon: "bubble.left.and.bubble.right",
    title: "AI Conversation Partner",
    description: "Practice Japanese anytime with unlimited AI chat and personalized feedback",
  },
  {
    icon: "lightbulb",
    title: "Smart Word Explanations",
    description: "Get instant AI-powered explanations, examples, and usage tips for any word",
  },
  {
    icon: "book",
    title: "AI Reading Practice",
    description: "Generate custom reading passages at your JLPT level with audio support",
  },
  {
    icon: "infinity",
    title: "Unlimited Access",
    description: "No daily limits on AI features - learn as much as you want, whenever you want",
  },
];

export function PaywallPrompt({ visible, onClose, feature }: PaywallPromptProps) {
  const subscription = useSubscription();

  const monthlyPackage = subscription.packages.find(pkg =>
    pkg.product.identifier.includes("Monthly") ||
    pkg.packageType === "MONTHLY"
  );

  const handleStartTrial = () => {
    const success = subscription.startTrial();
    if (success) {
      onClose();
    }
  };

  const handleUpgrade = async () => {
    if (!monthlyPackage) {
      Alert.alert("Error", "Subscription not available");
      return;
    }

    const success = await subscription.purchase(monthlyPackage.identifier);
    if (success) {
      Alert.alert("Success", "You are now a Premium member! 🎉");
      onClose();
    } else {
      Alert.alert("Error", "Purchase failed. Please try again.");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <PremiumBadge size="md" />
            <ThemedText type="title" style={styles.headerTitle}>
              Unlock Premium Features
            </ThemedText>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color={Colors.light.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {feature && (
            <Card style={styles.featureCard}>
              <ThemedText size="sm" type="secondary">
                You tried to use: <ThemedText style={styles.featureName}>{feature}</ThemedText>
              </ThemedText>
            </Card>
          )}

          <ThemedText size="md" style={styles.subtitle}>
            Get full access to AI-powered Japanese learning
          </ThemedText>

          <View style={styles.featuresContainer}>
            {PREMIUM_FEATURES.map((item, index) => (
              <View key={index} style={styles.featureRow}>
                <View style={styles.iconContainer}>
                  <IconSymbol name={item.icon as any} size={24} color={Colors.light.tint} />
                </View>
                <View style={styles.featureText}>
                  <ThemedText style={styles.featureTitle}>{item.title}</ThemedText>
                  <ThemedText size="sm" type="secondary">
                    {item.description}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

          {!subscription.subscriptionInfo.trialEndDate && (
            <Card style={styles.trialCard}>
              <ThemedText style={styles.trialText}>
                ✨ Start your <ThemedText style={styles.trialHighlight}>7-day free trial</ThemedText>{" "}
                and experience all premium features
              </ThemedText>
            </Card>
          )}

          <View style={styles.usageInfo}>
            <ThemedText size="sm" type="secondary" textAlign="center">
              Free tier: {subscription.dailyUsage.count}/{subscription.dailyUsage.limit} AI queries
              used today
            </ThemedText>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {!subscription.subscriptionInfo.trialEndDate && (
            <HapticTab onPress={handleStartTrial} style={styles.primaryButton}>
              <ThemedText style={styles.primaryButtonText}>Start 7-Day Free Trial</ThemedText>
            </HapticTab>
          )}

          <HapticTab
            onPress={handleUpgrade}
            style={[styles.primaryButton, !subscription.subscriptionInfo.trialEndDate && styles.secondaryButtonStyle]}
            disabled={subscription.isLoading || !monthlyPackage}
          >
            {subscription.isLoading ? (
              <ThemedText style={styles.primaryButtonText}>Loading...</ThemedText>
            ) : (
              <ThemedText style={styles.primaryButtonText}>
                {monthlyPackage
                  ? `Upgrade to Pro - ${monthlyPackage.product.priceString}/month`
                  : "Loading..."}
              </ThemedText>
            )}
          </HapticTab>

          <HapticTab onPress={onClose} style={styles.secondaryButton}>
            <ThemedText type="secondary">Maybe Later</ThemedText>
          </HapticTab>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  featureCard: {
    marginBottom: 16,
    backgroundColor: Colors.light.secondaryBackground,
  },
  featureName: {
    fontWeight: "600",
    color: Colors.light.tint,
  },
  subtitle: {
    marginBottom: 24,
    textAlign: "center",
    opacity: 0.8,
  },
  featuresContainer: {
    gap: 20,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: "row",
    gap: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.secondaryBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  featureText: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontWeight: "600",
    fontSize: 16,
  },
  trialCard: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: Colors.light.tint + "15",
    borderWidth: 1,
    borderColor: Colors.light.tint + "30",
  },
  trialText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  trialHighlight: {
    fontWeight: "700",
    color: Colors.light.tint,
  },
  usageInfo: {
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: Colors.light.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.separator,
  },
  primaryButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  secondaryButtonStyle: {
    backgroundColor: Colors.light.secondaryBackground,
    marginTop: 0,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
});
