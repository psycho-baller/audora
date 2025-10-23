import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Navbar } from "./navbar";

const isProduction = process.env.NODE_ENV === "production";

export default function IntegrationsSection({
  loaderData,
}: {
  loaderData?: { isSignedIn: boolean; hasActiveSubscription: boolean; hasInvite: boolean };
}) {
  // If user is signed in, show dashboard/pricing
  // If user has invite, show sign-up/sign-in buttons
  // Otherwise, show waitlist
  const showAuthButtons = !loaderData?.isSignedIn && loaderData?.hasInvite;
  
  const primaryButtonLink = loaderData?.isSignedIn
    ? loaderData?.hasActiveSubscription
      ? "/dashboard"
      : "/pricing"
    : showAuthButtons
      ? "/sign-up"
      : "/waitlist";

  const primaryButtonText = loaderData?.isSignedIn
    ? loaderData?.hasActiveSubscription
      ? "Go to Dashboard"
      : "Start Connecting Better"
    : showAuthButtons
      ? "Sign Up"
      : "Join Waitlist";

  return (
    <>
    <Navbar loaderData={loaderData} />

    <section id="hero" className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div className="relative z-10 text-center max-w-7xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl md:text-7xl 2xl:text-8xl font-bold mb-4 sm:mb-6 md:mb-8">
            Audora
          </h1>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-semibold mb-6 md:mb-8">
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Communicate better. Connect deeper.
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Privacy-first, real-time speech coaching to help you master the art of communication and build stronger relationships.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
          {showAuthButtons ? (
            <>
              <Button size="lg" asChild className="rounded-full px-8 py-6 text-base font-medium">
                <Link to="/sign-up" prefetch="viewport">
                  Sign Up
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="rounded-full px-8 py-6 text-base font-medium">
                <Link to="/sign-in" prefetch="viewport">
                  Login
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" asChild className="rounded-full px-8 py-6 text-base font-medium">
                <Link to={primaryButtonLink} prefetch="viewport" target="_blank" rel="noopener noreferrer">
                  {primaryButtonText}
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="rounded-full px-8 py-6 text-base font-medium">
                <a href="https://www.linkedin.com/posts/rami-m_social-anxiety-is-a-skill-issue-and-no-this-activity-7385010725607342081-zsVb" target="_blank" rel="noopener noreferrer">
                  Learn More
                </a>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
    </>
  );
}
