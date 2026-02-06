import { api } from '@audora/backend/convex/_generated/api';
import { Id } from '@audora/backend/convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scrollViewRef = useRef<ScrollView>(null);

  const conversationId = id as Id<"conversations">;

  const conversation = useQuery(api.conversations.get, { id: conversationId });
  // @ts-ignore - API will be available after convex dev regenerates types
  const transcript = useQuery(api.streaming?.getTranscript, { conversationId });

  // Auto-scroll to bottom when transcript updates
  useEffect(() => {
    if (transcript && transcript.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [transcript?.length]);

  if (conversation === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (conversation === null) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Conversation not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: conversation.location || 'Conversation',
          headerBackTitle: 'Chats'
        }}
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {!transcript ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : transcript.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transcript yet...</Text>
            {conversation.status === 'active' && (
              <Text style={styles.subText}>Waiting for speech...</Text>
            )}
          </View>
        ) : (
          <View style={styles.transcriptContainer}>
            {transcript.map((turn: any) => (
              <View key={turn._id} style={styles.turnContainer}>
                <View style={[
                  styles.speakerAvatar,
                  turn.speaker === 'S1' ? styles.speakerS1 : styles.speakerS2
                ]}>
                  <Text style={styles.speakerInitials}>
                    {turn.speaker}
                  </Text>
                </View>
                <View style={styles.bubbleContainer}>
                  <Text style={styles.speakerName}>
                    {turn.speaker === 'S1' ? 'Speaker 1' : 'Speaker 2'}
                  </Text>
                  <Text style={styles.turnText}>{turn.text}</Text>
                </View>
              </View>
            ))}

            {conversation.status === 'active' && (
               <View style={styles.typingContainer}>
                 <ActivityIndicator size="small" color="#999" />
               </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#999',
  },
  transcriptContainer: {
    gap: 16,
  },
  turnContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  speakerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerS1: {
    backgroundColor: '#E0E7FF', // Indigo-100
  },
  speakerS2: {
    backgroundColor: '#DCFCE7', // Green-100
  },
  speakerInitials: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  bubbleContainer: {
    flex: 1,
  },
  speakerName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  turnText: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
  },
  typingContainer: {
    paddingTop: 8,
    alignItems: 'flex-start',
    paddingLeft: 48,
  }
});
