import { getAuth } from "@clerk/react-router/ssr.server";
// import { fetchAction, fetchQuery } from "convex/nextjs";

import ContentSection from "~/components/homepage/content";
import FeaturesSection from "~/components/homepage/features";
import Footer from "~/components/homepage/footer";
import HowItWorksSection from "~/components/homepage/how-it-works";
import Integrations from "~/components/homepage/integrations";
import TechnologiesSection from "~/components/homepage/technologies";
import { api } from "../../convex/_generated/api";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  const title = "Audora - Transform How You Connect";
  const description =
    "Your on-device speech reflection app. Become a more intentional, articulate communicator and unlock deeper relationships through better conversations.";
  const keywords = "Communication, Speech Analysis, Relationships, AI Coaching, Privacy-First, Connection, Conversation Skills";
  const siteUrl = "https://www.linkmaxing.com/";
  const imageUrl =
    "https://jdj14ctwppwprnqu.public.blob.vercel-storage.com/rsk-image-FcUcfBMBgsjNLo99j3NhKV64GT2bQl.png";

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
    plans: undefined
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Integrations loaderData={loaderData} />
      <ContentSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TechnologiesSection />
      <Footer />
    </>
  );
}
