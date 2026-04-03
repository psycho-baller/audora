import { getAuth } from "@clerk/react-router/ssr.server";
import { SignUp } from "@clerk/react-router";
import { redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/sign-up";

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);

  // If already signed in, redirect to dashboard
  if (userId) {
    throw redirect("/dashboard");
  }

  return null;
}

export default function SignUpPage() {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");

  return (
    <div className="flex items-center justify-center h-screen">
      <SignUp
        fallbackRedirectUrl={redirectUrl || undefined}
        signInUrl={redirectUrl ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}` : undefined}
      />
    </div>
  );
}
