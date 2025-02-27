import "react-native-reanimated";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Suspense, useEffect } from "react";
import { StyleSheet } from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { Loader } from "@/components/Loader";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { migrateDbIfNeeded } from "@/services/database";
import { GestureHandlerRootView } from "react-native-gesture-handler";

const DATABASE_PATH = "../assets/db/dict.db";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <Suspense fallback={<Loader />}>
        <SQLiteProvider
          databaseName="jisho.db"
          assetSource={{ assetId: require(DATABASE_PATH) }}
          onInit={migrateDbIfNeeded}
          useSuspense
        >
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <Stack>
              <Stack.Screen
                name="index"
                options={() => ({
                  headerTitle: "Search",
                  headerTitleStyle: styles.headerTitle,
                  headerBackTitleStyle: styles.headerBackTitle,
                  headerRight: () => <BookmarksButton />,
                })}
              />
              <Stack.Screen name="bookmarks" />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </SQLiteProvider>
      </Suspense>
    </GestureHandlerRootView>
  );
}

function BookmarksButton() {
  const router = useRouter();

  const navigateToBookmarks = () => {
    router.push("/bookmarks");
  };

  return (
    <HapticTab onPress={navigateToBookmarks}>
      <IconSymbol
        color={Colors.light.tint}
        name="bookmark.circle.fill"
        size={32}
      />
    </HapticTab>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
