import { ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Start a Conversation",
    description: "Open Audora and begin speaking. The app listens with your full consent, processing everything on-device for maximum privacy.",
    detail: "Whether it's a call, meeting, or casual chat—just hit record and be present.",
  },
  {
    number: "02",
    title: "Real-Time Analysis",
    description: "As you speak, Whisper-tiny transcribes your words locally. Our AI analyzes your speech patterns, filler words, pacing, and clarity in real-time.",
    detail: "See instant flags on your communication patterns without breaking flow.",
  },
  {
    number: "03",
    title: "Get Instant Feedback",
    description: "Receive clear, actionable insights: track filler words, identify weak phrasing, understand your pacing, and see where you can improve.",
    detail: "No judgment—just supportive coaching to help you grow.",
  },
  {
    number: "04",
    title: "Reflect with AI",
    description: "After your conversation, chat or call an AI companion to reflect on what happened. What did you learn about yourself? About them? What can you discuss next time?",
    detail: "Deep reflection turns conversations into growth opportunities.",
  },
  {
    number: "05",
    title: "Track Your Growth",
    description: "Watch your communication skills improve over time. See your filler words decrease, your clarity increase, and your relationships deepen.",
    detail: "Build a personal memory system that tracks your evolution as a communicator.",
  },
  {
    number: "06",
    title: "Visualize Your Network",
    description: "Map your relationships and conversation patterns. Understand who you connect with, how often, and what topics matter most.",
    detail: "Turn your social life into meaningful insights and stronger bonds.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            How Audora Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Six simple steps to transform your conversations and deepen your connections.
            Start your journey to becoming a more intentional communicator.
          </p>
        </div>

        <div className="space-y-8 md:space-y-12">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative grid gap-6 md:grid-cols-[1fr,2fr] md:gap-12 items-start"
            >
              {/* Step Number & Connector */}
              <div className="relative flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center size-16 md:size-20 rounded-full bg-primary/10 border-2 border-primary text-primary font-bold text-xl md:text-2xl">
                    {step.number}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="hidden md:block w-0.5 h-24 bg-gradient-to-b from-primary/50 to-transparent mt-4" />
                  )}
                </div>

                {/* Mobile Arrow */}
                <div className="md:hidden flex items-center h-16">
                  <ArrowRight className="size-5 text-primary" />
                </div>
              </div>

              {/* Content */}
              <div className="space-y-3 pb-8 md:pb-0">
                <h3 className="text-2xl md:text-3xl font-semibold">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                  {step.description}
                </p>
                <p className="text-sm text-muted-foreground/80 italic">
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="inline-block rounded-lg bg-primary/5 border border-primary/20 px-6 py-8 max-w-2xl">
            <h3 className="text-2xl font-semibold mb-3">
              Ready to maxx out how you link?
            </h3>
            <p className="text-muted-foreground mb-4">
              Join the movement of people who believe that human connection is the strongest force in the world.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Start Your Journey
              </a>
              <a
                href="#all-features"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Explore Features
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
