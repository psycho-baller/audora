import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@audora/backend/convex/_generated/api';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ConversationsScreen() {
  const router = useRouter();
  const conversations = useQuery(api.conversations.list);
  const createConversation = useMutation(api.conversations.create);
  const [isCreating, setIsCreating] = useState(false);

  const handleStartRecording = async () => {
    try {
      setIsCreating(true);
      const result = await createConversation({
        location: 'New Conversation',
      });
      // TODO: Navigate to conversation detail screen
      console.log('Created conversation:', result.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 border-green-500';
      case 'ended':
        return 'bg-blue-500/20 border-blue-500';
      case 'pending':
        return 'bg-yellow-500/20 border-yellow-500';
      default:
        return 'bg-gray-500/20 border-gray-500';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500';
      case 'ended':
        return 'text-blue-500';
      case 'pending':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <SafeAreaView style={styles.container} className="bg-background" edges={['top']}>
      {/* Header */}
      <View className="border-b border-border bg-card/50 px-4 py-6">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-2xl font-bold text-foreground">Conversations</Text>
            <Text className="text-sm text-muted-foreground mt-1">
              Your recorded conversations
            </Text>
          </View>
        </View>

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/import')}
            disabled={isCreating}
            className="flex-1 bg-secondary border border-border rounded-lg px-4 py-3 flex-row items-center justify-center">
            <Text className="text-secondary-foreground font-semibold">📤 Import</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStartRecording}
            disabled={isCreating}
            className="flex-1 bg-primary rounded-lg px-4 py-3 flex-row items-center justify-center">
            {isCreating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-primary-foreground font-semibold">➕ New</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView  className="px-4 py-6">
        {conversations === undefined ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" />
            <Text className="text-muted-foreground mt-4">Loading conversations...</Text>
          </View>
        ) : conversations.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <View className="w-16 h-16 rounded-full bg-muted items-center justify-center mb-4">
              <Text className="text-3xl">📭</Text>
            </View>
            <Text className="text-lg font-semibold text-foreground mb-2">No conversations yet</Text>
            <Text className="text-sm text-muted-foreground text-center max-w-sm">
              Start your first conversation by tapping the New button above
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {conversations.map((conversation) => (
              <TouchableOpacity
                key={conversation._id}
                onPress={() => {
                  // TODO: Navigate to conversation detail
                  console.log('View conversation:', conversation._id);
                }}
                className="bg-card border border-border rounded-xl p-4">
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-row items-center gap-2 flex-1">
                    <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center">
                      <Text className="text-xl">💬</Text>
                    </View>
                    <View className={`px-2 py-1 rounded-full border ${getStatusColor(conversation.status)}`}>
                      <Text className={`text-xs font-medium ${getStatusTextColor(conversation.status)}`}>
                        {conversation.status}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-muted-foreground">›</Text>
                </View>

                <Text className="text-sm font-semibold text-foreground mb-2">
                  {conversation.location || `Conversation ${conversation._id.slice(0, 8)}`}
                </Text>

                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-muted-foreground">🕐</Text>
                  <Text className="text-xs text-muted-foreground">
                    {formatDate(conversation._creationTime)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
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
