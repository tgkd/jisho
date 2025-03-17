import { useTheme } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import React, { useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useThemeColor } from "@/hooks/useThemeColor";
import { HIT_SLOP } from "./HapticTab";
import { ThemedText } from "./ThemedText";
import { IconSymbol, IconSymbolName } from "./ui/IconSymbol";
import { Colors } from "@/constants/Colors";

export interface Props {
  items: Array<{
    label: string;
    onPress: () => void;
    icon: IconSymbolName;
  }>;
  buttonView: React.ReactNode;
}

interface Coords {
  y: number;
  width: number;
}

const ANIMATION_DURATION = 200;

function PopupMenuImpl({ items, buttonView }: Props) {
  const theme = useTheme();
  const iconColor = useThemeColor({}, "text");
  const wrapperRef = useRef<View>(null);
  const animatedValue = useSharedValue(0);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords>({
    y: 0,
    width: 0,
  });

  const openModal = () => {
    setOpen(true);
    animatedValue.value = withTiming(1, { duration: ANIMATION_DURATION });
  };

  const hideModal = () => {
    animatedValue.value = withTiming(0, { duration: ANIMATION_DURATION });
    setOpen(false);
  };

  const onInnerContainerLayout = ({
    nativeEvent: {
      layout: { height: popupHeight, width: popupWidth },
    },
  }: LayoutChangeEvent) => {
    if (
      !wrapperRef.current ||
      !wrapperRef.current.measure ||
      !popupWidth ||
      !popupHeight
    ) {
      return;
    }

    wrapperRef.current.measure((x, y, width) => {
      setCoords({ y: y + popupHeight, width });
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedValue.value, [0, 1], [0, 1]),
    transform: [
      { scale: interpolate(animatedValue.value, [0, 1], [0.95, 1]) },
      { translateY: interpolate(animatedValue.value, [0, 1], [-8, 0]) },
    ],
    top: coords.y,
    right: coords.width,
  }));

  return (
    <TouchableOpacity
      ref={wrapperRef}
      onPress={openModal}
      activeOpacity={1}
      hitSlop={HIT_SLOP}
    >
      {buttonView}
      <Modal visible={open} transparent onRequestClose={hideModal}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={hideModal}
          style={styles.blurContainer}
        />
        <Animated.View style={[styles.container, animatedStyle]}>
          <View onLayout={onInnerContainerLayout} style={styles.innerContainer}>
            <BlurView
              style={styles.blurView}
              tint={theme.dark ? "dark" : "extraLight"}
              intensity={100}
            />
            {items.map((item, index) => (
              <React.Fragment key={index}>
                <TouchableOpacity
                  onPress={() => {
                    item.onPress();
                    hideModal();
                  }}
                  style={styles.row}
                >
                  <ThemedText>{item.label}</ThemedText>
                  <IconSymbol color={iconColor} name={item.icon} size={20} />
                </TouchableOpacity>
                {index < items.length - 1 ? (
                  <View style={styles.divider} />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </Animated.View>
      </Modal>
    </TouchableOpacity>
  );
}

export const PopupMenu = React.memo(PopupMenuImpl);

const styles = StyleSheet.create({
  innerContainer: {
    alignItems: "flex-start",
    overflow: "hidden",
    borderRadius: 14,
    minWidth: 180,
    maxWidth: 180,
  },
  container: {
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  blurContainer: {
    flexGrow: 1,
    ...StyleSheet.absoluteFillObject,
  },
  blurView: {
    ...StyleSheet.absoluteFillObject,
  },
  row: {
    padding: 12,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  divider: {
    width: "100%",
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
  },
});
