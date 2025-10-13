import { useSubscription } from "@/providers/SubscriptionContext";
import { Stack, useRouter } from "expo-router";
import { Alert } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";

function Paywall() {
  const router = useRouter();
  const { refreshSubscription } = useSubscription();

  const handlePurchaseCompleted = async () => {
    await refreshSubscription();
    Alert.alert(
      "Purchase Successful",
      "Thank you for subscribing! You now have access to all premium features.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  const handleRestoreCompleted = async () => {
    await refreshSubscription();
    Alert.alert(
      "Restore Successful",
      "Your subscription has been restored successfully.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  const handleRestoreFailed = ({ error }: { error: { message: string } }) => {
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
