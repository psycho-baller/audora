"use client";
import { useAuth } from "@clerk/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Loader2 } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "../../convex/_generated/api";

export default function IntegratedPricing() {
  const { isSignedIn, userId } = useAuth();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [plans, setPlans] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const getPlans = useAction(api.subscriptions.getAvailablePlans);
  const subscriptionStatus = useQuery(
    api.subscriptions.checkUserSubscriptionStatus,
    {
      userId: isSignedIn ? userId : undefined,
    }
  );
  const userSubscription = useQuery(api.subscriptions.fetchUserSubscription);
  const createCheckout = useAction(api.subscriptions.createCheckoutSession);
  const createPortalUrl = useAction(api.subscriptions.createCustomerPortalUrl);
  const upsertUser = useMutation(api.users.upsertUser);

  // Sync user when signed in
  React.useEffect(() => {
    if (isSignedIn) {
      upsertUser().catch(console.error);
    }
  }, [isSignedIn, upsertUser]);

  // Load plans on component mount
  React.useEffect(() => {
    const loadPlans = async () => {
      try {
        const result = await getPlans();
        setPlans(result);
      } catch (error) {
        console.error("Failed to load plans:", error);
        setError("Failed to load pricing plans. Please try again.");
      }
    };
    loadPlans();
  }, [getPlans]);

  const handleSubscribe = async (priceId: string) => {
    if (!isSignedIn) {
      // Redirect to sign in
      window.location.href = "/sign-in";
      return;
    }

    setLoadingPriceId(priceId);
    setError(null);

    try {
      // Ensure user exists in database before action
      await upsertUser();

      // If user has active subscription, redirect to customer portal for plan changes
      if (
        userSubscription?.status === "active" &&
        userSubscription?.customerId
      ) {
        const portalResult = await createPortalUrl({
          customerId: userSubscription.customerId,
        });
        window.open(portalResult.url, "_blank");
        setLoadingPriceId(null);
        return;
      }

      // Otherwise, create new checkout for first-time subscription
      const checkoutUrl = await createCheckout({ priceId });

      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Failed to process subscription action:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to process request. Please try again.";
      setError(errorMessage);
      setLoadingPriceId(null);
    }
  };

  if (!plans) {
    return (
      <section className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading plans...</span>
        </div>
        {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-xl text-muted-foreground">
          Choose the plan that fits your needs
        </p>
        {isSignedIn && !subscriptionStatus?.hasActiveSubscription && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
            <p className="text-blue-800 font-medium">📋 Complete your setup</p>
            <p className="text-blue-700 text-sm mt-1">
              You're signed in! Choose a plan below to access your dashboard and
              start using all features.
            </p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl w-full">
        {plans.items
          .sort((a: any, b: any) => {
            const priceComparison = a.prices[0].amount - b.prices[0].amount;
            return priceComparison !== 0
              ? priceComparison
              : a.name.localeCompare(b.name);
          })
          .map((plan: any, index: number) => {
            const isPopular =
              plans.items.length === 2
                ? index === 1
                : index === Math.floor(plans.items.length / 2); // Mark middle/higher priced plan as popular
            const price = plan.prices[0]; // Use first price for display
            // More robust current plan detection - prioritize amount matching due to price ID inconsistencies
            const isCurrentPlan =
              userSubscription?.status === "active" &&
              userSubscription?.amount === price.amount;

            return (
              <Card
                key={plan.id}
                className={`relative h-fit ${
                  isPopular ? "border-primary" : ""
                } ${isCurrentPlan ? "border-green-500 bg-green-50/50" : ""}`}
              >
                {isPopular && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Current Plan
                    </span>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">
                      ${(price.amount / 100).toFixed(0)}
                    </span>
                    <span className="text-muted-foreground">
                      /{price.interval || "month"}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>All features included</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Priority support</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Cancel anytime</span>
                  </div>
                  {plan.isRecurring && (
                    <div className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-500" />
                      <span>Recurring billing</span>
                    </div>
                  )}
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(price.id)}
                    disabled={loadingPriceId === price.id}
                    variant={isCurrentPlan ? "secondary" : "default"}
                  >
                    {loadingPriceId === price.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting up checkout...
                      </>
                    ) : isCurrentPlan ? (
                      "✓ Current Plan"
                    ) : userSubscription?.status === "active" ? (
                      (() => {
                        const currentAmount = userSubscription.amount || 0;
                        const newAmount = price.amount;

                        if (newAmount > currentAmount) {
                          return `Upgrade (+$${(
                            (newAmount - currentAmount) /
                            100
                          ).toFixed(0)}/mo)`;
                        } else if (newAmount < currentAmount) {
                          return `Downgrade (-$${(
                            (currentAmount - newAmount) /
                            100
                          ).toFixed(0)}/mo)`;
                        } else {
                          return "Manage Plan";
                        }
                      })()
                    ) : (
                      "Get Started"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
      </div>

      <div className="mt-12 text-center">
        <p className="text-muted-foreground">
          Need a custom plan?{" "}
          <span className="text-primary cursor-pointer hover:underline">
            Contact us
          </span>
        </p>
        {error && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-center">{error}</p>
          </div>
        )}

        {userSubscription &&
          !plans?.items.some(
            (plan: any) => plan.prices[0].id === userSubscription.polarPriceId
          ) && (
            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-md max-w-md mx-auto">
              <p className="text-amber-800 text-center text-sm">
                You have an active subscription that's not shown above. Contact
                support for assistance.
              </p>
            </div>
          )}
      </div>
    </section>
  );
}
