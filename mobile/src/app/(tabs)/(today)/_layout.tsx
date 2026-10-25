import { router } from 'expo-router';

import { SettingsButton } from '@/components/settings-button';
import { TabStack } from '@/components/tab-stack';

export default function TodayLayout() {
  return (
    <TabStack
      screen="today"
      title="Today"
      headerRight={() => <SettingsButton />}
      headerRightItems={() => [
        { type: 'button', label: 'Settings', icon: { type: 'sfSymbol', name: 'gearshape' }, onPress: () => router.push('/settings') },
      ]}
    />
  );
}
