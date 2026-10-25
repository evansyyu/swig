import { SettingsButton } from '@/components/settings-button';
import { TabStack } from '@/components/tab-stack';

export default function TodayLayout() {
  return <TabStack screen="today" title="Today" headerRight={() => <SettingsButton />} />;
}
