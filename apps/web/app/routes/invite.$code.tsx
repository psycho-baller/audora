import { api } from "@audora/backend/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { redirect } from "react-router";
import type { Route } from "./+types/invite.$code";

export async function loader(args: Route.LoaderArgs) {
  const { code } = args.params;

  console.log("code", code);

  // The regular expression tests whether the `code` string is composed of 4 digits.
  // The `^` and `$` anchors ensure that the entire string matches the pattern.
  // The `\d` shorthand class matches any digit character.
  // The `{4}` quantifier ensures that exactly 4 digits are matched.
  if (!code || !/^[\d]{4}$/.test(code)) {
    console.log("Invalid invite code");
    throw redirect("/waitlist?invalid_invite=1");
  }

  // Validate invite code via Convex
  const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!);
  const user = await convex.query(api.users.getUserByInviteCode, { code });

  console.log("user", user);

  if (!user) {
    console.log("User not found");
    throw redirect("/waitlist?invalid_invite=1");
  }

  // Set cookie and redirect to sign-in
  // Note: Removed HttpOnly so client-side UserSync can read it for referral tracking (3 months)
  const cookieValue = `invite_code=${code}; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30 * 2}`;

  console.log("cookieValue", cookieValue);
  throw redirect("/sign-in?redirect_url=/dashboard", {
    headers: {
      "Set-Cookie": cookieValue,
    },
  });
}

export default function InvitePage() {
  // This component should never render as the loader always redirects
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#343D40] to-[#131519] text-white">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p>Validating invite code...</p>
      </div>
    </div>
  );
}
