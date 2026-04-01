type ConversationLike = {
  location?: string | null;
  summary?: string | null;
  status?: string | null;
};

const LEGACY_CONTEXT_PLACEHOLDERS = new Set([
  "Mount Royal University Library",
  "Imported Conversation",
  "Imported Text Transcript",
]);

const LEGACY_SUMMARY_PREFIXES = [
  /^Conversation completed/i,
  /^Conversation imported/i,
  /^Conversation with \d+ turns?/i,
];

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeFileStem(fileName?: string | null) {
  if (!fileName) return null;

  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const cleaned = collapseWhitespace(withoutExtension.replace(/[_-]+/g, " "));
  if (!cleaned) return null;

  return capitalizeFirst(cleaned);
}

export function getConversationContextLabel(
  conversation?: Pick<ConversationLike, "location"> | null
) {
  const value = collapseWhitespace(conversation?.location ?? "");
  if (!value || LEGACY_CONTEXT_PLACEHOLDERS.has(value)) {
    return null;
  }

  return value;
}

function getSummaryFallback(summary?: string | null) {
  const value = collapseWhitespace(summary ?? "");
  if (!value) return null;

  if (LEGACY_SUMMARY_PREFIXES.some((pattern) => pattern.test(value))) {
    return null;
  }

  return truncate(value.replace(/[.]+$/, ""), 72);
}

export function buildConversationContextLabel(
  source: "live" | "audioImport" | "textImport",
  fileName?: string | null
) {
  const fileStem = normalizeFileStem(fileName);

  switch (source) {
    case "live":
      return "Live conversation";
    case "audioImport":
      return fileStem ? `Audio import: ${fileStem}` : "Audio import";
    case "textImport":
      return fileStem ? `Transcript import: ${fileStem}` : "Transcript import";
  }
}

export function getConversationDisplayTitle(conversation?: ConversationLike | null) {
  return (
    getConversationContextLabel(conversation) ||
    getSummaryFallback(conversation?.summary) ||
    (conversation?.status === "ended" ? "Completed conversation" : "Live conversation")
  );
}
