import { SignIn } from "@clerk/react-router";
import { useSearchParams } from "react-router";

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
