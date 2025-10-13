import { useCallback, useEffect } from 'react'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { useOAuth, useSSO } from '@clerk/clerk-expo'
import { View, Button, Platform } from 'react-native'
import { useRouter } from 'expo-router'

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
          router.push('/')
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
              router.push('/')
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
    <View>
      <Button title="Sign in with Google" onPress={onPress} />
    </View>
  )
}