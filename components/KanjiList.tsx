import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { getKanji, KanjiEntry } from "@/services/database";
import { BottomSheet, Host } from "@expo/ui/swift-ui";
import Animated from "react-native-reanimated";

export function KanjiListView({
  kanjiChars,
  handleClose,
}: {
  kanjiChars: string[] | null;
  handleClose: () => void;
}) {
  const { width, height: wHeight } = useWindowDimensions();

  if (!kanjiChars) {
    return null;
  }

  return (
    <Host style={{ position: "absolute", width }}>
      <BottomSheet
        isOpened={kanjiChars !== null}
        onIsOpenedChange={(o) => !o && handleClose()}
      >
        <Animated.View style={{ height: wHeight * 0.5, width }}>
          <ScrollView contentContainerStyle={styles.kanjiList}>
            {kanjiChars?.map((char, idx) => (
              <KanjiDetails key={idx} character={char} />
            ))}
          </ScrollView>
        </Animated.View>
      </BottomSheet>
    </Host>
  );
}

export function KanjiDetails({ character }: { character: string }) {
  const router = useRouter();
  const db = useSQLiteContext();
  const [details, setDetails] = useState<KanjiEntry | null>(null);

  useEffect(() => {
    const loadKanjiDetails = async () => {
      const result = await getKanji(db, character);
      setDetails(result);
    };
    loadKanjiDetails();
  }, []);

  const goToKanji = () => {
    if (!details) {
      return;
    }

    router.push({
      pathname: "/word/kanji/[id]",
      params: { id: details.id.toString(), title: details.character },
    });
  };

  if (!details) {
    return null;
  }

  return (
    <View style={styles.kanjiDetails}>
      <View style={styles.row}>
        <HapticTab onPress={goToKanji} hitSlop={12}>
          <ThemedText type="subtitle">{details.character}</ThemedText>
        </HapticTab>
        <ThemedText size="sm" style={styles.kanjiDesc}>
          {details.meanings?.join(", ")}
        </ThemedText>
      </View>
      {details.onReadings && (
        <ThemedText type="secondary" size="sm">
          {"On: " + details.onReadings.join(", ")}
        </ThemedText>
      )}
      {details.kunReadings && (
        <ThemedText type="secondary" size="sm">
          {"Kun: " + details.kunReadings.join(", ")}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  kanjiDetails: {
    paddingVertical: 4,
    gap: 2,
  },
  kanjiList: {
    padding: 16,
    gap: 4,
  },
  kanjiDesc: {
    maxWidth: "90%",
  },
  kanjiButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
