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

    // Split text by brackets to identify protected regions
    const splitByBrackets = (text: string) => {
      const result: { text: string; protected: boolean }[] = [];
      let inBrackets = false;
      let currentSegment = "";

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === "[") {
          if (currentSegment) {
            result.push({ text: currentSegment, protected: inBrackets });
          }
          inBrackets = true;
          currentSegment = "[";
        } else if (char === "]" && inBrackets) {
          currentSegment += "]";
          result.push({ text: currentSegment, protected: true });
          inBrackets = false;
          currentSegment = "";
        } else {
          currentSegment += char;
        }
      }

      if (currentSegment) {
        result.push({ text: currentSegment, protected: inBrackets });
      }

      return result;
    };

    const processText = (
      currentPart: string,
      term: string,
      isProtected: boolean
    ) => {
      if (isProtected) {
        return [{ text: currentPart, highlight: false }];
      }

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

    const textSegments = splitByBrackets(currentText);
    let segments = textSegments.map((segment) => ({
      text: segment.text,
      highlight: false,
      protected: segment.protected,
    }));

    for (const term of highlights) {
      if (!term) continue;

      const newSegments = [];
      for (const segment of segments) {
        if (segment.highlight || segment.protected) {
          newSegments.push(segment);
        } else {
          const processedSegments = processText(
            segment.text,
            term,
            segment.protected
          );
          newSegments.push(
            ...processedSegments.map((s) => ({ ...s, protected: false }))
          );
        }
      }
      segments = newSegments;
    }

    return segments.map(({ text, highlight }) => ({ text, highlight }));
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
