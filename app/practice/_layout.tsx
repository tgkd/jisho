import { Stack } from "expo-router";
import * as React from "react";

export default function PracticeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index">
        <Stack.Screen.Title large>Reading Practice</Stack.Screen.Title>
        <Stack.Header transparent />
      </Stack.Screen>

      <Stack.Screen name="new" options={{ presentation: "modal" }}>
        <Stack.Screen.Title>New Reading Passage</Stack.Screen.Title>
        <Stack.Header transparent />
      </Stack.Screen>

      <Stack.Screen name="[sessionId]" options={{ presentation: "modal" }}>
        <Stack.Screen.BackButton> </Stack.Screen.BackButton>
        <Stack.Screen.Title>Reading Passage</Stack.Screen.Title>
        <Stack.Header transparent />
      </Stack.Screen>
    </Stack>
  );
}
