import { SignUp } from "@clerk/react-router";
import { useSearchParams } from "react-router";

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
