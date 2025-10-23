import { api } from "@audora/backend/convex/_generated/api";
import { useAuth } from "@clerk/react-router";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

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
      const invitedByCode = getCookie("invite_code");
      upsertUser({ invitedByCode: invitedByCode || undefined })
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
  }, [isSignedIn, upsertUser]);

  // This component doesn't render anything
  return null;
}
