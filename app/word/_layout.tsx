import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Color, Stack, useRouter } from "expo-router";
import * as React from "react";

import { useUnifiedAI } from "@/providers/UnifiedAIProvider";

export default function WordLayout() {
  const router = useRouter();
  const ai = useUnifiedAI();

  return (
    <Stack>
      <Stack.Screen name="index">
        <Stack.Header transparent />
        {ai.isAvailable ? (
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              icon="message"
              tintColor={Color.ios.label}
              onPress={() => router.navigate("/word/chat")}
            />
          </Stack.Toolbar>
        ) : null}
      </Stack.Screen>

      <Stack.Screen name="[id]" options={{ presentation: "modal" }}>
        <Stack.Screen.Title>Details</Stack.Screen.Title>
        <Stack.Header transparent />
      </Stack.Screen>

      <Stack.Screen name="kanji/[id]" options={{ presentation: "modal" }}>
        <Stack.Screen.Title>Kanji</Stack.Screen.Title>
        <Stack.Header transparent />
      </Stack.Screen>

      <Stack.Screen name="chat" options={{ presentation: "modal" }}>
        <Stack.Screen.Title>Chat</Stack.Screen.Title>
        <Stack.Header transparent />
      </Stack.Screen>

      <Stack.Screen
        name="kanji-list"
        options={{
          presentation: isLiquidGlassAvailable() ? "formSheet" : "modal",
        }}
      >
        <Stack.Screen.Title>Kanji Details</Stack.Screen.Title>
        <Stack.Header transparent />
      </Stack.Screen>
    </Stack>
  );
}
