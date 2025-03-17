import React, { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, View, Text } from "react-native";
import ContextMenu, {
  ContextMenuAction,
  ContextMenuOnPressNativeEvent,
} from "react-native-context-menu-view";
import { NativeSyntheticEvent } from "react-native";

import { cleanupMdStr } from "@/services/parse";
import { useThemeColor } from "@/hooks/useThemeColor";

interface Props {
  text?: string;
  actions?: ContextMenuAction[];
  onPress?: (e: NativeSyntheticEvent<ContextMenuOnPressNativeEvent>) => void;
  onPreviewPress?: () => void;
  onCancel?: () => void;
  previewBackgroundColor?: string;
  previewComponent?: ReactNode;
  borderRadius?: number;
}

/**
 * MenuPreview - Wrapper for context menu with preview functionality
 * Provides both default text preview and custom preview component options
 */
export function MenuPreview({
  children,
  text,
  actions = [],
  onPress,
  onPreviewPress,
  onCancel,
  previewBackgroundColor,
  previewComponent,
}: PropsWithChildren<Props>) {
  const backgroundColor = useThemeColor({}, "secondaryBackground");
  const textColor = useThemeColor({}, "text");

  const defaultPreview = text ? (
    <View
      style={[
        styles.previewContainer,
        {
          backgroundColor: previewBackgroundColor || backgroundColor,
        },
      ]}
    >
      <Text style={[styles.previewText, { color: textColor }]}>
        {cleanupMdStr(text)}
      </Text>
    </View>
  ) : null;

  const preview = previewComponent || defaultPreview;

  return (
    <ContextMenu
      actions={actions}
      onPreviewPress={onPreviewPress}
      onCancel={onCancel}
    >
      {children}
    </ContextMenu>
  );
}

const styles = StyleSheet.create({
  previewContainer: {
    padding: 16,
    width: "100%",
    maxWidth: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  previewText: {
    fontSize: 16,
    textAlign: "center",
  },
});
