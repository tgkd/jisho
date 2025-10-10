import { useThemeColor } from "@/hooks/useThemeColor";
import { Button, Button as ButtonPrimitive, Host } from "@expo/ui/swift-ui";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
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

export function HapticButton(
  props: React.ComponentProps<typeof ButtonPrimitive> & {
    style?: StyleProp<ViewStyle>;
    size?: "xs" | "sm" | "md" | "lg" | "xl";
  }
) {
  const { style, size, color, ...restProps } = props;
  const defaultColor = useThemeColor({}, "text");
  const { inner, outer } = getBtnSize(size);

  return (
    <Host style={{ ...outer }}>
      <View>
        <Host style={{ ...inner }}>
          <Button color={color || defaultColor} {...restProps} />
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
