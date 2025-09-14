import { Button as ButtonPrimitive, Host } from "@expo/ui/swift-ui";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import { StyleProp, ViewStyle } from "react-native";

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
  }
) {
  const { style, ...restProps } = props;

  return (
    <Host matchContents>
      <ButtonPrimitive {...restProps}>{props.children}</ButtonPrimitive>
    </Host>
  );
}

export const HIT_SLOP = {
  top: 16,
  right: 16,
  bottom: 16,
  left: 24,
};
