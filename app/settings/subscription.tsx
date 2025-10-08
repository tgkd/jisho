import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/ui/Card";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useSubscription } from "@/providers/SubscriptionContext";
import React from "react";
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

  const [showTestInfo, setShowTestInfo] = React.useState(false);

  const monthlyPackage = packages.find(pkg =>
    pkg.product.identifier.includes("Monthly") ||
    pkg.packageType === "MONTHLY"
  );
  const lifetimePackage = packages.find(pkg =>
    pkg.product.identifier.includes("Lifetime") ||
    pkg.packageType === "LIFETIME"
  );

  const handlePurchase = async (pkg: typeof packages[0]) => {
    if (!pkg) {
      Alert.alert("Error", "Product not available");
      return;
    }

    const success = await purchase(pkg.identifier);
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
            <IconSymbol name="clock.fill" size={48} color={Colors.light.tint} />
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

        {lifetimePackage && (
          <HapticTab
            onPress={() => handlePurchase(lifetimePackage)}
            style={[styles.actionButton, styles.primaryButton]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <IconSymbol name="infinity" size={20} color="#fff" />
                <ThemedText size="sm" style={styles.primaryButtonText}>
                  Lifetime Access - {lifetimePackage.product.priceString}
                </ThemedText>
              </>
            )}
          </HapticTab>
        )}

        {monthlyPackage && (
          <HapticTab
            onPress={() => handlePurchase(monthlyPackage)}
            style={[styles.actionButton, styles.primaryButton]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <IconSymbol name="star.fill" size={20} color="#fff" />
                <ThemedText size="sm" style={styles.primaryButtonText}>
                  Monthly Subscription - {monthlyPackage.product.priceString}/month
                </ThemedText>
              </>
            )}
          </HapticTab>
        )}

        {!monthlyPackage && !lifetimePackage && (
          <ThemedText size="sm" type="secondary" textAlign="center" style={{ paddingVertical: 16 }}>
            Loading subscription options...
          </ThemedText>
        )}

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

      <HapticTab
        onPress={() => setShowTestInfo(!showTestInfo)}
        style={styles.actionButton}
      >
        <IconSymbol
          name={showTestInfo ? "chevron.up" : "chevron.down"}
          size={16}
          color={Colors.light.textSecondary}
        />
        <ThemedText size="xs" type="secondary">
          {showTestInfo ? 'Hide Test Info' : 'Show Test Info'}
        </ThemedText>
      </HapticTab>

      {showTestInfo && (
        <Card style={{ backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd' }}>
        <ThemedText size="sm" style={{ fontWeight: '600', marginBottom: 12 }}>
          🧪 Test Info
        </ThemedText>

        <View style={{ gap: 8 }}>
          <ThemedText size="xs" type="secondary">
            Packages loaded: {packages.length}
          </ThemedText>

          {packages.map((pkg, idx) => (
            <View key={idx} style={{ paddingLeft: 8, paddingVertical: 4, backgroundColor: '#fff', borderRadius: 4 }}>
              <ThemedText size="xs" style={{ fontWeight: '600' }}>
                {pkg.product.title}
              </ThemedText>
              <ThemedText size="xs" type="secondary">
                ID: {pkg.product.identifier}
              </ThemedText>
              <ThemedText size="xs" type="secondary">
                Price: {pkg.product.priceString}
              </ThemedText>
              <ThemedText size="xs" type="secondary">
                Type: {pkg.packageType}
              </ThemedText>
            </View>
          ))}

          {packages.length === 0 && (
            <ThemedText size="xs" type="secondary">
              No packages available yet...
            </ThemedText>
          )}
        </View>

        <View style={{ marginTop: 16, gap: 8 }}>
          <HapticTab
            onPress={() => {
              Alert.alert(
                "Test Purchase",
                `Monthly: ${monthlyPackage ? '✅ Found' : '❌ Not found'}\nLifetime: ${lifetimePackage ? '✅ Found' : '❌ Not found'}`
              );
            }}
            style={[styles.actionButton, { backgroundColor: '#007AFF' }]}
          >
            <ThemedText size="xs" style={{ color: '#fff' }}>
              Check Package Detection
            </ThemedText>
          </HapticTab>

          {monthlyPackage && (
            <HapticTab
              onPress={() => handlePurchase(monthlyPackage)}
              style={[styles.actionButton, { backgroundColor: '#34C759' }]}
              disabled={isLoading}
            >
              <ThemedText size="xs" style={{ color: '#fff' }}>
                {isLoading ? 'Processing...' : '💳 Test Subscribe (Monthly)'}
              </ThemedText>
            </HapticTab>
          )}

          {lifetimePackage && (
            <HapticTab
              onPress={() => handlePurchase(lifetimePackage)}
              style={[styles.actionButton, { backgroundColor: '#FF9500' }]}
              disabled={isLoading}
            >
              <ThemedText size="xs" style={{ color: '#fff' }}>
                {isLoading ? 'Processing...' : '💳 Test Purchase (Lifetime)'}
              </ThemedText>
            </HapticTab>
          )}
        </View>
      </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
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
