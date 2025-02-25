import { Stack } from "expo-router";
import { StyleSheet } from "react-native";

export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerBlurEffect: "regular",
          headerTitle: "Search",
          headerTitleStyle: styles.headerTitle,
          headerBackTitleStyle: styles.headerBackTitle,
        }}
      />
      <Stack.Screen
        name="explore"
        options={{
          headerBlurEffect: "regular",
          headerTitle: "Explore",
          headerTitleStyle: styles.headerTitle,
          headerBackTitleStyle: styles.headerBackTitle,
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 0,
    shadowColor: "transparent",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  headerBackTitle: {
    fontSize: 17,
  },
});
