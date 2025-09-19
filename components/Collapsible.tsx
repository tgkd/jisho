import { PropsWithChildren, useState } from "react";
import { LayoutChangeEvent, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";

import { ThemedText, ThemedTextProps } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useThemeColor } from "@/hooks/useThemeColor";

interface Props {
  title: string;
  rightButton?: React.ReactNode;
  p?: number;
  withIcon?: boolean;
  titleProps?: ThemedTextProps;
  initOpened?: boolean;
}

export function Collapsible({
  children,
  title,
  rightButton = null,
  p = 12,
  withIcon = true,
  initOpened = false,
  titleProps = {
    numberOfLines: 1,
    ellipsizeMode: "tail",
  },
}: PropsWithChildren<Props>) {
  const opened = useSharedValue(initOpened ? 1 : 0);
  const contentHeight = useSharedValue(0);
  const [measured, setMeasured] = useState(false);
  const theme = useColorScheme() ?? "light";
  const bg = useThemeColor({}, "secondaryBackground");

  const onPress = () => {
    opened.value = withTiming(opened.value === 0 ? 1 : 0);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    if (!measured) {
      contentHeight.value = event.nativeEvent.layout.height;
      setMeasured(true);
    }
  };

  const contentStyle = useAnimatedStyle(() => {
    return {
      height: opened.value * contentHeight.value,
      opacity: opened.value,
      overflow: 'hidden' as const,
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${opened.value * 90}deg` }],
    };
  });

  return (
    <View>
      <TouchableOpacity
        style={[styles.heading, { backgroundColor: bg, padding: p }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.headName}>
          {withIcon ? (
            <Animated.View style={iconStyle}>
              <IconSymbol
                name="chevron.right"
                size={16}
                weight="medium"
                color={theme === "light" ? Colors.light.icon : Colors.dark.icon}
              />
            </Animated.View>
          ) : null}

          <ThemedText
            size="sm"
            style={withIcon ? undefined : styles.underline}
            {...titleProps}
          >
            {title}
          </ThemedText>
        </View>
        {rightButton}
      </TouchableOpacity>
      <Animated.View style={contentStyle}>
        <ThemedView
          style={[styles.content, { backgroundColor: bg }]}
          onLayout={onLayout}
        >
          {children}
        </ThemedView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
  },
  headName: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "85%",
  },
  content: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
  },
  underline: {
    textDecorationLine: "underline",
  },
});
