import type { Route } from "./+types/speech-feedback";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Speech Feedback - Audora" },
    {
      name: "description",
      content: "Get personalized feedback on your speech patterns and communication style.",
    },
  ];
}

export default function SpeechFeedback() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold">Speech Feedback</h1>
          <p className="text-xl text-muted-foreground">
            This page will contain speech feedback features.
          </p>
        </div>
      </div>
    </div>
  );
}

