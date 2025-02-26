import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { Stack, useRouter } from "expo-router";
import { StyleSheet } from "react-native";

export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={({ route }) => ({
          headerBlurEffect: "regular",
          headerTitle: "Search",
          headerTitleStyle: styles.headerTitle,
          headerBackTitleStyle: styles.headerBackTitle,
          headerRight: () => <BookmarksButton />,
        })}
      />
      <Stack.Screen
        name="bookmarks"
        options={{
          headerBlurEffect: "regular",
          headerTitle: "Bookmarks",
          headerTitleStyle: styles.headerTitle,
          headerBackTitleStyle: styles.headerBackTitle,
        }}
      />
    </Stack>
  );
}

function BookmarksButton() {
  const router = useRouter();

  const navigateToBookmarks = () => {
    router.push("/bookmarks");
  };

  return (
    <HapticTab onPress={navigateToBookmarks}>
      <IconSymbol color={Colors.light.tint} name="bookmark" size={24} />
    </HapticTab>
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
