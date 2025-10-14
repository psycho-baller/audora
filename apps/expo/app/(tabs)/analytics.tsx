import { View, Text, ScrollView, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@audora/backend/convex/_generated/api';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AnalyticsScreen() {
  const dashboardData = useQuery(api.analytics.getUserDashboard);

  if (!dashboardData) {
    return (
      <SafeAreaView style={styles.container} className="bg-background" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="text-muted-foreground mt-4">Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { overview, performanceTrend, fillerTrend, topKeywords, recentConversations } = dashboardData;

  const avgScore = Math.round((overview.avgClarity + overview.avgConciseness + overview.avgConfidence) / 3);
  const wordsPerMin = overview.totalMinutes > 0 ? Math.round(overview.totalWords / overview.totalMinutes) : 0;

  return (
    <SafeAreaView style={styles.container} className="bg-background" edges={['bottom']}>
      <ScrollView className="px-4 py-6">
        {/* Overview Cards */}
        <View className="gap-3 mb-6">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-xl p-4 border border-blue-700/50">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-blue-300">Conversations</Text>
                <Text className="text-2xl">💬</Text>
              </View>
              <Text className="text-3xl font-bold text-white">{overview.totalConversations}</Text>
              <Text className="text-xs text-blue-300 mt-1">{overview.completedConversations} completed</Text>
            </View>

            <View className="flex-1 bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-xl p-4 border border-purple-700/50">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-purple-300">Words</Text>
                <Text className="text-2xl">📝</Text>
              </View>
              <Text className="text-3xl font-bold text-white">{overview.totalWords.toLocaleString()}</Text>
              <Text className="text-xs text-purple-300 mt-1">{wordsPerMin} words/min</Text>
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-xl p-4 border border-green-700/50">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-green-300">Time</Text>
                <Text className="text-2xl">⏱️</Text>
              </View>
              <Text className="text-3xl font-bold text-white">{overview.totalMinutes}</Text>
              <Text className="text-xs text-green-300 mt-1">minutes recorded</Text>
            </View>

            <View className="flex-1 bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 rounded-xl p-4 border border-yellow-700/50">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-yellow-300">Avg Score</Text>
                <Text className="text-2xl">⭐</Text>
              </View>
              <Text className="text-3xl font-bold text-white">{avgScore}</Text>
              <Text className="text-xs text-yellow-300 mt-1">out of 100</Text>
            </View>
          </View>
        </View>

        {/* Performance Scores */}
        <View className="bg-card border border-border rounded-xl p-4 mb-6">
          <Text className="text-xl font-bold text-foreground mb-4">Performance Scores</Text>

          <View className="gap-4">
            {/* Clarity */}
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-foreground">Clarity</Text>
                <Text className="text-2xl font-bold text-blue-400">{overview.avgClarity}</Text>
              </View>
              <View className="h-2 bg-muted rounded-full overflow-hidden">
                <View
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${overview.avgClarity}%` }}
                />
              </View>
            </View>

            {/* Conciseness */}
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-foreground">Conciseness</Text>
                <Text className="text-2xl font-bold text-purple-400">{overview.avgConciseness}</Text>
              </View>
              <View className="h-2 bg-muted rounded-full overflow-hidden">
                <View
                  className="h-full bg-purple-400 rounded-full"
                  style={{ width: `${overview.avgConciseness}%` }}
                />
              </View>
            </View>

            {/* Confidence */}
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-foreground">Confidence</Text>
                <Text className="text-2xl font-bold text-green-400">{overview.avgConfidence}</Text>
              </View>
              <View className="h-2 bg-muted rounded-full overflow-hidden">
                <View
                  className="h-full bg-green-400 rounded-full"
                  style={{ width: `${overview.avgConfidence}%` }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Top Keywords */}
        {topKeywords.length > 0 && (
          <View className="bg-card border border-border rounded-xl p-4 mb-6">
            <Text className="text-xl font-bold text-foreground mb-4">Top Topics</Text>
            <View className="gap-3">
              {topKeywords.slice(0, 5).map((keyword, index) => (
                <View key={index} className="flex-row items-center gap-3">
                  <View className="w-8 h-8 rounded-full bg-purple-500/20 items-center justify-center">
                    <Text className="text-sm font-bold text-purple-400">{index + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground mb-1">{keyword.word}</Text>
                    <View className="h-2 bg-muted rounded-full overflow-hidden">
                      <View
                        className="h-full bg-purple-400 rounded-full"
                        style={{ width: `${(keyword.count / topKeywords[0].count) * 100}%` }}
                      />
                    </View>
                  </View>
                  <Text className="text-sm font-semibold text-muted-foreground">{keyword.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Conversations */}
        {recentConversations.length > 0 && (
          <View className="bg-card border border-border rounded-xl p-4 mb-6">
            <Text className="text-xl font-bold text-foreground mb-4">Recent Activity</Text>
            <View className="gap-3">
              {recentConversations.map((conv, idx) => (
                <View key={conv.id} className="flex-row items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <View className="w-10 h-10 bg-blue-500/20 rounded-full items-center justify-center">
                    <Text className="text-blue-400 font-semibold">{idx + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                      {conv.location || 'Conversation'}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {conv.startedAt ? new Date(conv.startedAt).toLocaleDateString() : 'Unknown date'}
                      {conv.endedAt && conv.startedAt
                        ? ` • ${Math.round((conv.endedAt - conv.startedAt) / 60000)} min`
                        : ' • In progress'}
                    </Text>
                  </View>
                  <View className={`px-2 py-1 rounded-full ${
                    conv.status === 'ended'
                      ? 'bg-green-500/20'
                      : 'bg-yellow-500/20'
                  }`}>
                    <Text className={`text-xs font-medium ${
                      conv.status === 'ended'
                        ? 'text-green-400'
                        : 'text-yellow-400'
                    }`}>
                      {conv.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {overview.totalConversations === 0 && (
          <View className="flex-1 items-center justify-center py-12">
            <View className="w-16 h-16 rounded-full bg-muted items-center justify-center mb-4">
              <Text className="text-3xl">📊</Text>
            </View>
            <Text className="text-lg font-semibold text-foreground mb-2">No data yet</Text>
            <Text className="text-sm text-muted-foreground text-center max-w-sm px-4">
              Start having conversations to see your analytics and performance metrics
            </Text>
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
  scrollView: {
    flex: 1,
  },
});
