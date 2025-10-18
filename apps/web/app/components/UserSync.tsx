import { useAuth } from "@clerk/react-router";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";

/**
 * UserSync component ensures that authenticated users are created/updated
 * in the Convex database when they sign in with Clerk.
 *
 * This component should be mounted once at the root level of the application.
 */
export function UserSync() {
  const { isSignedIn } = useAuth();
  const upsertUser = useMutation(api.users.upsertUser);
  const syncedRef = useRef(false);

  useEffect(() => {
    // Only sync when signed in and haven't synced yet
    if (isSignedIn && !syncedRef.current) {
      upsertUser()
        .then(() => {
          syncedRef.current = true;
        })
        .catch((error) => {
          console.error("Failed to sync user to Convex:", error);
          // Reset sync flag to retry on next render
          syncedRef.current = false;
        });
    }

    // Reset sync flag when user signs out
    if (!isSignedIn) {
      syncedRef.current = false;
    }
  }, []);

  // This component doesn't render anything
  return null;
}
