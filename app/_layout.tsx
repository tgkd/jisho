import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { setAudioModeAsync } from "expo-audio";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
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

const dbname = "db_20250927_130743.db"
const DATABASE_PATH = "../assets/db/" + dbname;

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
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <AppleAIProvider>
          <UnifiedAIProvider>
            <GestureHandlerRootView style={styles.container}>
              <Suspense fallback={<Loader />}>
                <SQLiteProvider
                  databaseName={dbname}
                  assetSource={{
                    assetId: require(DATABASE_PATH),
                  }}
                  onInit={migrateDbIfNeeded}
                  useSuspense
                >
                  <KeyboardProvider>
                    <NativeTabs minimizeBehavior="automatic">
                      <NativeTabs.Trigger name="word" role="search">
                        <Icon
                          sf="magnifyingglass"
                          drawable="custom_android_drawable"
                        />
                        <Label>Search</Label>
                      </NativeTabs.Trigger>

                      <NativeTabs.Trigger name="history">
                        <Icon sf="clock" drawable="custom_android_drawable" />
                        <Label>History</Label>
                      </NativeTabs.Trigger>

                      <NativeTabs.Trigger name="settings">
                        <Icon sf="gear" drawable="custom_android_drawable" />
                        <Label>Settings</Label>
                      </NativeTabs.Trigger>
                    </NativeTabs>
                  </KeyboardProvider>

                  <StatusBar style="auto" />
                </SQLiteProvider>
              </Suspense>
            </GestureHandlerRootView>
          </UnifiedAIProvider>
        </AppleAIProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
