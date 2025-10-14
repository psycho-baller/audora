import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import ImportAudio from '@/components/conversations/import-audio';

export default function ImportScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ImportAudio />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
