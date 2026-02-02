import { Button, ContextMenu, Host } from "@expo/ui/swift-ui";
import React from "react";
import { IconSymbolName } from "./ui/IconSymbol";

export type PopupMenuItem = {
  label: string;
  onPress: () => void;
  icon: IconSymbolName;
};

export interface Props {
  items: PopupMenuItem[];
  buttonView: React.ReactNode;
}

function PopupMenuImpl({ items, buttonView }: Props) {
  return (
    <Host matchContents>
      <ContextMenu>
        <ContextMenu.Items>
          {items.map((item, index) => (
            <Button
              key={index}
              systemImage={item.icon}
              onPress={item.onPress}
              label={item.label}
            />
          ))}
        </ContextMenu.Items>
        <ContextMenu.Trigger>{buttonView}</ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}

export const PopupMenu = React.memo(PopupMenuImpl);
