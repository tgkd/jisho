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
  View,
} from "react-native";

export default function SubscriptionScreen() {
  const subscription = useSubscription();
  const { isPremium, packages, isLoading, purchase, restore } = subscription;

  const [showTestInfo, setShowTestInfo] = React.useState(false);

  const monthlyPackage = packages.find(
    (pkg) =>
      pkg.product.identifier.includes("Monthly") ||
      pkg.packageType === "MONTHLY"
  );
  const lifetimePackage = packages.find(
    (pkg) =>
      pkg.product.identifier.includes("Lifetime") ||
      pkg.packageType === "LIFETIME"
  );

  const handlePurchase = async (pkg: (typeof packages)[0]) => {
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
      Alert.alert(
        "No Purchases Found",
        "No previous purchases found to restore."
      );
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
            <IconSymbol
              name="checkmark.circle.fill"
              size={48}
              color={Colors.light.accent}
            />
            <ThemedText size="lg" style={styles.statusTitle}>
              Premium Active
            </ThemedText>
            <ThemedText
              size="sm"
              type="secondary"
              style={styles.statusDescription}
            >
              You have unlimited access to all premium features
            </ThemedText>
          </View>
        </Card>
      );
    }

    return (
      <Card>
        <View style={styles.statusContainer}>
          <IconSymbol
            name="star.circle"
            size={48}
            color={Colors.light.textSecondary}
          />
          <ThemedText size="lg" style={styles.statusTitle}>
            Free Plan
          </ThemedText>
          <ThemedText
            size="sm"
            type="secondary"
            style={styles.statusDescription}
          >
            Unlimited AI queries included
          </ThemedText>
        </View>
      </Card>
    );
  };

  const renderActions = () => {
    if (isPremium) {
      return (
        <Card>
          <HapticTab
            onPress={handleManageSubscription}
            style={styles.actionButton}
          >
            <IconSymbol name="gear" size={20} color={Colors.light.accent} />
            <ThemedText size="sm">Manage Subscription</ThemedText>
          </HapticTab>
          <HapticTab onPress={handleRestore} style={styles.actionButton}>
            <IconSymbol
              name="arrow.clockwise"
              size={20}
              color={Colors.light.accent}
            />
            <ThemedText size="sm">Restore Purchases</ThemedText>
          </HapticTab>
        </Card>
      );
    }

    return (
      <Card>
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
                  Monthly Subscription - {monthlyPackage.product.priceString}
                  /month
                </ThemedText>
              </>
            )}
          </HapticTab>
        )}

        {!monthlyPackage && !lifetimePackage && (
          <ThemedText
            size="sm"
            type="secondary"
            textAlign="center"
            style={{ paddingVertical: 16 }}
          >
            Loading subscription options...
          </ThemedText>
        )}

        <HapticTab onPress={handleRestore} style={styles.actionButton}>
          <IconSymbol
            name="arrow.clockwise"
            size={20}
            color={Colors.light.accent}
          />
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
      {renderActions()}

      <ThemedText size="xs" type="secondary" style={styles.disclaimer}>
        Subscription automatically renews unless auto-renew is turned off at
        least 24 hours before the end of the current period. Manage your
        subscription in App Store settings.
      </ThemedText>

      <HapticTab
        onPress={() => setShowTestInfo(!showTestInfo)}
        style={styles.actionButton}
      >
        <ThemedText size="xs" type="secondary">
          {"Show Test Info"}
        </ThemedText>
      </HapticTab>

      {showTestInfo && (
        <Card>
          <View style={{ gap: 8 }}>
            <ThemedText size="xs" type="secondary">
              Packages loaded: {packages.length}
            </ThemedText>

            {packages.map((pkg, idx) => (
              <View
                key={idx}
                style={{
                  paddingLeft: 8,
                  paddingVertical: 4,
                  backgroundColor: "#fff",
                  borderRadius: 4,
                }}
              >
                <ThemedText size="xs" style={{ fontWeight: "600" }}>
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
            {monthlyPackage && (
              <HapticTab
                onPress={() => handlePurchase(monthlyPackage)}
                style={[styles.actionButton, { backgroundColor: "#34C759" }]}
                disabled={isLoading}
              >
                <ThemedText size="xs" style={{ color: "#fff" }}>
                  {isLoading ? "Processing..." : "Subscribe (Monthly)"}
                </ThemedText>
              </HapticTab>
            )}

            {lifetimePackage && (
              <HapticTab
                onPress={() => handlePurchase(lifetimePackage)}
                style={[styles.actionButton, { backgroundColor: "#FF9500" }]}
                disabled={isLoading}
              >
                <ThemedText size="xs" style={{ color: "#fff" }}>
                  {isLoading ? "Processing..." : " Purchase (Lifetime)"}
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
