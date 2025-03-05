import React, { useMemo } from "react";
import { TextStyle } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText, ThemedTextProps } from "./ThemedText";

interface HighlightTextProps extends ThemedTextProps {
  text: string;
  highlight: string | string[];
  textStyle?: TextStyle;
  caseSensitive?: boolean;
}

export function HighlightText({
  text,
  highlight,
  textStyle,
  caseSensitive = false,
  ...rest
}: HighlightTextProps) {
  const backgroundColor = useThemeColor({}, "highlight");

  const segments = useMemo(() => {
    const highlights = Array.isArray(highlight) ? highlight : [highlight];
    let currentText = text;

    const processText = (currentPart: string, term: string) => {
      const regex = new RegExp(
        `(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        caseSensitive ? "g" : "gi"
      );

      let match;
      let lastIdx = 0;
      const segments = [];

      while ((match = regex.exec(currentPart)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        if (matchStart > lastIdx) {
          segments.push({
            text: currentPart.substring(lastIdx, matchStart),
            highlight: false,
          });
        }

        segments.push({ text: match[0], highlight: true });
        lastIdx = matchEnd;
      }

      if (lastIdx < currentPart.length) {
        segments.push({
          text: currentPart.substring(lastIdx),
          highlight: false,
        });
      }

      return segments;
    };

    // Process text for each highlight term
    let segments = [{ text: currentText, highlight: false }];

    for (const term of highlights) {
      if (!term) continue;

      const newSegments = [];
      for (const segment of segments) {
        if (segment.highlight) {
          // Already highlighted segments remain unchanged
          newSegments.push(segment);
        } else {
          // Process non-highlighted segments
          const processedSegments = processText(segment.text, term);
          newSegments.push(...processedSegments);
        }
      }
      segments = newSegments;
    }

    return segments;
  }, [text, highlight, caseSensitive]);

  return (
    <ThemedText {...rest}>
      {segments.map((s, idx) => (
        <ThemedText
          key={idx}
          style={s.highlight ? [{ backgroundColor }, textStyle] : undefined}
        >
          {s.text}
        </ThemedText>
      ))}
    </ThemedText>
  );
}
