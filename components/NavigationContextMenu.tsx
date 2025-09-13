import {
  Button,
  ContextMenu,
  Host
} from "@expo/ui/swift-ui";
import { router } from "expo-router";
import * as React from "react";

interface NavigationContextMenuProps {
  children: React.ReactNode;
}

export function NavigationContextMenu({ children }: NavigationContextMenuProps) {
  const handleNavigation = (route: string) => {
    router.push(route as any);
  };

  return (
    <Host style={{ width: 32, height: 32 }}>
      <ContextMenu>
        <Button
          systemImage="gearshape.fill"
          onPress={() => handleNavigation("/settings")}
        >
          設定
        </Button>
        <Button
          systemImage="bookmark.fill"
          onPress={() => handleNavigation("/bookmarks")}
        >
          しおり
        </Button>
        <Button
          systemImage="bubble.left.and.text.bubble.right"
          onPress={() => handleNavigation("/explore")}
        >
          質問
        </Button>
        <Button
          systemImage="character.book.closed"
          onPress={() => handleNavigation("/kanji")}
        >
          漢字
        </Button>
        {children}
      </ContextMenu>
    </Host>
  );
}