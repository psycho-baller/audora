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

export default function ImportAudio() {
  const { hasShareIntent, shareIntent, resetShareIntent, error: shareError } = useShareIntentContext();
  const router = useRouter();

  const [selectedFriend, setSelectedFriend] = useState<Id<"users"> | null>(null);
  const [isSoloConversation, setIsSoloConversation] = useState(false);
  const [stage, setStage] = useState<ProcessingStage>('selecting-friend');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Select a friend or choose solo conversation');
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
    setIsSoloConversation(false);
  };

  const handleSoloSelect = () => {
    setSelectedFriend(null);
    setIsSoloConversation(true);
  };

  const handleStartImport = async () => {
    if ((!selectedFriend && !isSoloConversation) || !audioFile) {
      Alert.alert('Error', 'Please select a friend or solo conversation, and ensure an audio file is loaded.');
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
        friendId: selectedFriend || undefined,
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
              router.replace('/(tabs)/conversations');
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
              setStatusMessage('Select a friend or choose solo conversation');
              setIsSoloConversation(false);
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
          {/* File Info Card */}
          {audioFile && (
            <View style={styles.fileCard}>
              <View style={styles.fileIconContainer}>
                <Text style={styles.fileIcon}>🎵</Text>
              </View>
              <View style={styles.fileDetails}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {audioFile.fileName}
                </Text>
                <Text style={styles.fileSize}>
                  {((audioFile.size || 0) / 1024 / 1024).toFixed(2)} MB
                </Text>
              </View>
            </View>
          )}

          {/* Conversation Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Who was in this conversation?</Text>
            <Text style={styles.sectionSubtitle}>
              Select the person you were talking with, or mark it as a solo recording
            </Text>

            {/* Solo Conversation Option */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                isSoloConversation && styles.optionCardSelected,
              ]}
              onPress={handleSoloSelect}
              activeOpacity={0.7}
            >
              <View style={styles.optionIconContainer}>
                <Text style={styles.optionIcon}>🎙️</Text>
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Solo Recording</Text>
                <Text style={styles.optionDescription}>Just me talking</Text>
              </View>
              {isSoloConversation && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Contacts List */}
            {contacts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyText}>No contacts found</Text>
                <Text style={styles.emptySubtext}>
                  Add friends to your network to tag them in conversations
                </Text>
              </View>
            ) : (
              <View style={styles.contactsList}>
                <Text style={styles.contactsHeader}>Select a contact</Text>
                {contacts.map((contact) => (
                  <TouchableOpacity
                    key={contact.contactId}
                    style={[
                      styles.optionCard,
                      selectedFriend === contact.contactId && styles.optionCardSelected,
                    ]}
                    onPress={() => handleFriendSelect(contact.contactId)}
                    activeOpacity={0.7}
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
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>{contact.name || 'Unknown'}</Text>
                      <Text style={styles.optionDescription} numberOfLines={1}>
                        {contact.email}
                      </Text>
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
              activeOpacity={0.7}
            >
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonPrimary,
                (!selectedFriend && !isSoloConversation) && styles.buttonDisabled,
              ]}
              onPress={handleStartImport}
              disabled={!selectedFriend && !isSoloConversation}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonPrimaryText}>
                {(!selectedFriend && !isSoloConversation) ? 'Select an option' : 'Start Import'}
              </Text>
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
        <View style={styles.processingIconContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
        
        <Text style={styles.processingTitle}>{statusMessage}</Text>
        
        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{progress}%</Text>

        {/* Stage Indicators */}
        <View style={styles.stagesContainer}>
          <View style={styles.stageItem}>
            <View style={[
              styles.stageDot,
              (stage === 'transcribing' || stage === 'analyzing' || stage === 'complete') && styles.stageDotComplete
            ]} />
            <Text style={styles.stageText}>Upload</Text>
          </View>
          <View style={styles.stageLine} />
          <View style={styles.stageItem}>
            <View style={[
              styles.stageDot,
              (stage === 'analyzing' || stage === 'complete') && styles.stageDotComplete,
            ]} />
            <Text style={styles.stageText}>Transcribe</Text>
          </View>
          <View style={styles.stageLine} />
          <View style={styles.stageItem}>
            <View style={[styles.stageDot, stage === 'complete' && styles.stageDotComplete]} />
            <Text style={styles.stageText}>Analyze</Text>
          </View>
        </View>

        {stage === 'transcribing' && (
          <View style={styles.hintContainer}>
            <Text style={styles.hint}>
              ⏱️ This may take a few minutes depending on the audio length
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fileIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileIcon: {
    fontSize: 28,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  optionCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF08',
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionIcon: {
    fontSize: 24,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginHorizontal: 12,
  },
  contactsList: {
    gap: 0,
  },
  contactsHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
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
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  buttonDisabled: {
    backgroundColor: '#e5e7eb',
    shadowOpacity: 0,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  processingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 24,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  stagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  stageItem: {
    alignItems: 'center',
  },
  stageLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  stageDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    marginBottom: 8,
  },
  stageDotComplete: {
    backgroundColor: '#007AFF',
  },
  stageText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  hintContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
