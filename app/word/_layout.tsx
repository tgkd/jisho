import { HapticButton } from "@/components/HapticTab";
import { Stack, useRouter } from "expo-router";
import * as React from "react";
import { useColorScheme } from "react-native";

export default function WordLayout() {
  const theme = useColorScheme();
  const router = useRouter();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerLargeTitle: true,
          headerTransparent: true,
          headerTintColor: theme === "dark" ? "white" : "black",
          headerLargeStyle: {
            backgroundColor: "transparent",
          },
          headerLeft: () => (
            <HapticButton
              color="black"
              systemImage={"message"}
              onPress={() => router.push({ pathname: "/word/chat" })}
            />
          ),
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Details",
          headerTransparent: true,
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="kanji/[id]"
        options={{
          title: "Kanji",
          presentation: "modal",
          headerTransparent: true,
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="chat"
        options={{
          title: "Chat",
          presentation: "modal",
          headerTransparent: true,
          headerLargeTitle: true,
        }}
      />
    </Stack>
  );
}
