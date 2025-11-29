import {
  MessageSquare,
  Brain,
  Zap,
  Shield,
  TrendingUp,
  Phone,
  Network,
  Clock
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Privacy-First Architecture",
    description: "Everything processes on-device. Your conversations never leave your computer unless you choose to share them. Complete privacy, always.",
  },
  {
    icon: Phone,
    title: "Listens to Your Virtual Meetings",
    description: "Starting with virtual meetings, Audora transcribes and analyzes your calls in real-time, all on your device.",
  },
  {
    icon: Brain,
    title: "Actionable Feedback After Calls",
    description: "Get clear insights on your communication patterns—filler words, pacing, clarity, and tone. Know exactly what to improve.",
  },
  {
    icon: Zap,
    title: "Focus on One Thing at a Time",
    description: "Pick one specific area to work on for your next meeting. Focused improvement is how real change happens.",
  },
  {
    icon: MessageSquare,
    title: "Pre-Meeting Preparation",
    description: "Before each meeting, get reminded of your focus area. Go in prepared and intentional instead of reactive.",
  },
  {
    icon: TrendingUp,
    title: "Track Your Progress",
    description: "Watch yourself improve over time. See patterns change, skills develop, and confidence build with every conversation.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="all-features" className="py-16 md:py-32 bg-muted/50">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            What You Get
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Private, on-device coaching to help you communicate better in every meeting.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-background rounded-lg border p-6 hover:border-primary/50 transition-colors"
              >
                <div className="mb-4 w-fit rounded-lg bg-primary/10 p-3">
                  <Icon className="size-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 md:mt-16 text-center">
          <p className="text-muted-foreground text-sm max-w-3xl mx-auto">
            <span className="font-semibold">Coming Soon:</span> Emotional tone detection, conversation challenges,
            long-term memory tracking, community integrations, and wearable mode.
          </p>
        </div>
      </div>
    </section>
  );
}
