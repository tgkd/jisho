import { Stack } from "expo-router";
import RevenueCatUI from "react-native-purchases-ui";

function Paywall() {
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
      />
    </>
  );
}

export default Paywall;
