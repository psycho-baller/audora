import { useCallback, useEffect } from 'react'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { useSSO } from '@clerk/clerk-expo'
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

  // Use the `useSSO()` hook to access the `startSSOFlow()` method
  const { startSSOFlow } = useSSO()

  const onPress = useCallback(async () => {
    try {
      console.log("onPress")
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'audora',

      })
      console.log("Redirect URL:", redirectUrl)

      // Start the authentication process by calling `startSSOFlow()`
      const { createdSessionId, setActive, signIn, signUp, authSessionResult } = await startSSOFlow({
        strategy: 'oauth_google',
        authSessionOptions: {
          showInRecents: true,
        },
        // For web, defaults to current path
        // For native, you must pass a scheme, like AuthSession.makeRedirectUri({ scheme, path })
        // For more info, see https://docs.expo.dev/versions/latest/sdk/auth-session/#authsessionmakeredirecturioptions
        redirectUrl,
      })
      console.log("createdSessionId", createdSessionId)
      console.log("setActive", setActive)
      console.log("signIn", signIn)
      console.log("signUp", signUp)
      console.log("authSessionResult", authSessionResult)
      // If sign in was successful, set the active session
      if (createdSessionId) {
        setActive!({
          session: createdSessionId,
          // Check for session tasks and navigate to custom UI to help users resolve them
          // See https://clerk.com/docs/guides/development/custom-flows/overview#session-tasks
          navigate: async ({ session }) => {
            if (session?.currentTask) {
              console.log(session?.currentTask)
              // router.push('/sign-in/tasks')
              // return
            }

            router.push('/')
          },
        })
      } else {
        console.log("createdSessionId doesn't exist", createdSessionId)
        // If there is no `createdSessionId`,
        // there are missing requirements, such as MFA
        // See https://clerk.com/docs/guides/development/custom-flows/authentication/oauth-connections#handle-missing-requirements
      }
    } catch (err) {
      // See https://clerk.com/docs/guides/development/custom-flows/error-handling
      // for more info on error handling
      console.error(JSON.stringify(err, null, 2))
    }
  }, [router, startSSOFlow])

  return (
    <View>
      <Button title="Sign in with Google" onPress={onPress} />
    </View>
  )
}