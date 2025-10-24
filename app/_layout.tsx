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
import { DATABASE_ASSET_ID, DATABASE_NAME } from "@/constants/Database";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useSubscription } from "@/providers/SubscriptionContext";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { migrateDbIfNeeded } from "@/services/database";
import { queryClient } from "@/services/queryClient";

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
        <SubscriptionProvider>
          <AppleAIProvider>
            <UnifiedAIProvider>
              <GestureHandlerRootView style={styles.container}>
                <Suspense fallback={<Loader />}>
                  <SQLiteProvider
                    databaseName={DATABASE_NAME}
                    assetSource={{
                      assetId: DATABASE_ASSET_ID,
                    }}
                    onInit={migrateDbIfNeeded}
                    useSuspense
                  >
                    <KeyboardProvider>
                      <Router />
                    </KeyboardProvider>

                    <StatusBar style="auto" />
                  </SQLiteProvider>
                </Suspense>
              </GestureHandlerRootView>
            </UnifiedAIProvider>
          </AppleAIProvider>
        </SubscriptionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function Router() {
  const sub = useSubscription();
  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="word" role="search">
        <Icon sf="magnifyingglass" drawable="custom_android_drawable" />
        <Label>Search</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <Icon sf="clock" drawable="custom_android_drawable" />
        <Label>History</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="practice" hidden={!sub.isPremium}>
        <Icon sf="book" drawable="custom_android_drawable" />
        <Label>Read</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon sf="gear" drawable="custom_android_drawable" />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
