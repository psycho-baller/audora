import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Navbar } from "~/components/homepage/navbar";
import Footer from "~/components/homepage/footer";
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
                  The job offers, the relationships, the doors that open or stay closed.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Yet most people go their entire lives without getting real feedback on how they communicate.
                  In the moments that matter most—interviews, presentations, important conversations—you're
                  essentially flying blind.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  So you repeat the same patterns. The same filler words. The same unclear explanations.
                  Year after year. Not because you're lazy, but because <strong>no one's ever shown you what to fix</strong>.
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
                    You pick one thing to work on. Not ten—just one. Before your next meeting, you get reminded.
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
                <div className="pt-4">
                  <Button size="lg" asChild>
                    <Link to="/waitlist">
                      Join the Waitlist
                    </Link>
                  </Button>
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
