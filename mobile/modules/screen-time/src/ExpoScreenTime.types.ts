export type AuthorizationStatus = 'notDetermined' | 'denied' | 'approved';

export type BlockGroupDefinition = {
  id: string;
  name: string;
};

/** Counts only: FamilyControls tokens are opaque and stay on the native side. */
export type BlockGroupSummary = {
  id: string;
  enabled: boolean;
  appCount: number;
  categoryCount: number;
  webDomainCount: number;
};

export type AuthorizationStatusChangeEvent = {
  status: AuthorizationStatus;
};

export type ExpoScreenTimeModuleEvents = {
  onAuthorizationStatusChange: (event: AuthorizationStatusChangeEvent) => void;
};
