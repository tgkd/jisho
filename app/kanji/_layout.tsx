import { Stack } from "expo-router";
import * as React from "react";
import { useColorScheme } from "react-native";

export default function KanjiLayout() {
  const theme = useColorScheme();
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
          title: "Kanji",
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Details",
          headerTransparent: true,
          headerStyle: {
            backgroundColor: "transparent",
          },
        }}
      />
    </Stack>
  );
}
