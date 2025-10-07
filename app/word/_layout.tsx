import { Stack, useRouter } from "expo-router";
import * as React from "react";

import { HapticButton } from "@/components/HapticTab";
import { useUnifiedAI } from "@/providers/UnifiedAIProvider";

export default function WordLayout() {
  const router = useRouter();
  const ai = useUnifiedAI();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerLargeTitle: true,
          headerTransparent: true,
          headerLeft: () =>
            ai.isAvailable ? (
              <HapticButton
                systemImage={"message"}
                onPress={() => router.push({ pathname: "/word/chat" })}
              />
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
    </Stack>
  );
}
