import { SignIn } from "@clerk/react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/sign-in";

function getCookieFromRequest(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const cookie = cookies.find((c) => c.startsWith(`${name}=`));
  return cookie ? cookie.split("=")[1] : null;
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);

  // If already signed in, redirect to dashboard
  if (userId) {
    throw redirect("/dashboard");
  }

  const isProd = process.env.NODE_ENV === "production";

  // In production, check for invite code or allowlist
  if (isProd) {
    const inviteCode = getCookieFromRequest(args.request, "invite_code");
    const allowlist = (process.env.ALLOWLIST_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // If no invite code and allowlist is set, we can't verify yet (user hasn't signed in)
    // So we only block if there's no invite code at all
    if (!inviteCode && allowlist.length === 0) {
      throw redirect("/waitlist?need_invite=1");
    }
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
