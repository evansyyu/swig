import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useAppState } from '@/data/store';

import { Avatar } from './avatar';

/** The avatar in the Today header; opens Settings. */
export function SettingsButton({ size = 36 }: { size?: number }) {
  const username = useAppState((s) => s.profile?.username ?? '');
  return (
    <Link href="/settings" asChild>
      <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8}>
        {({ pressed }) => (
          <View style={{ opacity: pressed ? 0.6 : 1 }}>
            <Avatar username={username} size={size} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}
