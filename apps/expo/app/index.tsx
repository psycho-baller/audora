import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { SignOutButton } from '@/components/sign-out-button'

export default function Page() {
  const { user } = useUser()
  console.log("user", user)

  return (
    <View style={styles.container}>
      <SignedIn>
        <Text style={styles.greeting}>Hello {user?.emailAddresses[0].emailAddress}</Text>
        <SignOutButton />
      </SignedIn>
      <SignedOut>
        <View style={styles.authLinks}>
          <Link href="/(auth)/sign-in" style={styles.link}>
            <Text style={styles.linkText}>Sign in</Text>
          </Link>
          <Link href="/(auth)/sign-up" style={styles.link}>
            <Text style={styles.linkText}>Sign up</Text>
          </Link>
        </View>
      </SignedOut>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  greeting: {
    fontSize: 18,
    marginBottom: 20,
  },
  authLinks: {
    gap: 16,
  },
  link: {
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  linkText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})
