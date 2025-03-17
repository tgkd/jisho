import { NativeSyntheticEvent } from "react-native";
import ContextMenu, {
  ContextMenuAction,
  ContextMenuOnPressNativeEvent,
} from "react-native-context-menu-view";
import * as Clipboard from "expo-clipboard";
import { PropsWithChildren } from "react";

import { cleanupMdStr } from "@/services/parse";

const ACTIONS = [{ title: "Copy" }];

interface Props {
  text?: string;
  actions?: ContextMenuAction[];
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
    if (e.nativeEvent.name === ACTIONS[0].title) {
      handleCopy();
    }
  };

  return (
    <ContextMenu actions={ACTIONS} onPress={handleCtxMenu}>
      {children}
    </ContextMenu>
  );
}
