import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { setAudioModeAsync } from "expo-audio";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Suspense, useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { AppleAIProvider } from "../providers/AppleAIProvider";
import { UnifiedAIProvider } from "../providers/UnifiedAIProvider";
// Legacy support - will be removed after migration complete
// import { LocalAIProvider } from "../providers/LocalAIProvider";

import { Loader } from "@/components/Loader";
import { useColorScheme } from "@/hooks/useColorScheme";
import { migrateDbIfNeeded } from "@/services/database";
import { queryClient } from "@/services/queryClient";

const DATABASE_PATH = "../assets/db/dict_2.db";

SplashScreen.preventAutoHideAsync();

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

async function setupAudio() {
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
    });
  } catch (error) {
    console.error("Failed to set audio mode", error);
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync().then(setupAudio);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppleAIProvider>
        <UnifiedAIProvider>
          <GestureHandlerRootView style={styles.container}>
            <Suspense fallback={<Loader />}>
              <SQLiteProvider
                databaseName="dict_2.db"
                assetSource={{
                  assetId: require(DATABASE_PATH),
                }}
                onInit={migrateDbIfNeeded}
                useSuspense
              >
                <ThemeProvider
                  value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
                >
                  <KeyboardProvider>
                    <NativeTabs minimizeBehavior="onScrollDown" >
                      <NativeTabs.Trigger name="word">
                        <Icon
                          sf="magnifyingglass"
                          drawable="custom_android_drawable"
                        />
                        <Label>Search</Label>
                      </NativeTabs.Trigger>

                      <NativeTabs.Trigger name="kanji">
                        <Icon
                          sf="textformat.abc"
                          drawable="custom_android_drawable"
                        />
                        <Label>Kanji</Label>
                      </NativeTabs.Trigger>
                      <NativeTabs.Trigger hidden name="word/[id]" />
                      <NativeTabs.Trigger hidden name="kanji/[id]" />
                      <NativeTabs.Trigger hidden name="bookmarks" />
                      <NativeTabs.Trigger hidden name="explore" />
                      <NativeTabs.Trigger hidden name="settings" />
                    </NativeTabs>
                  </KeyboardProvider>

                  <StatusBar style="auto" />
                </ThemeProvider>
              </SQLiteProvider>
            </Suspense>
          </GestureHandlerRootView>
        </UnifiedAIProvider>
      </AppleAIProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
