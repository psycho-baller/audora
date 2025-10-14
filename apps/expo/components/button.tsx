import { Pressable, Text, StyleSheet, type PressableProps } from 'react-native'

interface ButtonProps extends PressableProps {
  title: string
  variant?: 'primary' | 'secondary'
}

export function Button({ title, variant = 'primary', style, ...props }: ButtonProps) {
  return (
    <Pressable
      style={(state) => [
        styles.button,
        variant === 'primary' ? styles.primary : styles.secondary,
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      <Text style={[styles.text, variant === 'primary' ? styles.primaryText : styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  primary: {
    backgroundColor: '#007AFF',
  },
  secondary: {
    backgroundColor: '#E5E5EA',
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#000000',
  },
})
