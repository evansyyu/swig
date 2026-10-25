import { type ReactNode, useState } from 'react';
import { RefreshControl, ScrollView, type ScrollViewProps, type StyleProp, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, spacing, useColors } from '@/theme';

/**
 * Standard scrolling page. Insets come from the native header/tab bar
 * (`contentInsetAdjustmentBehavior`); `safeTop` adds the status bar inset for
 * headerless Android tab screens.
 */
export function ScreenScroll({
  children,
  safeTop = false,
  refreshing,
  onRefresh,
  contentContainerStyle,
  ...props
}: ScrollViewProps & {
  children: ReactNode;
  safeTop?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        {
          paddingHorizontal: gutter,
          paddingTop: safeTop ? insets.top + spacing.lg : spacing.sm,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        },
        contentContainerStyle,
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        ) : undefined
      }
      {...props}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Onboarding step: scrolling content with the primary action pinned above the home indicator,
 * on a solid background so content scrolling beneath never shows through. The content is
 * padded by the footer's measured height (plus room to breathe) so its end scrolls clear of it.
 */
export function StepLayout({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);
  return (
    // Not collapsable: a formSheet lays out a ScrollView with at most a header beside it, so
    // the footer must not flatten into siblings of the ScrollView (that blanks the sheet).
    <View collapsable={false} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenScroll
        contentContainerStyle={{ gap: spacing.xl, paddingTop: spacing.lg, paddingBottom: footerHeight + spacing.xxxl }}
        scrollIndicatorInsets={{ bottom: footerHeight }}
      >
        {children}
      </ScreenScroll>
      <View
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.background,
          paddingHorizontal: gutter,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          gap: spacing.sm,
        }}
      >
        {footer}
      </View>
    </View>
  );
}
