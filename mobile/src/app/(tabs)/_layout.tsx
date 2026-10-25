import { NativeTabs } from 'expo-router/native-tabs';

import { useColors } from '@/theme';

export default function TabsLayout() {
  const colors = useColors();
  return (
    <NativeTabs
      tintColor={colors.accent}
      // Android: Material 3 bar in brand colors, like the reference's pill indicator.
      backgroundColor={process.env.EXPO_OS === 'android' ? colors.surface : undefined}
      indicatorColor={colors.surfaceTint}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.accent } }}
    >
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Icon sf={{ default: 'drop', selected: 'drop.fill' }} md="water_drop" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(progress)">
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="bar_chart" />
        <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(community)">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="groups" />
        <NativeTabs.Trigger.Label>Community</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
