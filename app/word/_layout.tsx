import { Stack } from "expo-router";
import * as React from "react";
import { useColorScheme } from "react-native";

export default function WordLayout() {
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
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          headerTransparent: true,
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="kanji/[id]"
        options={{
          headerTransparent: true,
          headerBackTitle: "",
        }}
      />
    </Stack>
  );
}

