import { memo } from 'react';
import { View } from 'react-native';

import { radius, useColors } from '@/theme';
import { initials } from '@/utils/format';

import { ThemedText } from './themed-text';

export const Avatar = memo(function Avatar({
  username,
  size = 44,
  tone = 'tint',
}: {
  username: string;
  size?: number;
  tone?: 'tint' | 'surface';
}) {
  const colors = useColors();
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'tint' ? colors.surfaceTint : colors.surface,
        borderWidth: tone === 'surface' ? 1 : 0,
        borderColor: colors.border,
      }}
    >
      <ThemedText variant="caption" tone="accent" style={{ fontSize: size * 0.34, fontWeight: '700' }}>
        {initials(username)}
      </ThemedText>
    </View>
  );
});
