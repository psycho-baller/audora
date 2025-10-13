import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useShareIntentContext } from 'expo-share-intent';
import { useRouter } from 'expo-router';

export default function ImportScreen() {
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntentContext();
  const router = useRouter();

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      resetShareIntent();
      router.back();
      return;
    }

    if (hasShareIntent && shareIntent) {
      handleSharedContent();
    }
  }, [hasShareIntent, shareIntent, error]);

  const handleSharedContent = async () => {
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

      // Process each audio file
      for (const audioFile of audioFiles) {
        console.log('Processing audio file:', {
          path: audioFile.path,
          fileName: audioFile.fileName,
          mimeType: audioFile.mimeType,
          size: audioFile.size,
        });

        // TODO: Call your backend function here
        // Example:
        // await uploadAudioToBackend(audioFile);
        console.log('Processing audio file:', {
          path: audioFile.path,
          fileName: audioFile.fileName,
          mimeType: audioFile.mimeType,
          size: audioFile.size,
        });

        Alert.alert(
          'Audio File Received',
          `File: ${audioFile.fileName}\nSize: ${((audioFile.size || 0) / 1024 / 1024).toFixed(2)} MB`,
          [
            {
              text: 'OK',
              onPress: () => {
                resetShareIntent();
                router.replace('/(tabs)');
              },
            },
          ]
        );
      }
    } catch (err) {
      console.error('Error handling shared content:', err);
      Alert.alert('Error', 'Failed to process the shared file.');
      resetShareIntent();
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.text}>Processing shared audio...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
