import { useThemeColor } from "@/hooks/useThemeColor";
import { ActivityIndicator, View, StyleSheet } from "react-native";

export function Loader() {
  const tintColor = useThemeColor(
    { light: "#000000", dark: "#ffffff" },
    "icon"
  );
  return (
    <View style={styles.container}>
      <ActivityIndicator color={tintColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
