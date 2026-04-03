import { getAuth } from "@clerk/react-router/ssr.server";
// import { fetchAction, fetchQuery } from "convex/nextjs";
import * as React from "react";
import ContentSection from "~/components/homepage/content";
import FeaturesSection from "~/components/homepage/features";
import Footer from "~/components/homepage/footer";
import HowItWorksSection from "~/components/homepage/how-it-works";
import Integrations from "~/components/homepage/integrations";
import TechnologiesSection from "~/components/homepage/technologies";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  const title = "Audora - your AI communication coach";
  const description =
    "The First Private AI Communication OS. Track, improve, and master the skill that impacts every area of your life";
  const keywords = "Communication, Speech Analysis, Relationships, AI Coaching, Privacy-First, Connection, Conversation Skills, AI Communication Coach, AI Communication Coach App, Improve your communication, self-improvement";
  const siteUrl = "https://getaudora.app";
  const imageUrl =
    "/logo.png";

  return [
    { title },
    {
      name: "description",
      content: description,
    },

    // Open Graph / Facebook
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: imageUrl },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:url", content: siteUrl },
    { property: "og:site_name", content: "Audora" },
    { property: "og:image", content: imageUrl },

    // Twitter Card
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    {
      name: "twitter:description",
      content: description,
    },
    { name: "twitter:image", content: imageUrl },
    {
      name: "keywords",
      content: keywords,
    },
    { name: "author", content: "Ras Mic" },
    { name: "favicon", content: imageUrl },
  ];
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);

  // Parallel data fetching to reduce waterfall
  // const [subscriptionData, plans] = await Promise.all([
  //   userId
  //     ? fetchQuery(api.subscriptions.checkUserSubscriptionStatus, {
  //         userId,
  //       }).catch((error) => {
  //         console.error("Failed to fetch subscription data:", error);
  //         return null;
  //       })
  //     : Promise.resolve(null),
  //   fetchAction(api.subscriptions.getAvailablePlans)
  // ]);

  return {
    isSignedIn: !!userId,
    hasActiveSubscription: true,//subscriptionData?.hasActiveSubscription || false,
    plans: undefined,
    // Signup is now open on the web. Invite cookies are still consumed later
    // during user sync so invite attribution continues to work.
    hasInvite: true,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [joinedWaitlist, setJoinedWaitlist] = React.useState(false);
  return (
    <>
      <Integrations
        loaderData={loaderData}
        joinedWaitlist={joinedWaitlist}
        onJoinedWaitlist={() => setJoinedWaitlist(true)}
      />
      <ContentSection />
      <FeaturesSection />
      <HowItWorksSection
        loaderData={loaderData}
      />
      <TechnologiesSection />
      <Footer />
    </>
  );
}
