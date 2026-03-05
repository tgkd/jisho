import { Stack } from "expo-router";
import * as React from "react";

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index">
        <Stack.Screen.Title large>Settings</Stack.Screen.Title>
        <Stack.Header transparent />
      </Stack.Screen>

      <Stack.Screen name="about" options={{ presentation: "modal" }}>
        <Stack.Screen.Title large>About</Stack.Screen.Title>
        <Stack.Header transparent />
      </Stack.Screen>

      <Stack.Screen name="subscription-info" options={{ presentation: "modal" }}>
        <Stack.Screen.Title large>Premium Features</Stack.Screen.Title>
        <Stack.Header transparent />
      </Stack.Screen>
    </Stack>
  );
}
