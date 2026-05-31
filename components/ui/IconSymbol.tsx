// This file is a fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import React from 'react';
import { OpaqueColorValue, StyleProp, TextStyle, ViewStyle } from 'react-native';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

/**
 * SF Symbol -> MaterialIcons name mapping. Keyed by the SF Symbol strings the
 * app actually passes to <IconSymbol>. `satisfies` validates every value is a
 * real MaterialIcons glyph at compile time while keeping the key union narrow.
 *
 * Add your SFSymbol to MaterialIcons mappings here.
 * See MaterialIcons here: https://icons.expo.fyi
 * See SF Symbols in the SF Symbols app on Mac.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'bookmark': 'bookmark-outline',
  'bookmark.fill': 'bookmark',
  'circle.fill': 'circle',
  'j.circle': 'title',
  'e.circle': 'translate',
  'play.circle': 'play-circle-outline',
  'play.circle.fill': 'play-circle-filled',
  'pause.circle.fill': 'pause-circle-filled',
  'stop.circle': 'stop-circle',
  'plus.circle.fill': 'add-circle',
  'checkmark.circle.fill': 'check-circle',
  'arrow.up.circle': 'arrow-circle-up',
  'arrow.clockwise': 'refresh',
  'clock.arrow.circlepath': 'history',
  'info.circle': 'info-outline',
  'doc.on.doc': 'content-copy',
  'trash': 'delete',
  'trash.circle.fill': 'delete',
  'book.fill': 'book',
  'book.pages': 'menu-book',
  'bubble.left.and.bubble.right.fill': 'forum',
  'bubble.left.and.text.bubble.right': 'chat',
  'sparkles': 'auto-awesome',
} satisfies Record<string, MaterialIconName>;

export type IconSymbolName = keyof typeof MAPPING;

const FALLBACK_ICON: MaterialIconName = 'help-outline';

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and require manual mapping to MaterialIcons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  const mapped = MAPPING[name];
  if (__DEV__ && !mapped) {
    console.warn(`IconSymbol: no MaterialIcons mapping for "${name}"`);
  }
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={mapped ?? FALLBACK_ICON}
      style={style as StyleProp<TextStyle>}
    />
  );
}
