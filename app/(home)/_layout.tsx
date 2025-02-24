import { Stack } from "expo-router";

export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerTitle: "Search",
        }}
      />
      <Stack.Screen
        name="explore"
        options={{
          headerTitle: "Explore",
        }}
      />
    </Stack>
  );
}
