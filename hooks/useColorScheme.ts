import { useColorScheme as useRNColorScheme } from "react-native";

/**
 * Returns the active color scheme narrowed to "light" | "dark".
 *
 * React Native's ColorSchemeName is "light" | "dark" | "unspecified" | null,
 * none of which (besides the two we want) can safely index Colors[scheme].
 * Collapsing everything that isn't explicitly "dark" to "light" keeps every
 * consumer type-safe without a `?? "light"` dance at each call site.
 */
export function useColorScheme(): "light" | "dark" {
  return useRNColorScheme() === "dark" ? "dark" : "light";
}
