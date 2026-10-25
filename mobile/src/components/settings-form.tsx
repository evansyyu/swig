import { FieldGroup, Host, ListItem, Picker, ScrollView, Switch, Text } from '@expo/ui';

import type { SyncPhase } from '@/data/store';
import type { Settings } from '@/data/types';
import type { AppLockState } from '@/lib/app-blocker';
import type { Voice } from '@/lib/voice';
import { useColors } from '@/theme';
import { END_HOURS, GOAL_OPTIONS, INTERVAL_OPTIONS, START_HOURS } from '@/constants/hydration';
import { formatInterval, formatLiters } from '@/utils/format';
import { hourLabel, syncSummary } from '@/utils/intake';

export type SettingsFormProps = {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  lock: { supported: boolean; state: AppLockState; onChooseApps: () => void };
  voice: { options: Voice[]; selected: string; onSelect: (id: string) => void; onPreview: () => void };
  bottle: { emptyG: number | null; scaleOwner: boolean; onReweigh: () => void; onCalibrate: () => void };
  sync: { phase: SyncPhase; pending: number; lastSyncedAt: string | null; onSyncNow: () => void };
  username: string;
  onLogOut: () => void;
  /** Dev builds only: the Developer panel, with the clock offset in force. */
  dev?: { clock: string; onOpen: () => void };
};

/** Android/web: universal @expo/ui (Jetpack Compose on Android), Material-style groups. */
export function SettingsForm({ settings, onChange, lock, voice, bottle, sync, username, onLogOut, dev }: SettingsFormProps) {
  const colors = useColors();
  const chosen = voice.options.find((v) => v.id === voice.selected);
  return (
    <Host style={{ flex: 1 }} seedColor={colors.accent}>
      <ScrollView>
        <FieldGroup>
          <FieldGroup.Section title="Daily rhythm">
            <ListItem supportingText="Liters per day">
              Water goal
              <ListItem.Trailing>
                <Picker selectedValue={settings.goal_ml} onValueChange={(goal_ml) => onChange({ goal_ml })} appearance="menu">
                  {GOAL_OPTIONS.map((ml) => (
                    <Picker.Item key={ml} label={`${formatLiters(ml)} L`} value={ml} />
                  ))}
                </Picker>
              </ListItem.Trailing>
            </ListItem>
            <ListItem supportingText="Spoken by your speaker">
              Reminders
              <ListItem.Trailing>
                <Picker selectedValue={settings.interval_min} onValueChange={(interval_min) => onChange({ interval_min })} appearance="menu">
                  {INTERVAL_OPTIONS.map((m) => (
                    <Picker.Item key={m} label={formatInterval(m)} value={m} />
                  ))}
                </Picker>
              </ListItem.Trailing>
            </ListItem>
            <ListItem>
              Day starts
              <ListItem.Trailing>
                <Picker selectedValue={settings.start_hour} onValueChange={(start_hour) => onChange({ start_hour })} appearance="menu">
                  {START_HOURS.map((h) => (
                    <Picker.Item key={h} label={hourLabel(h)} value={h} />
                  ))}
                </Picker>
              </ListItem.Trailing>
            </ListItem>
            <ListItem>
              Day ends
              <ListItem.Trailing>
                <Picker selectedValue={settings.end_hour} onValueChange={(end_hour) => onChange({ end_hour })} appearance="menu">
                  {END_HOURS.map((h) => (
                    <Picker.Item key={h} label={hourLabel(h)} value={h} />
                  ))}
                </Picker>
              </ListItem.Trailing>
            </ListItem>
          </FieldGroup.Section>

          <FieldGroup.Section title="Voice">
            {voice.options.length > 1 && (
              <ListItem supportingText={chosen?.description}>
                Speaker voice
                <ListItem.Trailing>
                  <Picker selectedValue={voice.selected} onValueChange={voice.onSelect} appearance="menu">
                    {voice.options.map((v) => (
                      <Picker.Item key={v.id} label={v.name} value={v.id} />
                    ))}
                  </Picker>
                </ListItem.Trailing>
              </ListItem>
            )}
            <ListItem onPress={voice.onPreview} supportingText="Plays a reminder on your speaker">
              Preview voice
            </ListItem>
          </FieldGroup.Section>

          <FieldGroup.Section title="Balance">
            <ListItem
              onPress={bottle.onReweigh}
              supportingText={bottle.scaleOwner ? 'This Balance logs to your account' : 'Weigh your bottle to connect the Balance'}
            >
              Empty bottle
              <ListItem.Trailing>
                <Text>{bottle.emptyG != null ? `${Math.round(bottle.emptyG)} g` : 'Not set'}</Text>
              </ListItem.Trailing>
            </ListItem>
            <ListItem onPress={bottle.onCalibrate} supportingText="Use a known weight to correct readings">
              Calibrate
            </ListItem>
          </FieldGroup.Section>

          {lock.supported && (
            <FieldGroup.Section title="App lock">
              <ListItem supportingText="When you fall far behind">
                Lock comfort apps
                <ListItem.Trailing>
                  <Switch value={settings.lock_enabled} onValueChange={(lock_enabled) => onChange({ lock_enabled })} />
                </ListItem.Trailing>
              </ListItem>
              <ListItem onPress={lock.onChooseApps}>
                Choose apps
                <ListItem.Trailing>
                  <Text>{lock.state.selectedCount ? `${lock.state.selectedCount} selected` : 'None'}</Text>
                </ListItem.Trailing>
              </ListItem>
            </FieldGroup.Section>
          )}

          <FieldGroup.Section title="Sync">
            <ListItem onPress={sync.onSyncNow} supportingText="Tap to sync now">
              Last synced
              <ListItem.Trailing>
                <Text>{syncSummary(sync.phase, sync.pending, sync.lastSyncedAt)}</Text>
              </ListItem.Trailing>
            </ListItem>
          </FieldGroup.Section>

          <FieldGroup.Section title="Account">
            <ListItem supportingText="Signed in">{username}</ListItem>
            <ListItem onPress={onLogOut}>Log out</ListItem>
          </FieldGroup.Section>

          {dev && (
            <FieldGroup.Section title="Developer">
              <ListItem onPress={dev.onOpen} supportingText="Dev builds only">
                Developer tools
                <ListItem.Trailing>
                  <Text>{`Clock: ${dev.clock}`}</Text>
                </ListItem.Trailing>
              </ListItem>
            </FieldGroup.Section>
          )}
        </FieldGroup>
      </ScrollView>
    </Host>
  );
}
