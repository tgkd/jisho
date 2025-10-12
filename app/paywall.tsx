import { useSubscription } from "@/providers/SubscriptionContext";
import { Stack, useRouter } from "expo-router";
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
    router.back();
  };

  /**
   * Handle successful purchase restoration.
   * Refreshes subscription state and navigates back to previous screen.
   */
  const handleRestoreCompleted = async () => {
    console.log("Restore completed");
    await refreshSubscription();
    router.back();
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
      />
    </>
  );
}

export default Paywall;
