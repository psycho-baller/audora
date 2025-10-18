import { ArrowRight, CreditCard, Lock } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function SubscriptionRequired() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-lg w-full text-center">
        <CardHeader className="pb-6">
          <div className="mx-auto mb-4">
            <Lock className="h-16 w-16 text-orange-500" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Subscription Required
          </CardTitle>
          <CardDescription className="text-lg">
            You need an active subscription to access the dashboard.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Choose Your Plan</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Select a subscription plan to unlock full access to your
              dashboard, analytics, and all premium features.
            </p>
          </div>

          <div className="space-y-3">
            <Button asChild className="w-full" size="lg">
              <a href="/pricing">
                View Pricing Plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <a href="/">Back to Home</a>
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Already subscribed? It may take a few moments for your
              subscription to activate. Try refreshing the page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}