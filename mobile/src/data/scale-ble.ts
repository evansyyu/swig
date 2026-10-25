import { useSyncExternalStore } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State, type Device, type Subscription } from 'react-native-ble-plx';

import { relayReading } from './scale-relay';
import type { BleScale, CalibrationStep } from './types';

/**
 * Bluetooth link to the Balance (firmware/scale_firmware). The scale notifies its weight as a
 * string ("123.45"), which is relayed to the server; calibration runs on the scale and is
 * driven from here by answering its prompts over the command characteristic. Values over
 * BLE are base64. With the bluetooth-central background mode, iOS keeps delivering readings
 * (and relaying them) while the app is in the background.
 */
const SERVICE = '12345678-1234-1234-1234-1234567890ab';
const WEIGHT = 'abcd1234-5678-90ab-cdef-1234567890ab';
const COMMAND = 'abcd1235-5678-90ab-cdef-1234567890ab';
const STATUS = 'abcd1236-5678-90ab-cdef-1234567890ab';
const RETRY_MS = 3_000;

const STATUS_STEPS: Record<string, CalibrationStep> = {
  'cal:empty': 'empty',
  'cal:weight': 'weight',
  'cal:done': 'done',
  'cal:cancelled': 'cancelled',
  'cal:failed': 'failed',
};

const FINISHED: CalibrationStep[] = ['idle', 'done', 'cancelled', 'failed'];

let state: BleScale = { link: 'off', grams: null, relayed: null, calibration: 'idle', error: null };
const listeners = new Set<() => void>();

let manager: BleManager | null = null;
let stateSub: Subscription | null = null;
let poweredOn = false;
let device: Device | null = null;
let deviceSubs: Subscription[] = [];
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let wanted = false;
/** The user backed out while the scale was busy: answer its next prompt with "x". */
let cancelPending = false;

function update(patch: Partial<BleScale>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getScaleState() {
  return state;
}

export function useScale<T>(selector: (s: BleScale) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

async function requestPermissions() {
  if (Platform.OS !== 'android') return true; // iOS asks when the manager starts
  if (Number(Platform.Version) >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** Find the Balance and stay connected, reconnecting after drops. Idempotent. */
export async function connectScale() {
  if (Platform.OS === 'web' || wanted) return;
  wanted = true;
  if (!(await requestPermissions())) {
    wanted = false;
    update({ error: 'Allow Bluetooth access to connect your Balance.' });
    return;
  }
  if (!wanted) return; // disconnected while the permission prompt was up
  manager ??= new BleManager({
    // Lets iOS relaunch the app in the background with the scale still connected.
    restoreStateIdentifier: 'swig-scale',
    restoreStateFunction: (restored) => {
      const restoredDevice = restored?.connectedPeripherals[0];
      if (restoredDevice && !device) void attach(restoredDevice);
    },
  });
  stateSub = manager.onStateChange((bleState) => {
    poweredOn = bleState === State.PoweredOn;
    if (poweredOn) {
      update({ error: null });
      if (!device) scan();
      return;
    }
    void manager?.stopDeviceScan();
    update({
      link: device ? state.link : 'off',
      error:
        bleState === State.PoweredOff
          ? 'Turn on Bluetooth to connect your Balance.'
          : bleState === State.Unauthorized
            ? 'Allow Bluetooth access to connect your Balance.'
            : null,
    });
  }, true);
}

export function disconnectScale() {
  wanted = false;
  clearTimeout(retryTimer);
  stateSub?.remove();
  stateSub = null;
  void manager?.stopDeviceScan();
  const current = device;
  drop();
  update({ error: null });
  void current?.cancelConnection().catch(() => undefined);
}

function scan() {
  if (!manager || !wanted || !poweredOn || device) return;
  update({ link: 'scanning' });
  // Filter on the service UUID: iOS only scans in the background with one.
  void manager.startDeviceScan([SERVICE], null, (error, found) => {
    if (error) {
      update({ link: 'off', error: error.message });
      retry();
      return;
    }
    if (!found || state.link !== 'scanning') return;
    void manager?.stopDeviceScan();
    void attach(found);
  });
}

function retry() {
  clearTimeout(retryTimer);
  if (wanted) retryTimer = setTimeout(scan, RETRY_MS);
}

async function attach(found: Device) {
  update({ link: 'connecting' });
  try {
    const connected = await found.connect();
    await connected.discoverAllServicesAndCharacteristics();
    if (!wanted) {
      await connected.cancelConnection();
      return;
    }
    device = connected;
    deviceSubs = [
      connected.onDisconnected(() => {
        drop();
        retry();
      }),
      // Errors here are the subscription ending on disconnect; onDisconnected handles that.
      connected.monitorCharacteristicForService(SERVICE, WEIGHT, (error, c) => {
        if (!error && c?.value) onReading(atob(c.value));
      }),
      connected.monitorCharacteristicForService(SERVICE, STATUS, (error, c) => {
        if (!error && c?.value) onStatus(atob(c.value));
      }),
    ];
    // Picks up a calibration already waiting (e.g. the scale booted uncalibrated).
    const status = await connected.readCharacteristicForService(SERVICE, STATUS);
    if (status.value) onStatus(atob(status.value), true);
    update({ link: 'connected', error: null });
  } catch (e) {
    drop();
    void found.cancelConnection().catch(() => undefined);
    update({ error: e instanceof Error ? e.message : "Couldn't connect to your Balance." });
    retry();
  }
}

function drop() {
  deviceSubs.forEach((s) => s.remove());
  deviceSubs = [];
  device = null;
  cancelPending = false;
  // A calibration the scale is still waiting on is picked up again on reconnect.
  update({ link: 'off', grams: null, relayed: null, calibration: 'idle' });
}

function onReading(text: string) {
  const grams = Number.parseFloat(text);
  if (Number.isNaN(grams)) return;
  update({ grams });
  void relayReading(grams).then((relayed) => {
    if (relayed !== undefined && device) update({ relayed }); // a late reply after a drop is stale
  });
}

function onStatus(text: string, initial = false) {
  const step = STATUS_STEPS[text.trim()] ?? 'idle';
  // On connect only a calibration in progress matters; an old result isn't news.
  if (initial && step !== 'empty' && step !== 'weight') return;
  if (cancelPending && (step === 'empty' || step === 'weight')) {
    void send('x').catch(() => undefined);
    return;
  }
  if (FINISHED.includes(step)) cancelPending = false;
  update({ calibration: step });
}

async function send(command: string) {
  if (!device) throw new Error("Your Balance isn't connected.");
  await device.writeCharacteristicWithResponseForService(SERVICE, COMMAND, btoa(command));
}

/** Answer the scale, showing `next` until it reports its next step. */
async function answer(command: string, next: CalibrationStep) {
  const previous = state.calibration;
  update({ calibration: next });
  try {
    await send(command);
  } catch (e) {
    update({ calibration: previous });
    throw e;
  }
}

/** Start calibrate() on the scale. It reports `empty` and waits for confirmScaleEmpty(). */
export function startCalibration() {
  cancelPending = false;
  return answer('c', 'starting');
}

/** The scale is empty: it tares, then reports `weight` and waits for submitKnownWeight(). */
export function confirmScaleEmpty() {
  return answer('ok', 'taring');
}

/** Grams of the known weight now on the scale. The scale saves its factor and reports `done`. */
export function submitKnownWeight(grams: number) {
  if (!(grams > 0)) return Promise.reject(new Error('Enter the weight in grams.'));
  return answer(String(grams), 'measuring');
}

/** Back out of a calibration in progress; the scale keeps its saved factor. */
export function cancelCalibration() {
  const step = state.calibration;
  if (FINISHED.includes(step)) return;
  cancelPending = true;
  // Mid-step (starting, taring, measuring): onStatus answers the next prompt instead.
  if (step === 'empty' || step === 'weight') void send('x').catch(() => undefined);
}

/** Zero the scale with whatever is on it now. */
export function tareScale() {
  return send('t');
}
