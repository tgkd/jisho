import { Button, Button as ButtonPrimitive, Host } from "@expo/ui/swift-ui";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import { useMemo } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === "ios") {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}

export function HapticButton(
  props: React.ComponentProps<typeof ButtonPrimitive> & {
    style?: StyleProp<ViewStyle>;
    size?: "xs" | "sm" | "md" | "lg" | "xl";
  }
) {
  const { style, size, ...restProps } = props;

  const { inner, outer } = useMemo(() => {
    switch (size) {
      case "xs":
        return { inner: 25, outer: 35 };
      case "sm":
        return { inner: 30, outer: 40 };
      case "md":
        return { inner: 35, outer: 50 };
      case "lg":
        return { inner: 40, outer: 60 };
      case "xl":
        return { inner: 45, outer: 70 };
      default:
        return { inner: 35, outer: 50 };
    }
  }, [size]);

  return (
    <Host style={{ width: outer, height: outer }}>
      <View>
        <Host style={{ width: inner, height: inner }}>
          <Button {...restProps} />
        </Host>
      </View>
    </Host>
  );
}

export const HIT_SLOP = {
  top: 16,
  right: 16,
  bottom: 16,
  left: 24,
};
