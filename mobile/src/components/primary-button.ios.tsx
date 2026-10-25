import { Host } from '@expo/ui';
import { Button, HStack, Image, ProgressView, Text } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { useColors } from '@/theme';

import type { PrimaryButtonProps } from './primary-button';

/** iOS: a native SwiftUI prominent capsule button, tinted with the brand steel. */
export function PrimaryButton({ title, onPress, disabled, loading, arrow = true, style }: PrimaryButtonProps) {
  const colors = useColors();
  return (
    <Host matchContents={{ vertical: true }} style={style}>
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle('borderedProminent'),
          buttonBorderShape('capsule'),
          controlSize('extraLarge'),
          tint(colors.accent),
          disabledModifier(!!disabled || !!loading),
        ]}
      >
        <HStack spacing={8} modifiers={[frame({ maxWidth: 10_000, minHeight: 30 }), foregroundStyle(colors.onAccent)]}>
          {loading ? (
            <ProgressView />
          ) : (
            <>
              <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>{title}</Text>
              {arrow ? <Image systemName="arrow.right" size={15} /> : <></>}
            </>
          )}
        </HStack>
      </Button>
    </Host>
  );
}
