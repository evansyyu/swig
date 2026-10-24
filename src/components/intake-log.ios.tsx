import { Host } from '@expo/ui';
import { Button, ContextMenu, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, lineLimit, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { memo } from 'react';

import { useColors } from '@/theme';
import { formatTime } from '@/utils/format';
import { canUndo, describeIntake } from '@/utils/intake';

import type { IntakeLogProps } from './intake-log';

/** iOS: one SwiftUI tree; press and hold a row for a native context menu to remove it. */
export const IntakeLog = memo(function IntakeLog({ intakes, onUndo }: IntakeLogProps) {
  const colors = useColors();
  return (
    <Host matchContents={{ vertical: true }}>
      <VStack spacing={0} alignment="leading">
        {intakes.map((intake) => {
          const { label, amount } = describeIntake(intake);
          const row = (
            <HStack spacing={14} modifiers={[padding({ vertical: 9 }), frame({ maxWidth: 10_000 })]}>
              <Text modifiers={[font({ size: 15 }), monospacedDigit(), foregroundStyle(colors.textSecondary), frame({ width: 72, alignment: 'leading' })]}>
                {formatTime(intake.at)}
              </Text>
              <Text modifiers={[font({ size: 15 }), foregroundStyle(colors.text), lineLimit(1)]}>{label}</Text>
              <Spacer />
              {intake.pending && <Image systemName="clock" size={12} color={colors.textTertiary} />}
              <Text modifiers={[font({ size: 16, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle(colors.accent)]}>
                {amount}
              </Text>
            </HStack>
          );
          if (!canUndo(intake)) return <VStack key={intake.id}>{row}</VStack>;
          return (
            <ContextMenu key={intake.id}>
              <ContextMenu.Items>
                <Button label="Remove from today" systemImage="trash" role="destructive" onPress={() => onUndo(intake.id)} />
              </ContextMenu.Items>
              <ContextMenu.Trigger>{row}</ContextMenu.Trigger>
            </ContextMenu>
          );
        })}
      </VStack>
    </Host>
  );
});
