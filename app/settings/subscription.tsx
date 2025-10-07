import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useSubscription } from "@/providers/SubscriptionContext";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  View
} from "react-native";

export default function SubscriptionScreen() {
  const subscription = useSubscription();
  const {
    isPremium,
    isTrial,
    trialDaysRemaining,
    dailyUsage,
    packages,
    isLoading,
    purchase,
    restore,
    startTrial,
  } = subscription;

  const monthlyPackage = packages[0];

  const handlePurchase = async () => {
    if (!monthlyPackage) {
      Alert.alert("Error", "Subscription product not available");
      return;
    }

    const success = await purchase(monthlyPackage.identifier);
    if (success) {
      Alert.alert("Success", "You are now a Premium member! 🎉");
    } else {
      Alert.alert("Error", "Purchase failed. Please try again.");
    }
  };

  const handleRestore = async () => {
    const success = await restore();
    if (success) {
      Alert.alert("Success", "Your subscription has been restored!");
    } else {
      Alert.alert("No Purchases Found", "No previous purchases found to restore.");
    }
  };

  const handleStartTrial = () => {
    const success = startTrial();
    if (success) {
      Alert.alert("Trial Started", "Enjoy 7 days of Premium features for free!");
    } else {
      Alert.alert("Trial Unavailable", "You have already used your free trial.");
    }
  };

  const handleManageSubscription = () => {
    Linking.openURL("https://apps.apple.com/account/subscriptions");
  };

  const renderStatusCard = () => {
    if (isPremium) {
      return (
        <Card>
          <View style={styles.statusContainer}>
            <IconSymbol name="checkmark.circle.fill" size={48} color={Colors.light.accent} />
            <ThemedText size="lg" style={styles.statusTitle}>
              Premium Active
            </ThemedText>
            <ThemedText size="sm" type="secondary" style={styles.statusDescription}>
              You have unlimited access to all premium features
            </ThemedText>
          </View>
        </Card>
      );
    }

    if (isTrial && trialDaysRemaining !== null) {
      return (
        <Card>
          <View style={styles.statusContainer}>
            <IconSymbol name="clock.fill" size={48} color={Colors.light.warning} />
            <ThemedText size="lg" style={styles.statusTitle}>
              Trial Active
            </ThemedText>
            <ThemedText size="sm" type="secondary" style={styles.statusDescription}>
              {trialDaysRemaining} {trialDaysRemaining === 1 ? "day" : "days"} remaining
            </ThemedText>
          </View>
        </Card>
      );
    }

    return (
      <Card>
        <View style={styles.statusContainer}>
          <IconSymbol name="star.circle" size={48} color={Colors.light.textSecondary} />
          <ThemedText size="lg" style={styles.statusTitle}>
            Free Plan
          </ThemedText>
          <ThemedText size="sm" type="secondary" style={styles.statusDescription}>
            {dailyUsage.count}/{dailyUsage.limit} AI queries used today
          </ThemedText>
        </View>
      </Card>
    );
  };

  const renderBenefits = () => (
    <Card>
      <ThemedText size="md" style={styles.sectionTitle}>
        Premium Benefits
      </ThemedText>
      <View style={styles.benefitItem}>
        <IconSymbol name="sparkles" size={20} color={Colors.light.accent} />
        <ThemedText size="sm">Unlimited cloud AI queries</ThemedText>
      </View>
      <View style={styles.benefitItem}>
        <IconSymbol name="speaker.wave.3.fill" size={20} color={Colors.light.accent} />
        <ThemedText size="sm">Natural voice pronunciation (cloud TTS)</ThemedText>
      </View>
      <View style={styles.benefitItem}>
        <IconSymbol name="iphone" size={20} color={Colors.light.accent} />
        <ThemedText size="sm">Or use on-device AI for free (no subscription needed)</ThemedText>
      </View>
    </Card>
  );

  const renderActions = () => {
    if (isPremium) {
      return (
        <Card>
          <HapticTab onPress={handleManageSubscription} style={styles.actionButton}>
            <IconSymbol name="gear" size={20} color={Colors.light.accent} />
            <ThemedText size="sm">Manage Subscription</ThemedText>
          </HapticTab>
          <HapticTab onPress={handleRestore} style={styles.actionButton}>
            <IconSymbol name="arrow.clockwise" size={20} color={Colors.light.accent} />
            <ThemedText size="sm">Restore Purchases</ThemedText>
          </HapticTab>
        </Card>
      );
    }

    return (
      <Card>
        {!isTrial && (
          <HapticTab
            onPress={handleStartTrial}
            style={[styles.actionButton, styles.primaryButton]}
          >
            <IconSymbol name="gift.fill" size={20} color="#fff" />
            <ThemedText size="sm" style={styles.primaryButtonText}>
              Start 7-Day Free Trial
            </ThemedText>
          </HapticTab>
        )}

        <HapticTab
          onPress={handlePurchase}
          style={[styles.actionButton, styles.primaryButton]}
          disabled={isLoading || !monthlyPackage}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <IconSymbol name="star.fill" size={20} color="#fff" />
              <ThemedText size="sm" style={styles.primaryButtonText}>
                {monthlyPackage
                  ? `Upgrade to Premium - ${monthlyPackage.product.priceString}/month`
                  : "Loading..."}
              </ThemedText>
            </>
          )}
        </HapticTab>

        <HapticTab onPress={handleRestore} style={styles.actionButton}>
          <IconSymbol name="arrow.clockwise" size={20} color={Colors.light.accent} />
          <ThemedText size="sm">Restore Purchases</ThemedText>
        </HapticTab>
      </Card>
    );
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      {renderStatusCard()}
      {!isPremium && renderBenefits()}
      {renderActions()}

      <ThemedText size="xs" type="secondary" style={styles.disclaimer}>
        Subscription automatically renews unless auto-renew is turned off at least 24 hours
        before the end of the current period. Manage your subscription in App Store settings.
      </ThemedText>
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
  statusContainer: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  statusTitle: {
    fontWeight: "600",
    marginTop: 8,
  },
  statusDescription: {
    textAlign: "center",
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: Colors.light.accent,
    marginBottom: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  disclaimer: {
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 18,
  },
});
