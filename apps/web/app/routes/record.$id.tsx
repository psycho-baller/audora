import type { Id } from "@audora/backend/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";

/**
 * DEPRECATED: This route is deprecated. 
 * All conversation functionality has been moved to /dashboard/conversations/:id
 * This component redirects to the new location.
 */
export default function ConversationPage() {
  const { id } = useParams<{ id: Id<"conversations"> }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      // Redirect to the conversations page
      navigate(`/dashboard/conversations/${id}`, { replace: true });
    } else {
      // No ID, go to dashboard
      navigate("/dashboard", { replace: true });
    }
  }, [id, navigate]);

  // Show loading while redirecting
  return (
    <div className="h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
