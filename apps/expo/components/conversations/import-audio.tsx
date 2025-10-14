import { api } from '@audora/backend/convex/_generated/api';
import type { Id } from '@audora/backend/convex/_generated/dataModel';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
      <View className="flex-1 bg-background">
        <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8">
          {/* File Info Card */}
          {audioFile && (
            <View className="flex-row items-center bg-card rounded-2xl p-4 mb-6 border border-border shadow-sm">
              <View className="w-14 h-14 rounded-xl bg-primary/10 items-center justify-center mr-3">
                <Text className="text-3xl">🎵</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground mb-1" numberOfLines={1}>
                  {audioFile.fileName}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {((audioFile.size || 0) / 1024 / 1024).toFixed(2)} MB
                </Text>
              </View>
            </View>
          )}

          {/* Conversation Type Selection */}
          <View className="mb-6">
            <Text className="text-xl font-bold text-foreground mb-2">Who was in this conversation?</Text>
            <Text className="text-sm text-muted-foreground mb-5 leading-5">
              Select the person you were talking with, or mark it as a solo recording
            </Text>

            {/* Solo Conversation Option */}
            <TouchableOpacity
              className={`flex-row items-center bg-card rounded-2xl p-3 border-2 gap-4 ${
                isSoloConversation ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onPress={handleSoloSelect}
              activeOpacity={0.7}
            >
              <View className="w-12 h-12 rounded-xl bg-muted items-center justify-center">
                <Text className="text-3xl">🎙️</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground mb-1">Solo Recording</Text>
                <Text className="text-sm text-muted-foreground">Just me talking</Text>
              </View>
              {isSoloConversation && (
                <View className="w-8 h-8 rounded-full bg-primary items-center justify-center ml-2">
                  <Text className="text-white text-lg font-bold">✓</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center my-5">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-xs font-semibold text-muted-foreground mx-3 uppercase tracking-wider">OR</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {/* Contacts List */}
            {contacts.length === 0 ? (
              <View className="items-center py-10 px-6 bg-card rounded-2xl border-2 border-dashed border-border">
                <Text className="text-5xl mb-3">👥</Text>
                <Text className="text-base font-semibold text-foreground mb-1">No contacts found</Text>
                <Text className="text-sm text-muted-foreground text-center">
                  Add friends to your network to tag them in conversations
                </Text>
              </View>
            ) : (
              <View>
                <Text className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Select a contact</Text>
                {contacts.map((contact) => (
                  <TouchableOpacity
                    key={contact.contactId}
                    className={`flex-row items-center bg-card rounded-2xl p-3 border-2 gap-4 ${
                      selectedFriend === contact.contactId ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                    onPress={() => handleFriendSelect(contact.contactId)}
                    activeOpacity={0.7}
                  >
                    {contact.image ? (
                      <Image source={{ uri: contact.image }} className="w-12 h-12 rounded-xl" />
                    ) : (
                      <View className="w-12 h-12 rounded-xl bg-primary items-center justify-center mr-4">
                        <Text className="text-white text-xl font-bold">
                          {contact.name?.charAt(0) || contact.email?.charAt(0) || '?'}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground mb-1">{contact.name || 'Unknown'}</Text>
                      <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                        {contact.email}
                      </Text>
                    </View>
                    {selectedFriend === contact.contactId && (
                      <View className="w-8 h-8 rounded-full bg-primary items-center justify-center ml-2">
                        <Text className="text-white text-lg font-bold">✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            className={`w-full rounded-xl py-6 items-center justify-center mt-4 ${
              (!selectedFriend && !isSoloConversation) ? 'bg-muted' : 'bg-primary'
            }`}
            onPress={handleStartImport}
            disabled={!selectedFriend && !isSoloConversation}
            activeOpacity={0.7}
          >
            <Text className="text-primary-foreground text-2xl font-bold">
              {(!selectedFriend && !isSoloConversation) ? 'Select an option' : 'Start Import'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Processing stages
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 justify-center items-center px-8">
        <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-6">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>

        <Text className="text-lg font-semibold text-foreground text-center mb-6">{statusMessage}</Text>

        {/* Progress Bar */}
        <View className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <View className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
        </View>
        <Text className="mt-3 text-base font-semibold text-primary">{progress}%</Text>

        {/* Stage Indicators */}
        <View className="flex-row items-center justify-center w-full mt-10 px-5">
          <View className="items-center">
            <View className={`w-4 h-4 rounded-full mb-2 ${
              (stage === 'transcribing' || stage === 'analyzing' || stage === 'complete') ? 'bg-primary' : 'bg-muted'
            }`} />
            <Text className="text-xs font-medium text-muted-foreground">Upload</Text>
          </View>
          <View className="w-10 h-0.5 bg-border mx-2" />
          <View className="items-center">
            <View className={`w-4 h-4 rounded-full mb-2 ${
              (stage === 'analyzing' || stage === 'complete') ? 'bg-primary' : 'bg-muted'
            }`} />
            <Text className="text-xs font-medium text-muted-foreground">Transcribe</Text>
          </View>
          <View className="w-10 h-0.5 bg-border mx-2" />
          <View className="items-center">
            <View className={`w-4 h-4 rounded-full mb-2 ${
              stage === 'complete' ? 'bg-primary' : 'bg-muted'
            }`} />
            <Text className="text-xs font-medium text-muted-foreground">Analyze</Text>
          </View>
        </View>

        {stage === 'transcribing' && (
          <View className="mt-8 px-6">
            <Text className="text-sm text-muted-foreground text-center leading-5">
              ⏱️ This may take a few minutes depending on the audio length
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
