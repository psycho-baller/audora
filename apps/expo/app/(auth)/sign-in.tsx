import { useOAuth, useSSO } from '@clerk/clerk-expo'
import * as AuthSession from 'expo-auth-session'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useEffect } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button } from '@/components/button'

// Preloads the browser for Android devices to reduce authentication load time
// See: https://docs.expo.dev/guides/authentication/#improving-user-experience
export const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== 'android') return
    void WebBrowser.warmUpAsync()
    return () => {
      // Cleanup: closes browser when component unmounts
      void WebBrowser.coolDownAsync()
    }
  }, [])
}

// Handle any pending authentication sessions
WebBrowser.maybeCompleteAuthSession()

export default function Page() {
  useWarmUpBrowser()
  const router = useRouter()

  // Android: Use useOAuth (simpler, more reliable)
  const { startOAuthFlow } = useOAuth({
    strategy: 'oauth_google',
  })

  // iOS: Use useSSO (supports more advanced features)
  const { startSSOFlow } = useSSO()

  const onPress = useCallback(async () => {
    try {
      console.log("onPress - Platform:", Platform.OS)

      if (Platform.OS === 'android') {
        // Android: Use useOAuth
        const { createdSessionId, setActive } = await startOAuthFlow()

        console.log("createdSessionId", createdSessionId)

        if (createdSessionId) {
          setActive!({ session: createdSessionId })
          console.log("Session activated, navigating to home")
          router.replace('/(tabs)/conversations')
        } else {
          console.log("createdSessionId doesn't exist")
        }
      } else {
        // iOS: Use useSSO
        const { createdSessionId, setActive, signIn, signUp, authSessionResult } = await startSSOFlow({
          strategy: 'oauth_google',
          authSessionOptions: {
            showInRecents: true,
          },
          redirectUrl: AuthSession.makeRedirectUri({
            scheme: 'audora',
          }),
        })

        console.log("createdSessionId", createdSessionId)
        console.log("authSessionResult", authSessionResult)

        if (createdSessionId) {
          setActive!({
            session: createdSessionId,
            navigate: async ({ session }) => {
              if (session?.currentTask) {
                console.log(session?.currentTask)
              }
              router.replace('/(tabs)/conversations')
            },
          })
        } else {
          console.log("createdSessionId doesn't exist")
        }
      }
    } catch (err) {
      console.error("OAuth error", err)
    }
  }, [router, startOAuthFlow, startSSOFlow])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Button title="Sign in with Google" onPress={onPress} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
})