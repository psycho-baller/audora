import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ShareIntentProvider } from 'expo-share-intent';
import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import ConvexClientProvider from '@/providers/convex-client-provider';

import "../global.css"

function RootLayoutNav() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (isSignedIn && inAuthGroup) {
      // Redirect authenticated users away from auth screens
      router.replace('/(tabs)');
    } else if (!isSignedIn && inTabsGroup) {
      // Redirect unauthenticated users to sign in
      router.replace('/(auth)/sign-in');
    } else if (!isSignedIn && !inAuthGroup && !inTabsGroup) {
      // Initial load: redirect to appropriate screen
      router.replace('/(auth)/sign-in');
    } else if (isSignedIn && !inAuthGroup && !inTabsGroup) {
      // Initial load for authenticated users
      router.replace('/(tabs)');
    }
  }, [isSignedIn, segments, isLoaded]);

  return <Slot />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ShareIntentProvider>
      <ConvexClientProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootLayoutNav />
          <StatusBar style="auto" />
        </ThemeProvider>
      </ConvexClientProvider>
    </ShareIntentProvider>
  );
}
