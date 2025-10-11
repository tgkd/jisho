import { Stack } from "expo-router";
import * as React from "react";

export default function PracticeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Practice",
          headerLargeTitle: true,
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          title: "New Session",
          headerTransparent: true,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="chat/[sessionId]"
        options={{
          headerBackTitle: " ",
          title: "Practice Session",
          headerTransparent: true,
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
