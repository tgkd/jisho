import * as Haptics from "expo-haptics";
import { Pressable, PressableProps } from "react-native";

export function HapticTab({ style, onPressIn, ...props }: PressableProps) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
      style={(state) => [
        { opacity: state.pressed ? 0.7 : 1 },
        typeof style === "function" ? style(state) : style,
      ]}
    />
  );
}

export function getBtnSize(size?: "xs" | "sm" | "md" | "lg" | "xl") {
  switch (size) {
    case "xs":
      return {
        inner: { width: 25, height: 25 },
        outer: { width: 35, height: 35 },
      };
    case "sm":
      return {
        inner: { width: 30, height: 30 },
        outer: { width: 40, height: 40 },
      };
    case "md":
      return {
        inner: { width: 35, height: 35 },
        outer: { width: 50, height: 50 },
      };
    case "lg":
      return {
        inner: { width: 40, height: 40 },
        outer: { width: 60, height: 60 },
      };
    case "xl":
      return {
        inner: { width: 45, height: 45 },
        outer: { width: 70, height: 70 },
      };
    default:
      return {
        inner: { width: 35, height: 35 },
        outer: { width: 50, height: 50 },
      };
  }
}

export const HIT_SLOP = {
  top: 16,
  right: 16,
  bottom: 16,
  left: 24,
};
