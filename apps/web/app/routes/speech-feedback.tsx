import { SpeechFeedback } from "~/components/speech-feedback";
import type { Route } from "./+types/speech-feedback";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Try Speech Feedback - Audora" },
    {
      name: "description",
      content: "Upload your speech and see what kind of feedback you'll receive.",
    },
  ];
}

export default SpeechFeedback;

