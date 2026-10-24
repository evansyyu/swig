import { API_URL } from './api';
import { getState, setState } from './store';
import type { Status } from './types';

/**
 * Live push from the server (`WS /ws`): fresh status on every scale event, and a
 * `changed` flag that tells sync to pull new rows. Purely an accelerator; when the
 * socket is down, sync falls back to its heartbeat.
 */
const PING_MS = 25_000;
const UNAUTHORIZED = 4401;

let socket: WebSocket | null = null;
let ping: ReturnType<typeof setInterval> | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let backoff = 0;
let wanted = false;

type Handlers = { onStatus: (status: Status, changed: boolean) => void; onUnauthorized: () => void };
let handlers: Handlers | null = null;

export function setLiveHandlers(next: Handlers) {
  handlers = next;
}

export function connect() {
  wanted = true;
  const { token } = getState();
  if (!token || socket) return;
  clearTimeout(reconnectTimer);
  const ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`);
  socket = ws;

  ws.onopen = () => {
    backoff = 0;
    setState({ live: true });
    ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), PING_MS);
  };
  ws.onmessage = (event) => {
    if (typeof event.data !== 'string' || event.data === 'pong') return;
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'state') handlers?.onStatus(message.status, !!message.changed);
    } catch {
      // Ignore malformed frames; the next push or pull corrects state.
    }
  };
  ws.onclose = (event) => {
    clearInterval(ping);
    if (socket === ws) socket = null;
    setState({ live: false });
    if (event.code === UNAUTHORIZED) {
      handlers?.onUnauthorized();
      return;
    }
    if (wanted) {
      backoff = Math.min(30_000, backoff ? backoff * 2 : 1_000);
      reconnectTimer = setTimeout(connect, backoff);
    }
  };
  ws.onerror = () => ws.close();
}

export function disconnect() {
  wanted = false;
  clearTimeout(reconnectTimer);
  clearInterval(ping);
  socket?.close();
  socket = null;
  if (getState().live) setState({ live: false });
}
