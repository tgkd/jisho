import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  useWindowDimensions,
} from "react-native";

import { ThemedText } from "./ThemedText";
import { Marker, extractMarkers, markerMap } from "@/services/parsing";
import { Card } from "./ui/Card";

interface MarkerPopupProps {
  marker: Marker;
  description: string;
  visible: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

function MarkerPopup({
  marker,
  description,
  visible,
  onClose,
  position,
}: MarkerPopupProps) {
  const screenW = useWindowDimensions().width;
  const left = position.x + 200 > screenW ? screenW - 200 : position.x;
  const top = position.y + 24;
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Card p={8} style={[styles.popup, { top, left }]}>
          <ThemedText type="secondary">{description}</ThemedText>
        </Card>
      </Pressable>
    </Modal>
  );
}

interface MarkersTextProps {
  text: string;
  style?: any;
  textType?:
    | "default"
    | "title"
    | "defaultSemiBold"
    | "subtitle"
    | "link"
    | "secondary";
}

export function MarkersText({
  text,
  style,
  textType = "default",
}: MarkersTextProps) {
  const [activeMarker, setActiveMarker] = useState<Marker | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const markersWithPositions = extractMarkers(text);

  const segments = useMemo(() => {
    const s = [];
    let lastIndex = 0;

    markersWithPositions.sort((a, b) => a.startIndex - b.startIndex);

    markersWithPositions.forEach((markerInfo, idx) => {
      const { marker, startIndex, endIndex, rawText } = markerInfo;

      if (startIndex > lastIndex) {
        const beforeText = text.substring(lastIndex, startIndex);
        s.push(
          <ThemedText key={`text-${idx}`} type={textType}>
            {beforeText}
          </ThemedText>
        );
      }

      s.push(
        <Pressable
          style={styles.marker}
          key={`marker-${idx}`}
          onPress={({ nativeEvent }) => {
            setPopupPosition({ x: nativeEvent.pageX, y: nativeEvent.pageY });
            setActiveMarker(marker);
          }}
        >
          <ThemedText type="secondary">{rawText}</ThemedText>
        </Pressable>
      );

      lastIndex = endIndex;
    });

    if (lastIndex < text.length) {
      s.push(
        <ThemedText key="text-last" type={textType}>
          {text.substring(lastIndex)}
        </ThemedText>
      );
    }

    return s;
  }, [text, markersWithPositions, textType]);

  if (markersWithPositions.length === 0) {
    return (
      <ThemedText style={style} type={textType}>
        {text}
      </ThemedText>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.textContainer}>{segments}</View>

      <MarkerPopup
        marker={activeMarker!}
        description={activeMarker ? markerMap[activeMarker] : ""}
        visible={!!activeMarker}
        onClose={() => setActiveMarker(null)}
        position={popupPosition}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  textContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  popup: {
    position: "absolute",
    elevation: 5,
  },
  marker: {
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
