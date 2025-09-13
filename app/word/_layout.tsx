import { Button, ContextMenu, Host, Image } from "@expo/ui/swift-ui";
import { Stack, useRouter } from "expo-router";
import * as React from "react";
import { useColorScheme, View } from "react-native";

export default function WordLayout() {
  const theme = useColorScheme();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Search",
          headerLargeTitle: true,
          headerTransparent: true,
          headerTintColor: theme === "dark" ? "white" : "black",
          headerLargeStyle: {
            backgroundColor: "transparent",
          },
          headerLeft: () => <PageContextMenu />,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Details",
          headerTintColor: theme === "dark" ? "white" : "black",
          headerTransparent: true,
          headerStyle: {
            backgroundColor: "transparent",
          },
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: "Settings",
          headerTintColor: theme === "dark" ? "white" : "black",
          headerTransparent: true,
          headerStyle: {
            backgroundColor: "transparent",
          },
        }}
      />
      <Stack.Screen
        name="bookmarks"
        options={{
          title: "Bookmarks",
          headerTintColor: theme === "dark" ? "white" : "black",
          headerTransparent: true,
          headerStyle: {
            backgroundColor: "transparent",
          },
        }}
      />
    </Stack>
  );
}

function PageContextMenu() {
  const router = useRouter();

  return (
    <Host style={{ width: 150, height: 50 }}>
      <ContextMenu>
        <ContextMenu.Items>
          <Button
            systemImage={"gear"}
            onPress={() => {
              router.push("/word/settings");
            }}
          >
            Settings
          </Button>
          <Button
            systemImage={"bookmark"}
            onPress={() => {
              router.push("/word/bookmarks");
            }}
          >
            Bookmarks
          </Button>
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          <View>
            <Host style={{ width: 35, height: 35 }}>
              <Image systemName="ellipsis" />
            </Host>
          </View>
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}
