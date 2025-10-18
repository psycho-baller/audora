import { useParams, useSearchParams, useNavigate } from "react-router";
import { useAuth, SignIn } from "@clerk/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useEffect, useState } from "react";

export default function JoinPage() {
  const { id } = useParams<{ id: Id<"conversations"> }>();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();
  const claimScanner = useMutation(api.conversations.claimScanner);
  const conversation = useQuery(
    api.conversations.get,
    id ? { id: id as Id<"conversations"> } : "skip"
  );
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn && id && code && conversation && !claimed) {
      handleClaim();
    }
  }, [isSignedIn, id, code, conversation, claimed]);

  const handleClaim = async () => {
    if (!id || !code) return;

    try {
      await claimScanner({
        conversationId: id as Id<"conversations">,
        inviteCode: code,
      });
      setClaimed(true);
      // Redirect to conversation page
      setTimeout(() => {
        navigate(`/dashboard/conversations/${id}`);
      }, 1000);
    } catch (err: any) {
      console.error("Failed to claim scanner:", err);
      setError(err.message || "Failed to join conversation");
    }
  };

  // Show loading while auth is loading
  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#343D40] to-[#131519] text-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If not signed in, show sign-in UI
  if (!isSignedIn) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#343D40] to-[#131519] text-white">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Join Conversation</h1>
          <p className="text-gray-300">
            Sign in to give your consent and join this conversation
          </p>
        </div>
        <div className="max-w-md w-full">
          <SignIn
            routing="hash"
            signUpUrl={`/sign-up?redirect_url=${encodeURIComponent(`/join/${id}?code=${code}`)}`}
            forceRedirectUrl={`/join/${id}?code=${code}`}
            signUpForceRedirectUrl={`/join/${id}?code=${code}`}
          />
        </div>
      </div>
    );
  }

  // Show error if any
  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-white bg-gradient-to-b from-[#343D40] to-[#131519]">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-400">Failed to Join</h1>
          <p className="text-gray-300">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-lg text-white font-medium">
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Show success message
  if (claimed) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#343D40] to-[#131519] text-white">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Successfully Joined!</h1>
          <p className="text-gray-300">Redirecting to conversation...</p>
        </div>
      </div>
    );
  }

  // Show processing
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#343D40] to-[#131519] text-white">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p>Joining conversation...</p>
      </div>
    </div>
  );
}
