import { Host } from '@expo/ui';
import { Button, Form, HStack, Image, Section, Spacer, Text } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  listRowBackground,
  scrollContentBackground,
  scrollDisabled,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';

import { INTERVAL_OPTIONS } from '@/constants/hydration';
import { useColors } from '@/theme';
import { formatInterval } from '@/utils/format';

import type { IntervalPickerProps } from './interval-picker';

/** iOS: a native inset-grouped selection list with a checkmark, like a Settings picker. */
export function IntervalPicker({ value, onChange }: IntervalPickerProps) {
  const colors = useColors();
  return (
    // Fixed height (five rows plus insets) because the page scrolls; the negative margin
    // cancels the Form's own inset so rows align with the page gutter.
    <Host style={{ height: 5 * 52 + 40, marginHorizontal: -20 }}>
      <Form modifiers={[scrollContentBackground('hidden'), scrollDisabled(true)]}>
        <Section>
          {INTERVAL_OPTIONS.map((minutes) => (
            <Button
              key={minutes}
              onPress={() => {
                if (minutes === value) return;
                void Haptics.selectionAsync();
                onChange(minutes);
              }}
              modifiers={[listRowBackground(colors.surface)]}
            >
              <HStack spacing={14}>
                <Image systemName="clock" color={colors.accent} size={18} />
                <Text modifiers={[font({ size: 17 }), foregroundStyle(colors.text)]}>{formatInterval(minutes)}</Text>
                <Spacer />
                {minutes === value && <Image systemName="checkmark" color={colors.accent} size={16} />}
              </HStack>
            </Button>
          ))}
        </Section>
      </Form>
    </Host>
  );
}
