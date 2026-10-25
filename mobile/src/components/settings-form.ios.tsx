import { Host } from '@expo/ui';
import { Button, Form, LabeledContent, Picker, Section, Text, Toggle } from '@expo/ui/swift-ui';
import {
  background,
  foregroundStyle,
  monospacedDigit,
  pickerStyle,
  scrollContentBackground,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { useColors } from '@/theme';
import { END_HOURS, GOAL_OPTIONS, INTERVAL_OPTIONS, START_HOURS } from '@/constants/hydration';
import { formatInterval, formatLiters } from '@/utils/format';
import { hourLabel, syncSummary } from '@/utils/intake';

import type { SettingsFormProps } from './settings-form';

/** iOS: a native SwiftUI Form on the brand background, tinted with the brand steel. */
export function SettingsForm({ settings, onChange, lock, voice, bottle, sync, username, onLogOut, dev }: SettingsFormProps) {
  const colors = useColors();
  const secondary = foregroundStyle(colors.textSecondary);
  const chosen = voice.options.find((v) => v.id === voice.selected);
  const lockFooter =
    lock.state.authorization === 'denied'
      ? 'Screen Time access is off. Turn it on in Settings › Screen Time to use the app lock.'
      : 'When you fall far behind your pace, these apps are paused until your next drink.';

  return (
    <Host style={{ flex: 1 }}>
      <Form modifiers={[scrollContentBackground('hidden'), background(colors.background), tint(colors.accent)]}>
        <Section title="Daily rhythm" footer={<Text>{"Reminders are spoken by your speaker when you haven't had a sip."}</Text>}>
          <Picker
            label="Water goal"
            systemImage="drop"
            selection={settings.goal_ml}
            onSelectionChange={(goal_ml: number) => onChange({ goal_ml })}
            modifiers={[pickerStyle('menu')]}
          >
            {GOAL_OPTIONS.map((ml) => (
              <Text key={ml} modifiers={[tag(ml)]}>{`${formatLiters(ml)} L`}</Text>
            ))}
          </Picker>
          <Picker
            label="Reminders"
            systemImage="bell"
            selection={settings.interval_min}
            onSelectionChange={(interval_min: number) => onChange({ interval_min })}
            modifiers={[pickerStyle('menu')]}
          >
            {INTERVAL_OPTIONS.map((m) => (
              <Text key={m} modifiers={[tag(m)]}>
                {formatInterval(m)}
              </Text>
            ))}
          </Picker>
          <Picker
            label="Day starts"
            systemImage="sunrise"
            selection={settings.start_hour}
            onSelectionChange={(start_hour: number) => onChange({ start_hour })}
            modifiers={[pickerStyle('menu')]}
          >
            {START_HOURS.map((h) => (
              <Text key={h} modifiers={[tag(h)]}>
                {hourLabel(h)}
              </Text>
            ))}
          </Picker>
          <Picker
            label="Day ends"
            systemImage="moon"
            selection={settings.end_hour}
            onSelectionChange={(end_hour: number) => onChange({ end_hour })}
            modifiers={[pickerStyle('menu')]}
          >
            {END_HOURS.map((h) => (
              <Text key={h} modifiers={[tag(h)]}>
                {hourLabel(h)}
              </Text>
            ))}
          </Picker>
        </Section>

        <Section title="Voice" footer={<Text>{chosen ? `${chosen.name}: ${chosen.description}.` : 'Reminders play on your speaker.'}</Text>}>
          {voice.options.length > 1 && (
            <Picker
              label="Speaker voice"
              systemImage="waveform"
              selection={voice.selected}
              onSelectionChange={voice.onSelect}
              modifiers={[pickerStyle('menu')]}
            >
              {voice.options.map((v) => (
                <Text key={v.id} modifiers={[tag(v.id)]}>
                  {v.name}
                </Text>
              ))}
            </Picker>
          )}
          <Button label="Preview voice" systemImage="speaker.wave.2" onPress={voice.onPreview} />
        </Section>

        <Section
          title="Balance"
          footer={
            <Text>{bottle.scaleOwner ? 'Your Balance logs every sip to this account.' : 'Weigh your empty bottle on the Balance to connect it.'}</Text>
          }
        >
          <LabeledContent label="Empty bottle">
            <Text modifiers={[secondary, monospacedDigit()]}>
              {bottle.emptyG != null ? `${Math.round(bottle.emptyG)} g` : 'Not set'}
            </Text>
          </LabeledContent>
          <Button label="Weigh empty bottle" systemImage="scalemass" onPress={bottle.onReweigh} />
          <Button label="Calibrate" systemImage="dial.medium" onPress={bottle.onCalibrate} />
        </Section>

        {lock.supported && (
          <Section title="App lock" footer={<Text>{lockFooter}</Text>}>
            <Toggle
              label="Lock comfort apps"
              systemImage="lock"
              isOn={settings.lock_enabled}
              onIsOnChange={(lock_enabled) => onChange({ lock_enabled })}
            />
            <Button onPress={lock.onChooseApps}>
              <LabeledContent label="Choose apps">
                <Text modifiers={[secondary]}>
                  {lock.state.selectedCount ? `${lock.state.selectedCount} selected` : 'None'}
                </Text>
              </LabeledContent>
            </Button>
          </Section>
        )}

        <Section title="Sync" footer={<Text>{"Changes are saved on this phone first and sync when you're online."}</Text>}>
          <LabeledContent label="Last synced">
            <Text modifiers={[secondary]}>{syncSummary(sync.phase, sync.pending, sync.lastSyncedAt)}</Text>
          </LabeledContent>
          {sync.pending > 0 && (
            <LabeledContent label="Waiting to sync">
              <Text modifiers={[secondary, monospacedDigit()]}>{String(sync.pending)}</Text>
            </LabeledContent>
          )}
          <Button label="Sync now" systemImage="arrow.triangle.2.circlepath" onPress={sync.onSyncNow} />
        </Section>

        <Section title="Account">
          <LabeledContent label="Username">
            <Text modifiers={[secondary]}>{username}</Text>
          </LabeledContent>
          <Button label="Log out" role="destructive" onPress={onLogOut} />
        </Section>

        {dev && (
          <Section title="Developer" footer={<Text>Dev builds only.</Text>}>
            <Button onPress={dev.onOpen}>
              <LabeledContent label="Developer tools">
                <Text modifiers={[secondary]}>{`Clock: ${dev.clock}`}</Text>
              </LabeledContent>
            </Button>
          </Section>
        )}
      </Form>
    </Host>
  );
}
