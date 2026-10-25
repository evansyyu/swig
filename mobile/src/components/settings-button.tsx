import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useColors } from '@/theme';

import { Icon } from './icon';

/**
 * A settings gear (SF Symbol on iOS, Material Symbol on Android) that opens Settings. On iOS,
 * Today uses a native bar button with the same glyph instead (see the Today layout).
 */
export function SettingsButton({ size = 36 }: { size?: number }) {
  const colors = useColors();
  return (
    <Link href="/settings" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8}>
        {({ pressed }) => (
          <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }}>
            <Icon ios="gearshape" android="settings" size={Math.round(size * 0.6)} color={colors.accent} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}
