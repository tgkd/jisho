import {
  Button,
  ContextMenu,
  Host
} from "@expo/ui/swift-ui";
import * as Clipboard from "expo-clipboard";
import { PropsWithChildren } from "react";

import { cleanupMdStr } from "@/services/parse";

interface Props {
  text?: string;
  actions?: { title: string; onActivate?: () => void }[];
}

export function MenuActions({
  children,
  text,
  actions = [],
}: PropsWithChildren<Props>) {
  const handleCopy = async () => {
    if (text) {
      await Clipboard.setStringAsync(cleanupMdStr(text));
    }
  };

  return (
    <Host>
      <ContextMenu>
        <ContextMenu.Items>
          <Button
            systemImage="document.on.clipboard"
            onPress={handleCopy}
          >
            Copy
          </Button>
          {actions.map((action, index) => (
            <Button
              key={index}
              onPress={action.onActivate}
            >
              {action.title}
            </Button>
          ))}
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          {children}
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}