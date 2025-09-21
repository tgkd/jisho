import { Stack } from "expo-router";
import * as React from "react";

export default function HistoryLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "History",
          headerLargeTitle: true,
          headerTransparent: true,
        }}
      />
    </Stack>
  );
}
