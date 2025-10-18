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
      content: "Discover our mission to transform how people connect through better conversations.",
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
                Building deeper connections through intentional communication
              </p>
            </div>

            <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
              <section className="space-y-4">
                <h2 className="text-3xl font-semibold">Our Mission</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We believe that meaningful relationships are built through authentic, 
                  intentional conversations. In a world of endless distractions and 
                  surface-level interactions, we're on a mission to help people become 
                  more articulate, thoughtful communicators.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-3xl font-semibold">What We Stand For</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Privacy First</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Your conversations are yours. We process everything on-device, 
                      ensuring your most personal moments stay private.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Real Growth</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We don't just track metrics—we help you develop genuine communication 
                      skills that strengthen your relationships.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Human Connection</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Technology should enhance human connection, not replace it. We build 
                      tools that help you be more present in your conversations.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-3xl font-semibold">Join Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We're building something special—a community of people committed to 
                  becoming better communicators and building deeper relationships. 
                  Join our waitlist to be part of this journey.
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
