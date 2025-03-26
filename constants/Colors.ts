/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = "#007AFF"; // iOS blue
const tintColorDark = "#0A84FF"; // iOS blue dark mode
const errorRedLight = "#FF3B30"; // iOS red
const errorRedDark = "#FF453A"; // iOS red dark mode

export const Colors = {
  light: {
    text: "#000000",
    textSecondary: "#3C3C43",
    background: "#F2F2F7", // Changed to iOS standard gray background
    tint: tintColorLight,
    icon: "#3C3C43",
    tabIconDefault: "rgba(60, 60, 67, 0.6)",
    tabIconSelected: tintColorLight,
    secondaryBackground: "#FFFFFF", // Changed to white for cards/inputs
    secondaryText: "#6C6C70",
    separator: "gray",
    groupedBackground: "#FFFFFF", // Changed to white for grouped content
    accent: tintColorLight,
    accentLight: "rgba(0, 122, 255, 0.15)", // iOS light gray
    link: tintColorLight,
    accentForeground: "#FFFFFF",
    error: errorRedLight,
    highlight: "rgba(255, 215, 0, 1)",
    disabled: "#C7C7CC",
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
    separator: "gray",
    groupedBackground: "#1C1C1E",
    accent: tintColorDark,
    link: tintColorDark,
    accentForeground: "#FFFFFF",
    accentLight: "rgba(10, 132, 255, 0.15)", // iOS dark gray
    error: errorRedDark,
    highlight: "rgb(212, 181, 1)",
    disabled: "#38383A",
  },
};

export function getHighlightColorValue(color: string): string {
  switch(color) {
    case "yellow":
      return "rgba(255, 230, 0, 0.3)";
    case "blue":
      return "rgba(0, 122, 255, 0.3)";
    case "green":
      return "rgba(52, 199, 89, 0.3)";
    case "pink":
      return "rgba(255, 45, 85, 0.3)";
    default:
      return "rgba(255, 230, 0, 0.3)";
  }
}
