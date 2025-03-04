type Marker = "numbered" | "bullet" | "dash" | "rows" | "none";

type Divider = "comma" | "semicolon" | "dot" | "none";

type FormatOptions = {
  truncateRow?: number;
  truncateAll?: number;
};

export function deduplicateEn(meanings: string[]): string[] {
  return Array.from(
    new Set(
      meanings.flatMap((meaning) =>
        meaning.split(";").map((part) => part.trim())
      )
    )
  );
}

export function formatEn(
  meaning: string,
  listStyle: Marker = "none",
  options?: FormatOptions
): string {
  // Return empty string for null, undefined, or empty input
  if (!meaning) return "";

  // Split the string by semicolons and filter out any empty items
  const parts = meaning
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  // Return the original string if no valid parts found
  if (parts.length === 0) return meaning;

  // Apply truncation if specified in options
  if (options?.truncateRow && options.truncateRow > 0) {
    parts.forEach((part, index) => {
      if (part.length > options.truncateRow!) {
        parts[index] = part.substring(0, options.truncateRow) + "…";
      }
    });
  }

  // For a single item, just return it trimmed
  if (parts.length === 1) return parts[0];

  if (options?.truncateAll && options.truncateAll > 0) {
    let totalLength = 0;
    const keptParts = [];

    for (const part of parts) {
      // Add length of part plus the separator ("; " or "\n" depending on list style)
      const separatorLength =
        listStyle === "none" || listStyle === "rows" ? 2 : 1; // "; " is 2 chars, "\n" is 1 char
      const partLength =
        part.length + (keptParts.length > 0 ? separatorLength : 0);

      if (totalLength + partLength <= options.truncateAll) {
        keptParts.push(part);
        totalLength += partLength;
      } else {
        break; // Stop adding parts once we exceed the limit
      }
    }

    // Update parts with only the items that fit the total size limit
    parts.splice(0, parts.length, ...keptParts);
  }

  // Format multiple items based on the specified list style
  switch (listStyle) {
    case "bullet":
      return parts.map((part) => `• ${part}`).join("\n");
    case "dash":
      return parts.map((part) => `- ${part}`).join("\n");
    case "numbered":
      return parts.map((part, index) => `${index + 1}. ${part}`).join("\n");
    case "rows":
      return parts.join("\n");

    default:
      return parts.join("; ");
  }
}

export function formatJp(
  reading: string,
  withBrackets = true,
  divider: Divider = "comma"
): string {
  // Return empty string for null, undefined, or empty input
  if (!reading) return "";

  // Split the string by semicolons and filter out any empty items
  const parts = reading
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  // Return the original string if no valid parts found
  if (parts.length === 0) return reading;

  // For a single item, just return it trimmed
  if (parts.length === 1) return parts[0];

  let result = "";
  // Format multiple items based on the specified divider
  switch (divider) {
    case "semicolon":
      result = parts.join(";");
    case "dot":
      result = parts.join("・");
    case "none":
      result = parts.join(" ");
    default:
      result = parts.join("、");
  }

  if (withBrackets) {
    return `【${result}】`;
  }

  return result;
}

const PARTS_OF_SPEECH: Record<string, string> = {
  n: "Noun",
  v1: "Ichidan verb",
  v5: "Godan verb",
  "adj-i": "I-adjective",
  "adj-na": "Na-adjective",
  "adj-t": "Taru adjective",
  adv: "Adverb",
  exp: "Expression",
  int: "Interjection",
  num: "Number",
  pref: "Prefix",
  suf: "Suffix",
  vs: "Suru verb",
  v5r: "Godan verb (irregular)",
  vz: "Ichidan verb (zuru)",
  vi: "Intransitive verb",
  vk: "Kuru verb",
  vn: "Irregular nu verb",
  vr: "Ru verb",
  "vs-c": "Suru verb - special class",
  "vs-i": "Suru verb - irregular",
  "vs-s": "Suru verb - special class",
};
