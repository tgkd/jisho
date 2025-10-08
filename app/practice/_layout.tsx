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
        name="passages/[level]"
        options={{
          title: "Reading Passages",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="passage/[id]"
        options={{
          title: "Reading",
          headerTransparent: true,
          headerLargeTitle: false,
        }}
      />
    </Stack>
  );
}
