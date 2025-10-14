import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@audora/backend/convex/_generated/api';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NetworkScreen() {
  const router = useRouter();
  const connections = useQuery(api.network.list);

  const formatRelativeTime = (timestamp: number) => {
    const differenceMs = Date.now() - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;

    if (differenceMs < minute) return 'Just now';
    if (differenceMs < hour) {
      const minutes = Math.round(differenceMs / minute);
      return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
    }
    if (differenceMs < day) {
      const hours = Math.round(differenceMs / hour);
      return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    }
    if (differenceMs < week) {
      const days = Math.round(differenceMs / day);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(/\s+/);
      const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
      return initials.join('');
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return '?';
  };

  const formatInteractions = (count: number) => {
    if (count <= 0) return 'No exchanges yet';
    if (count === 1) return '1 exchange';
    return `${count} exchanges`;
  };

  return (
    <SafeAreaView style={styles.container} className="bg-background" edges={['top']}>
      {/* Header */}
      <View className="border-b border-border bg-card/50 px-4 py-6">
        <Text className="text-2xl font-bold text-foreground">Network</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          People you've connected with across conversations
        </Text>
      </View>

      {/* Content */}
      <ScrollView className="px-4 py-6">
        {connections === undefined ? (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator size="large" />
            <Text className="text-muted-foreground mt-4">Loading your network...</Text>
          </View>
        ) : connections.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <View className="w-16 h-16 rounded-full bg-muted items-center justify-center mb-4">
              <Text className="text-3xl">👥</Text>
            </View>
            <Text className="text-lg font-semibold text-foreground mb-2">No connections yet</Text>
            <Text className="text-sm text-muted-foreground text-center max-w-sm px-4">
              Once you complete conversations with other people, they will automatically show up here
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {connections.map((connection) => {
              const displayName = connection.name || connection.email || 'Unknown participant';
              const lastInteraction = formatRelativeTime(connection.lastInteractionAt);
              const transcriptsLabel = formatInteractions(connection.totalTurns);

              return (
                <TouchableOpacity
                  key={connection.contactId}
                  onPress={() => {
                    // TODO: Navigate to contact detail
                    console.log('View contact:', connection.contactId);
                  }}
                  className="bg-card border border-border rounded-xl p-4 active:opacity-70">
                  <View className="flex-row items-center gap-3 mb-3">
                    {/* Avatar */}
                    <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                      <Text className="text-base font-semibold text-primary">
                        {getInitials(connection.name, connection.email)}
                      </Text>
                    </View>

                    {/* Info */}
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-base font-semibold text-foreground">
                          {displayName}
                        </Text>
                        <View className="bg-secondary rounded-full px-2 py-0.5">
                          <Text className="text-xs font-medium text-secondary-foreground">
                            {connection.conversationCount} convo{connection.conversationCount === 1 ? '' : 's'}
                          </Text>
                        </View>
                      </View>
                      {connection.email ? (
                        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                          {connection.email}
                        </Text>
                      ) : null}
                    </View>

                    {/* Arrow */}
                    <Text className="text-muted-foreground">›</Text>
                  </View>

                  {/* Footer */}
                  <View className="flex-row items-center justify-between">
                    <View className="bg-muted rounded-full px-3 py-1">
                      <Text className="text-xs font-medium text-foreground">
                        {transcriptsLabel}
                      </Text>
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      {lastInteraction}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
