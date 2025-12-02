import { api } from "@audora/backend/convex/_generated/api";
import { useAction } from "convex/react";
import { ArrowRight } from "lucide-react";
import { WaitlistInput } from "./waitlist-input";

const steps = [
  {
    number: "01",
    title: "Record Your Virtual Meetings",
    description: "Audora transcribes and analyzes your virtual calls in real-time, all on your device. Everything stays private.",
    detail: "Job interviews, team meetings, client calls—whatever matters to you.",
  },
  {
    number: "02",
    title: "Get Clear Feedback After",
    description: "After each call, see exactly how you communicated—filler words, pacing, clarity, tone. Clear insights, not just data.",
    detail: "Understand your patterns instead of guessing.",
  },
  {
    number: "03",
    title: "Choose What to Work On",
    description: "Pick one thing to focus on for your next meeting. Not ten things—just one. That's how improvement actually happens.",
    detail: "You can always come back to the other feedback later.",
  },
  {
    number: "04",
    title: "Prepare Before Your Next Call",
    description: "Before your next meeting, Audora reminds you what you're working on. You'll go in prepared, not scrambling.",
    detail: "Build the habit of intentional communication.",
  },
  {
    number: "05",
    title: "Watch Yourself Improve",
    description: "Track your progress over time. See the patterns change, the skills develop, the confidence build.",
    detail: "Real growth, not just metrics.",
  },
];

export default function HowItWorksSection({
  joinedWaitlist,
  onJoinedWaitlist,
}: {
  joinedWaitlist?: boolean;
  onJoinedWaitlist?: () => void;
}) {
  const addEmail = useAction(api.homepage.addEmailToWaitlist);
  return (
    <section id="how-it-works" className="py-16 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            How Audora Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Five simple steps to master your communication skills and unlock new opportunities.
            Your personal AI coach that helps you improve with every meeting.
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
              Ready to Master Your Communication?
            </h3>
            <p className="text-muted-foreground mb-4">
              We're focused on building the most useful communication tool possible.
              Join us early and help shape what we build next.
            </p>
            <div className="w-full flex flex-col items-center gap-4">
              <WaitlistInput
                  busy={false}
                  joined={joinedWaitlist}
                  onSubmit={async (email) => {
                    const res = await addEmail({ email });
                    if (res.alreadyAdded) {
                      return { alreadyAdded: true };
                    }
                    onJoinedWaitlist?.();
                    return { alreadyAdded: false };
                  }}
                />
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
