import { Host } from '@expo/ui';
import { Button, Menu } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, tint } from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';

import { DEFAULT_SIP, SIP_AMOUNTS } from '@/constants/hydration';
import { useColors } from '@/theme';

import type { SipButtonProps } from './sip-button';

/** iOS: a native menu button. Tap logs 250 ml; press and hold for other amounts. */
export function SipButton({ onLog }: SipButtonProps) {
  const colors = useColors();
  const log = (ml: number) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLog(ml);
  };
  return (
    <Host matchContents style={{ alignSelf: 'center' }}>
      <Menu
        label={`Log a ${DEFAULT_SIP} ml sip`}
        systemImage="plus"
        onPrimaryAction={() => log(DEFAULT_SIP)}
        modifiers={[buttonStyle('bordered'), buttonBorderShape('capsule'), controlSize('regular'), tint(colors.accent)]}
      >
        {[...SIP_AMOUNTS, 750].map((ml) => (
          <Button key={ml} label={`${ml} ml`} systemImage="drop" onPress={() => log(ml)} />
        ))}
      </Menu>
    </Host>
  );
}
