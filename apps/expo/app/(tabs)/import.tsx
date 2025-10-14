import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useShareIntentContext } from 'expo-share-intent';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@audora/backend/convex/_generated/api';
import type { Id } from '@audora/backend/convex/_generated/dataModel';

type ProcessingStage = 
  | 'selecting-friend'
  | 'uploading'
  | 'transcribing'
  | 'analyzing'
  | 'complete'
  | 'error';

export default function ImportScreen() {
  const { hasShareIntent, shareIntent, resetShareIntent, error: shareError } = useShareIntentContext();
  const router = useRouter();

  const [selectedFriend, setSelectedFriend] = useState<Id<"users"> | null>(null);
  const [stage, setStage] = useState<ProcessingStage>('selecting-friend');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Select a friend to continue');
  const [audioFile, setAudioFile] = useState<any>(null);

  // Get user's network/contacts
  const contacts = useQuery(api.network.list) || [];
  
  // Mutations and actions
  const generateUploadUrl = useMutation(api.conversations.generateUploadUrl);
  const processImportedAudio = useAction(api.mobileImport.processImportedAudio);

  useEffect(() => {
    if (shareError) {
      Alert.alert('Error', shareError);
      resetShareIntent();
      router.back();
      return;
    }

    if (hasShareIntent && shareIntent) {
      extractAudioFile();
    }
  }, [hasShareIntent, shareIntent, shareError]);

  const extractAudioFile = () => {
    try {
      // Filter for audio files
      const audioFiles = shareIntent.files?.filter(file =>
        file.mimeType?.startsWith('audio/') ||
        file.fileName?.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i)
      ) || [];

      if (audioFiles.length === 0) {
        Alert.alert('No Audio Files', 'Please share an audio file to import.');
        resetShareIntent();
        router.back();
        return;
      }

      // Take the first audio file
      const file = audioFiles[0];
      setAudioFile(file);
      setStatusMessage(`Ready to import: ${file.fileName}`);
      console.log('Audio file ready:', {
        path: file.path,
        fileName: file.fileName,
        mimeType: file.mimeType,
        size: file.size,
      });
    } catch (err) {
      console.error('Error extracting audio file:', err);
      Alert.alert('Error', 'Failed to process the shared file.');
      resetShareIntent();
      router.back();
    }
  };

  const handleFriendSelect = (friendId: Id<"users">) => {
    setSelectedFriend(friendId);
  };

  const handleStartImport = async () => {
    if (!selectedFriend || !audioFile) {
      Alert.alert('Error', 'Please select a friend and ensure an audio file is loaded.');
      return;
    }

    try {
      // Stage 1: Upload audio file
      setStage('uploading');
      setProgress(10);
      setStatusMessage('Uploading audio file...');

      // Read the file as blob
      const response = await fetch(audioFile.path);
      const blob = await response.blob();

      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();
      
      // Upload to Convex storage
      const uploadResult = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': audioFile.mimeType || 'audio/mpeg' },
        body: blob,
      });

      if (!uploadResult.ok) {
        throw new Error('Failed to upload audio file');
      }

      const { storageId } = await uploadResult.json();
      setProgress(25);
      setStatusMessage('Audio uploaded successfully!');

      // Stage 2: Process audio (transcribe + analyze)
      setStage('transcribing');
      setProgress(30);
      setStatusMessage('Transcribing audio... This may take a few minutes.');

      const result = await processImportedAudio({
        storageId: storageId as Id<"_storage">,
        friendId: selectedFriend,
        location: 'Imported from Mobile',
      });

      // Stage 3: Complete
      setStage('complete');
      setProgress(100);
      setStatusMessage('Import complete!');

      // Show success message and navigate
      Alert.alert(
        'Success!',
        'Your conversation has been imported and analyzed.',
        [
          {
            text: 'View Conversation',
            onPress: () => {
              resetShareIntent();
              router.replace(`/(tabs)`); // Navigate to conversations list
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Import failed:', err);
      setStage('error');
      setStatusMessage(`Error: ${err.message}`);
      Alert.alert(
        'Import Failed',
        err.message || 'An error occurred while importing the audio file.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setStage('selecting-friend');
              setProgress(0);
              setStatusMessage('Select a friend to continue');
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              resetShareIntent();
              router.back();
            },
          },
        ]
      );
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Import',
      'Are you sure you want to cancel?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => {
            resetShareIntent();
            router.back();
          },
        },
      ]
    );
  };

  if (stage === 'selecting-friend') {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Import Audio Conversation</Text>
            <Text style={styles.subtitle}>
              {audioFile ? `File: ${audioFile.fileName}` : 'Loading...'}
            </Text>
            {audioFile && (
              <Text style={styles.fileSize}>
                Size: {((audioFile.size || 0) / 1024 / 1024).toFixed(2)} MB
              </Text>
            )}
          </View>

          {/* Friend Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Friend</Text>
            <Text style={styles.sectionSubtitle}>Who was in this conversation with you?</Text>

            {contacts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No contacts found</Text>
                <Text style={styles.emptySubtext}>
                  Add friends to your network first
                </Text>
              </View>
            ) : (
              <View style={styles.contactsList}>
                {contacts.map((contact) => (
                  <TouchableOpacity
                    key={contact.contactId}
                    style={[
                      styles.contactItem,
                      selectedFriend === contact.contactId && styles.contactItemSelected,
                    ]}
                    onPress={() => handleFriendSelect(contact.contactId)}
                  >
                    {contact.image ? (
                      <Image source={{ uri: contact.image }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                          {contact.name?.charAt(0) || contact.email?.charAt(0) || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{contact.name || 'Unknown'}</Text>
                      <Text style={styles.contactEmail}>{contact.email}</Text>
                    </View>
                    {selectedFriend === contact.contactId && (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleCancel}
            >
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonPrimary,
                !selectedFriend && styles.buttonDisabled,
              ]}
              onPress={handleStartImport}
              disabled={!selectedFriend}
            >
              <Text style={styles.buttonPrimaryText}>Import</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Processing stages
  return (
    <View style={styles.container}>
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.processingTitle}>{statusMessage}</Text>
        
        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{progress}%</Text>

        {/* Stage Indicators */}
        <View style={styles.stagesContainer}>
          <View style={styles.stageItem}>
            <View style={[styles.stageDot, (stage === 'transcribing' || stage === 'analyzing' || stage === 'complete') && styles.stageDotComplete]} />
            <Text style={styles.stageText}>Upload</Text>
          </View>
          <View style={styles.stageItem}>
            <View style={[
              styles.stageDot,
              (stage === 'analyzing' || stage === 'complete') && styles.stageDotComplete,
            ]} />
            <Text style={styles.stageText}>Transcribe</Text>
          </View>
          <View style={styles.stageItem}>
            <View style={[styles.stageDot, stage === 'complete' && styles.stageDotComplete]} />
            <Text style={styles.stageText}>Analyze</Text>
          </View>
        </View>

        {stage === 'transcribing' && (
          <Text style={styles.hint}>
            This may take a few minutes depending on the audio length
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: '#999',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  contactsList: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  contactItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  contactEmail: {
    fontSize: 14,
    color: '#666',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  processingTitle: {
    marginTop: 24,
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginTop: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  stagesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 32,
  },
  stageItem: {
    alignItems: 'center',
  },
  stageDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    marginBottom: 8,
  },
  stageDotComplete: {
    backgroundColor: '#007AFF',
  },
  stageText: {
    fontSize: 12,
    color: '#666',
  },
  hint: {
    marginTop: 24,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
