import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/clerk-expo';
import { CLERK_PUBLISHABLE_KEY } from '@/lib/auth/config';
import { tokenCache } from '@/lib/auth/token-cache';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider
 * Wraps the app with Clerk authentication context
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      {children}
    </ClerkProvider>
  );
}
