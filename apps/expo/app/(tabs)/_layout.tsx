import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { hasShareIntent } = useShareIntentContext();
  const router = useRouter();

  // Redirect to import screen when share intent is detected
  useEffect(() => {
    if (hasShareIntent) {
      router.push('/(tabs)/import');
    }
  }, [hasShareIntent]);

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
