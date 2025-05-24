import { NativeSyntheticEvent } from "react-native";
import ContextMenu, {
  ContextMenuAction,
  ContextMenuOnPressNativeEvent,
} from "react-native-context-menu-view";
import * as Clipboard from "expo-clipboard";
import { PropsWithChildren } from "react";

import { cleanupMdStr } from "@/services/parse";

const ACTIONS: ContextMenuAction[] = [
  { title: "Copy", systemIcon: "document.on.clipboard" },
];

interface Props {
  text?: string;
  actions?: Array<ContextMenuAction & { onActivate?: () => void }>;
}

export function MenuActions({
  children,
  text,
  actions = ACTIONS,
}: PropsWithChildren<Props>) {
  const handleCopy = async () => {
    if (text) {
      await Clipboard.setStringAsync(cleanupMdStr(text));
    }
  };

  const handleCtxMenu = (
    e: NativeSyntheticEvent<ContextMenuOnPressNativeEvent>
  ) => {
    switch (e.nativeEvent.name?.toLowerCase()) {
      case "copy":
        handleCopy();
        break;
      default:
        const action = actions.find(
          (action) => action.title === e.nativeEvent.name
        );
        if (action?.onActivate) {
          action.onActivate();
        }
        break;
    }
  };

  return (
    <ContextMenu actions={actions} onPress={handleCtxMenu}>
      {children}
    </ContextMenu>
  );
}
