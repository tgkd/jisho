import {
  Button,
  ContextMenu,
  Host
} from "@expo/ui/swift-ui";
import React, { PropsWithChildren, ReactNode } from "react";


interface Props {
  text?: string;
  actions?: { title: string; onActivate?: () => void }[];
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
  onPreviewPress,
  onCancel,
  previewBackgroundColor,
  previewComponent,
}: PropsWithChildren<Props>) {


  return (
    <Host>
      <ContextMenu>
        {actions.map((action, index) => (
          <Button
            key={index}
            onPress={action.onActivate}
          >
            {action.title}
          </Button>
        ))}
        {children}
      </ContextMenu>
    </Host>
  );
}

