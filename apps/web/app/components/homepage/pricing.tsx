"use client";
import { useAuth } from "@clerk/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "../../../convex/_generated/api";

export default function Pricing({ loaderData }: { loaderData: any }) {
  const { isSignedIn } = useAuth();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userSubscription = useQuery(api.subscriptions.fetchUserSubscription);
  const createCheckout = useAction(api.subscriptions.createCheckoutSession);
  const createPortalUrl = useAction(api.subscriptions.createCustomerPortalUrl);
  const upsertUser = useMutation(api.users.upsertUser);

  const handleSubscribe = async (priceId: string) => {
    if (!isSignedIn) {
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

  return (
    <section id="pricing" className="py-16 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h1 className="text-center text-4xl font-semibold lg:text-5xl">
            Pricing that Scales with You
          </h1>
          <p>
            Choose the plan that fits your needs. All plans include full access
            to our platform.
          </p>
        </div>

        {!loaderData?.plans ? (
          <div className="mt-8 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading plans...</span>
            </div>
            {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:mt-20 md:grid-cols-3">
            {loaderData.plans.items
              .sort((a: any, b: any) => {
                const priceComparison = a.prices[0].amount - b.prices[0].amount;
                return priceComparison !== 0
                  ? priceComparison
                  : a.name.localeCompare(b.name);
              })
              .map((plan: any, index: number) => {
                const isPopular =
                  loaderData.plans.items.length === 2
                    ? index === 1
                    : index === Math.floor(loaderData.plans.items.length / 2); // Mark middle/higher priced plan as popular
                const price = plan.prices[0];
                const isCurrentPlan =
                  userSubscription?.status === "active" &&
                  userSubscription?.amount === price.amount;

                return (
                  <Card
                    key={plan.id}
                    className={`relative ${isPopular ? "border-primary" : ""} ${
                      isCurrentPlan ? "border-green-500 bg-green-50/50" : ""
                    }`}
                  >
                    {isPopular && !isCurrentPlan && (
                      <span className="bg-primary text-primary-foreground absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full px-3 py-1 text-xs font-medium">
                        Popular
                      </span>
                    )}
                    {isCurrentPlan && (
                      <span className="bg-green-500 text-white absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full px-3 py-1 text-xs font-medium">
                        Current Plan
                      </span>
                    )}

                    <CardHeader>
                      <CardTitle className="font-medium">{plan.name}</CardTitle>

                      <span className="my-3 block text-2xl font-semibold">
                        ${(price.amount / 100).toFixed(0)} /{" "}
                        {price.interval || "mo"}
                      </span>

                      <CardDescription className="text-sm">
                        {plan.description}
                      </CardDescription>

                      <Button
                        className="mt-4 w-full"
                        variant={
                          isCurrentPlan
                            ? "secondary"
                            : isPopular
                            ? "default"
                            : "outline"
                        }
                        onClick={() => handleSubscribe(price.id)}
                        disabled={loadingPriceId === price.id}
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
                          "Get Started (Demo)"
                        )}
                      </Button>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <hr className="border-dashed" />

                      <ul className="list-outside space-y-3 text-sm">
                        <li className="flex items-center gap-2">
                          <Check className="size-3" />
                          All features included
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="size-3" />
                          Priority support
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="size-3" />
                          Cancel anytime
                        </li>
                        {plan.isRecurring && (
                          <li className="flex items-center gap-2">
                            <Check className="size-3" />
                            Recurring billing
                          </li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}

        {error && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-md max-w-md mx-auto">
            <p className="text-red-800 text-center">{error}</p>
          </div>
        )}

        {userSubscription &&
          !loaderData.plans?.items.some(
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
