import { Stack } from "expo-router";
import * as React from "react";

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Settings",
          headerLargeTitle: true,
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="about"
        options={{
          title: "About",
          presentation: "modal",
          headerTransparent: true,
          headerLargeTitle: true,
        }}
      />

    </Stack>
  );
}
