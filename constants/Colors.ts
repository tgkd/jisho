/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = "#007AFF"; // iOS blue
const tintColorDark = "#0A84FF"; // iOS blue dark mode

export const Colors = {
  light: {
    text: "#000000",
    textSecondary: "#3C3C43",
    background: "#FFFFFF",
    tint: tintColorLight,
    icon: "#3C3C43",
    tabIconDefault: "rgba(60, 60, 67, 0.6)",
    tabIconSelected: tintColorLight,
    secondaryBackground: "#F2F2F7",
    secondaryText: "#6C6C70",
    separator: "rgba(60, 60, 67, 0.29)",
    groupedBackground: "#F2F2F7",
    accent: tintColorLight,
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#8E8E93",
    background: "#000000",
    tint: tintColorDark,
    icon: "#EBEBF5",
    tabIconDefault: "rgba(235, 235, 245, 0.6)",
    tabIconSelected: tintColorDark,
    secondaryBackground: "#1C1C1E",
    secondaryText: "#EBEBF5",
    separator: "rgba(84, 84, 88, 0.65)",
    groupedBackground: "#1C1C1E",
    accent: tintColorDark,
  },
};
