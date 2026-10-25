import { Pressable } from 'react-native';

import { ThemedText } from './themed-text';

/** A quiet text action ("Skip for now", "Log in"). */
export function TextButton({
  title,
  onPress,
  prefix,
  disabled,
}: {
  title: string;
  onPress: () => void;
  prefix?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={prefix ? `${prefix} ${title}` : title}
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => ({ alignSelf: 'center', paddingVertical: 10, opacity: pressed ? 0.5 : disabled ? 0.4 : 1 })}
    >
      <ThemedText variant="callout" tone="secondary" style={{ textAlign: 'center' }}>
        {prefix ? `${prefix} ` : ''}
        <ThemedText variant="callout" tone="accent" style={{ fontWeight: '700' }}>
          {title}
        </ThemedText>
      </ThemedText>
    </Pressable>
  );
}
