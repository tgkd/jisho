import { useSubscription } from "@/providers/SubscriptionContext";
import { Stack, useRouter } from "expo-router";
import { Alert } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";

/**
 * Paywall modal screen for displaying subscription purchase UI.
 * Handles purchase completion, restoration, and navigation back after successful actions.
 */
function Paywall() {
  const router = useRouter();
  const { refreshSubscription } = useSubscription();

  /**
   * Handle successful purchase completion.
   * Refreshes subscription state and navigates back to previous screen.
   */
  const handlePurchaseCompleted = async () => {
    console.log("Purchase completed");
    await refreshSubscription();
    Alert.alert(
      "Purchase Successful",
      "Thank you for subscribing! You now have access to all premium features.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  /**
   * Handle successful purchase restoration.
   * Refreshes subscription state and navigates back to previous screen.
   */
  const handleRestoreCompleted = async () => {
    console.log("Restore completed");
    await refreshSubscription();
    Alert.alert(
      "Restore Successful",
      "Your subscription has been restored successfully.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  /**
   * Handle failed purchase restoration.
   * Shows error message to user when no active subscription is found.
   */
  const handleRestoreFailed = ({ error }: { error: { message: string } }) => {
    console.log("Restore failed:", error);
    Alert.alert(
      "Restore Failed",
      "No active subscription found. Please make sure you're signed in with the same Apple ID used for the original purchase.",
      [{ text: "OK" }]
    );
  };

  return (
    <>
      <Stack.Screen
        name="paywall"
        options={{
          presentation: "modal",
        }}
      />
      <RevenueCatUI.Paywall
        options={{
          displayCloseButton: false,
        }}
        onDismiss={() => {
          console.log("Paywall dismissed");
        }}
        onPurchaseCompleted={handlePurchaseCompleted}
        onRestoreCompleted={handleRestoreCompleted}
        onRestoreError={handleRestoreFailed}
      />
    </>
  );
}

export default Paywall;
