type TimedTranscriptTurn = {
  words?: Array<{
    startTime: number;
    endTime: number;
  }>;
};

type ConversationTiming = {
  startedAt?: number;
  endedAt?: number;
};

export function getTranscriptDurationMs(transcript?: TimedTranscriptTurn[] | null) {
  if (!transcript?.length) {
    return null;
  }

  let maxEndTimeSeconds = 0;

  for (const turn of transcript) {
    if (Array.isArray(turn.words)) {
      for (const word of turn.words) {
        if (Number.isFinite(word.endTime)) {
          maxEndTimeSeconds = Math.max(maxEndTimeSeconds, word.endTime);
        }
      }
    }
  }

  return maxEndTimeSeconds > 0 ? Math.round(maxEndTimeSeconds * 1000) : null;
}

export function getConversationDurationMs(
  conversation?: ConversationTiming | null,
  transcript?: TimedTranscriptTurn[] | null
) {
  const transcriptDurationMs = getTranscriptDurationMs(transcript);
  if (transcriptDurationMs !== null) {
    return transcriptDurationMs;
  }

  if (conversation?.startedAt && conversation.endedAt) {
    return Math.max(conversation.endedAt - conversation.startedAt, 0);
  }

  return null;
}

export function formatConversationDuration(durationMs: number | null) {
  if (durationMs === null) {
    return "N/A";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
