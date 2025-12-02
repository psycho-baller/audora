import Footer from "~/components/homepage/footer";
import { Navbar } from "~/components/homepage/navbar";
import { WaitlistInput } from "~/components/homepage/waitlist-input";
import type { Route } from "./+types/manifesto";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Our Manifesto - Audora" },
    {
      name: "description",
      content: "Our mission to build the first AI communication OS—an always-on coach that helps you master communication and unlock opportunities.",
    },
  ];
}

export default function Manifesto() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-6 py-24">
          <div className="space-y-12">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold md:text-5xl">Our Manifesto</h1>
              <p className="text-xl text-muted-foreground">
                Why we're building Audora
              </p>
            </div>

            <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
              <section className="space-y-4">
                <h2 className="text-3xl font-semibold">The Gap</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your communication shapes your opportunities more than almost anything else.
                  The job offers, the relationships, the doors that open or stay closed. Yet we treat it like a fixed trait, something you either have or you don't.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  But here's the truth: <strong>how you speak is just a collection of habits you've built over the years</strong>.
                  If you're monotone, or you get nervous and speak too fast, or you struggle to articulate your ideas clearly, these aren't flaws.
                  They're habits. And habits can be rebuilt.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  The thing is, changing habits we've built over years is hard. You can't just decide to "speak better" and expect it to happen.
                  But <strong>with the right feedback, grounded in scientific and psychological research</strong>, you can systematically rebuild these habits.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-3xl font-semibold">What We're Building</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Audora gives you the feedback you've never had. Private, personalized, always available.
                </p>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    It starts with virtual meetings. Audora transcribes your calls on-device, analyzes how you communicate,
                    and gives you clear, actionable feedback afterward.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    You pick one thing to work on. Before your next meeting, you get reminded.
                    Over time, you watch yourself improve.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Everything stays on your device. Your conversations are yours. Always.
                  </p>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-3xl font-semibold">Where We're Going</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Virtual meetings are just the start. We're building toward something bigger:
                  an always-on communication coach that helps you improve in every interaction.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  We're calling it the first AI communication OS. A layer that sits between you and
                  the world, helping you show up better every time.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  We're starting small, focused on getting the core right. Join us early if you want to help shape what comes next.
                </p>
                <div className="pt-10">
                  <WaitlistInput />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
