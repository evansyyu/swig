import { openDatabaseSync } from 'expo-sqlite';

import type { DayLog, Intake, Mutation } from './types';

/**
 * Local copy of everything the app shows, so it opens instantly and works offline.
 * Reads happen once, synchronously, at startup (a few hundred rows at most); every
 * write after that is async on SQLite's own thread and serialized through `write`.
 */
const db = openDatabaseSync('sip.db');

const SCHEMA_VERSION = 1;

function migrate() {
  const { user_version } = db.getFirstSync<{ user_version: number }>('PRAGMA user_version') ?? { user_version: 0 };
  if (user_version >= SCHEMA_VERSION) return;
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS intakes (
      id TEXT PRIMARY KEY NOT NULL,
      day TEXT NOT NULL,
      kind TEXT NOT NULL,
      source TEXT NOT NULL,
      amount_ml INTEGER NOT NULL,
      detail_ml INTEGER,
      at TEXT NOT NULL,
      voided INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT,
      pending INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS intakes_day ON intakes (day);
    CREATE TABLE IF NOT EXISTS days (
      day TEXT PRIMARY KEY NOT NULL,
      goal_ml INTEGER NOT NULL,
      consumed_ml INTEGER NOT NULL,
      met INTEGER NOT NULL,
      met_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS outbox (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

migrate();

type IntakeRow = Omit<Intake, 'voided' | 'pending'> & { voided: number; pending: number };
type DayRow = Omit<DayLog, 'met'> & { met: number };
type OutboxRow = { seq: number; id: string; type: Mutation['type']; payload: string };

const toIntake = (row: IntakeRow): Intake => ({ ...row, voided: !!row.voided, pending: !!row.pending });
const toDay = (row: DayRow): DayLog => ({ ...row, met: !!row.met });

// ---- reads (startup) ----
export function readKv<T>(key: string): T | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : null;
}

export function readIntakes(sinceDay: string): Intake[] {
  return db.getAllSync<IntakeRow>('SELECT * FROM intakes WHERE day >= ? ORDER BY at', sinceDay).map(toIntake);
}

export function readDays(): DayLog[] {
  return db.getAllSync<DayRow>('SELECT * FROM days ORDER BY day').map(toDay);
}

export function readOutbox(limit = 100): Mutation[] {
  return db
    .getAllSync<OutboxRow>('SELECT * FROM outbox ORDER BY seq LIMIT ?', limit)
    .map((row) => ({ id: row.id, type: row.type, payload: JSON.parse(row.payload) }) as Mutation);
}

// ---- writes ----
let queue: Promise<unknown> = Promise.resolve();

/** Runs DB writes one at a time so transactions never overlap. */
function write(task: () => Promise<void>): Promise<void> {
  const next = queue.then(task, task);
  queue = next.catch((error) => console.warn('[db] write failed', error));
  return next;
}

export function writeKv(entries: Record<string, unknown>) {
  return write(async () => {
    await db.withTransactionAsync(async () => {
      for (const [key, value] of Object.entries(entries)) {
        if (value === undefined) continue;
        await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value));
      }
    });
  });
}

async function upsertIntake(intake: Intake) {
  await db.runAsync(
    `INSERT OR REPLACE INTO intakes (id, day, kind, source, amount_ml, detail_ml, at, voided, updated_at, pending)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    intake.id,
    intake.day,
    intake.kind,
    intake.source,
    intake.amount_ml,
    intake.detail_ml,
    intake.at,
    intake.voided ? 1 : 0,
    intake.updated_at,
    intake.pending ? 1 : 0
  );
}

async function upsertDay(day: DayLog) {
  await db.runAsync(
    'INSERT OR REPLACE INTO days (day, goal_ml, consumed_ml, met, met_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    day.day,
    day.goal_ml,
    day.consumed_ml,
    day.met ? 1 : 0,
    day.met_at,
    day.updated_at
  );
}

/**
 * A local change: its outbox entry plus, for a new sip, the pending intake row.
 * Only server truth is stored for days/status/profile; views re-apply the outbox on load.
 */
export function writeLocalMutation(mutation: Mutation, intake?: Intake) {
  return write(async () => {
    await db.withTransactionAsync(async () => {
      if (intake) await upsertIntake(intake);
      await db.runAsync(
        'INSERT OR IGNORE INTO outbox (id, type, payload, created_at) VALUES (?, ?, ?, ?)',
        mutation.id,
        mutation.type,
        JSON.stringify(mutation.payload),
        new Date().toISOString()
      );
    });
  });
}

/** Undo of a sip that never reached the server: drop it and its outbox entry. */
export function cancelLocalIntake(intakeId: string, mutationId: string) {
  return write(async () => {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM intakes WHERE id = ? AND pending = 1', intakeId);
      await db.runAsync('DELETE FROM outbox WHERE id = ?', mutationId);
    });
  });
}

/** Server pull. A full snapshot replaces confirmed rows; local unconfirmed intakes are kept. */
export function writeServerData(data: {
  full: boolean;
  intakes: Intake[];
  days: DayLog[];
  kv: Record<string, unknown>;
  ackedMutationIds: string[];
  rejectedIntakeIds: string[];
}) {
  return write(async () => {
    await db.withTransactionAsync(async () => {
      if (data.full) {
        await db.runAsync('DELETE FROM intakes WHERE pending = 0');
        await db.runAsync('DELETE FROM days');
      }
      for (const id of data.rejectedIntakeIds) await db.runAsync('DELETE FROM intakes WHERE id = ?', id);
      for (const intake of data.intakes) await upsertIntake({ ...intake, pending: false });
      for (const day of data.days) await upsertDay(day);
      for (const id of data.ackedMutationIds) await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
      for (const [key, value] of Object.entries(data.kv)) {
        await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value));
      }
    });
  });
}

export function pruneIntakes(beforeDay: string) {
  return write(() => db.runAsync('DELETE FROM intakes WHERE day < ? AND pending = 0', beforeDay).then(() => undefined));
}

export function clearAll() {
  return write(() => db.execAsync('DELETE FROM kv; DELETE FROM intakes; DELETE FROM days; DELETE FROM outbox;'));
}
