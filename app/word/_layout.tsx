import { Button, Host } from "@expo/ui/swift-ui";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useRouter } from "expo-router";
import * as React from "react";
import { Platform } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";

export default function WordLayout() {
  const router = useRouter();
  const ai = useUnifiedAI();
  const defaultColor = useThemeColor({}, "text");

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerLargeTitle: true,
          headerTransparent: true,
          headerLeft: () =>
            ai.isAvailable ? (
              <Host style={{ width: 35, height: 35 }}>
                <Button
                  color={defaultColor}
                  systemImage="message"
                  onPress={() => router.navigate("/word/chat")}
                />
              </Host>
            ) : undefined,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Details",
          headerTransparent: true,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="kanji/[id]"
        options={{
          title: "Kanji",
          presentation: "modal",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="chat"
        options={{
          title: "Chat",
          presentation: "modal",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="kanji-list"
        options={{
          title: "Kanji Details",
          headerTransparent: true,
          presentation:
              isLiquidGlassAvailable()
                ? "formSheet"
                : "modal"
        }}
      />
    </Stack>
  );
}
