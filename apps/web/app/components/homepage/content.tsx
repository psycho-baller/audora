  import { Button } from "~/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

export default function ContentSection() {
  return (
    <section id="features" className="py-16 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-6 md:grid-cols-2 md:gap-12">
          <h2 className="text-4xl font-medium">
            The quality of your communication shapes your life
          </h2>
          <div className="space-y-6">
            <p>
              Yet most people never receive meaningful feedback on how they communicate.
              In high-stakes moments—interviews, presentations, important meetings—{" "}
              <span className="font-bold">it's nearly impossible to know how you're actually coming across.</span>
            </p>
            <p>
              Without feedback, you repeat the same patterns for years. The same filler words.
              The same unclear explanations. The same missed opportunities.
            </p>
            <p>
              We track our fitness, sleep, and productivity. <span className="font-bold">Why not the skill that impacts everything else?</span>
            </p>
            <p className="text-muted-foreground text-sm">
              Audora gives you the communication feedback you've never had access to—private, personalized, and always available.
            </p>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="gap-1 pr-1.5"
            >
              <Link to="#how-it-works">
                <span>See How It Works</span>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
