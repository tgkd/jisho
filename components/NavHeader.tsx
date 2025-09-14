import React from "react";
import { View } from "react-native";
import { ThemedText, ThemedTextProps } from "./ThemedText";

export function NavHeader({
  title,
  textProps = {
    type: 'defaultSemiBold',
    textAlign: 'center'
  },
}: {
  title: React.ReactNode;
  textProps?: ThemedTextProps;
}) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ThemedText {...textProps}>{title}</ThemedText>
    </View>
  );
}
