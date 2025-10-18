  import { Button } from "~/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

export default function ContentSection() {
  return (
    <section id="features" className="py-16 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-6 md:grid-cols-2 md:gap-12">
          <h2 className="text-4xl font-medium">
            A mirror for how you talk. So you can maxx out how you link.
          </h2>
          <div className="space-y-6">
            <p>
              Most people don't realize how much they get in their own way. Filler words. Rambling. Vague language.
              <span className="font-bold"> It's not what you say—it's how you say it.</span>
            </p>
            <p>
              Audora shows you exactly how your words affect your connections. Get real-time feedback.
              Improve your clarity. Build deeper relationships through better conversations.
            </p>
            <p className="text-muted-foreground text-sm">
              Privacy-first. On-device. Your conversations stay yours.
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
