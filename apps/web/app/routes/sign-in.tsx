import { SignIn } from "@clerk/react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/sign-in";

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);

  // If already signed in, redirect to dashboard
  if (userId) {
    throw redirect("/dashboard");
  }

  return null;
}

export default function SignInPage() {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");

  return (
    <div className="flex items-center justify-center h-screen">
      <SignIn
        fallbackRedirectUrl={redirectUrl || undefined}
        signUpUrl={redirectUrl ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}` : undefined}
      />
    </div>
  );
}
