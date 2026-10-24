import { NativeModule, requireNativeModule } from 'expo';

import type {
  AuthorizationStatus,
  BlockGroupDefinition,
  BlockGroupSummary,
  ExpoScreenTimeModuleEvents,
} from './ExpoScreenTime.types';

declare class ExpoScreenTimeModule extends NativeModule<ExpoScreenTimeModuleEvents> {
  getAuthorizationStatus(): AuthorizationStatus;
  requestAuthorizationAsync(): Promise<AuthorizationStatus>;
  revokeAuthorizationAsync(): Promise<AuthorizationStatus>;
  registerGroups(definitions: BlockGroupDefinition[]): BlockGroupSummary[];
  setGroupEnabledAsync(id: string, enabled: boolean): Promise<BlockGroupSummary>;
  disableAllAsync(): Promise<BlockGroupSummary[]>;
  presentPickerAsync(id: string): Promise<BlockGroupSummary | null>;
}

export default requireNativeModule<ExpoScreenTimeModule>('ExpoScreenTime');
