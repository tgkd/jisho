import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Suspense, useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";

import { Loader } from "@/components/Loader";
import { PopupMenu } from "@/components/PopupMenu";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { migrateDbIfNeeded } from "@/services/database";

const DATABASE_PATH = "../assets/db/dict_2.db";

SplashScreen.preventAutoHideAsync();

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

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
          databaseName="jisho_2.db"
          assetSource={{ assetId: require(DATABASE_PATH) }}
          onInit={migrateDbIfNeeded}
          useSuspense
        >
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <KeyboardProvider>
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
                <Stack.Screen
                  name="bookmarks"
                  options={{ headerTitle: "しおり" }}
                />
                <Stack.Screen
                  name="explore"
                  options={{ headerTitle: "質問" }}
                />
              </Stack>
            </KeyboardProvider>

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

  const navigateToExplore = () => {
    router.push("/explore");
  };

  return (
    <PopupMenu
      buttonView={
        <IconSymbol
          color={Colors.light.tint}
          name="ellipsis.circle"
          size={32}
        />
      }
      items={[
        {
          label: "しおり",
          onPress: navigateToBookmarks,
          icon: "bookmark",
        },
        {
          label: "質問",
          onPress: navigateToExplore,
          icon: "sparkles",
        },
      ]}
    />
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
