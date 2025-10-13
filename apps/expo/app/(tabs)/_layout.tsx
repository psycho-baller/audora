import { useEffect } from 'react';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useShareIntentContext } from 'expo-share-intent';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isSignedIn } = useAuth();
  const { hasShareIntent } = useShareIntentContext();
  const router = useRouter();

  // Redirect to import screen when share intent is detected
  useEffect(() => {
    if (hasShareIntent && isSignedIn) {
      router.push('/(tabs)/import');
    }
  }, [hasShareIntent, isSignedIn]);

  if (!isSignedIn) {
    console.log("not signed in")
    return <Redirect href="/" />;
  }

  console.log("signed in")
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
