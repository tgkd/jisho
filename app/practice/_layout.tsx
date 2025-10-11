import { Stack } from "expo-router";
import * as React from "react";

export default function PracticeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Reading Practice",
          headerLargeTitle: true,
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          title: "New Reading Passage",
          headerTransparent: true,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="[sessionId]"
        options={{
          headerBackTitle: " ",
          title: "Reading Passage",
          headerTransparent: true,
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
