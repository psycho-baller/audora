import { useAuth } from '@clerk/clerk-expo';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Slot, useSegments } from 'expo-router';
import { ShareIntentProvider, useShareIntent } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import ConvexClientProvider from '@/providers/convex-client-provider';

import "../global.css";

function RootLayoutNav() {
  useShareIntent()
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();

  // Wait for auth to load
  if (!isLoaded) {
    return null;
  }

  const inAuthGroup = segments[0] === '(auth)';
  const inTabsGroup = segments[0] === '(tabs)';

  // Redirect authenticated users away from auth screens
  if (isSignedIn && inAuthGroup) {
    return <Redirect href="/(tabs)/conversations" />;
  }

  // Redirect unauthenticated users to sign in
  if (!isSignedIn && inTabsGroup) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Initial load: redirect to appropriate screen
  if (!isSignedIn && !inAuthGroup && !inTabsGroup) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (isSignedIn && !inAuthGroup && !inTabsGroup) {
    return <Redirect href="/(tabs)/conversations" />;
  }

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
