import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '@/features/auth/auth-store';
import { useTransactions } from '@/features/transactions/transaction-store';
import {
  countPendingChanges,
  countUnresolvedConflicts,
  getLastSyncedAt,
  runSync,
} from './sync-engine';

export type SyncStatus = 'disabled' | 'signed-out' | 'idle' | 'syncing' | 'error';

/** Outcome of the most recent sync attempt, independent of sign-in state. */
type RunStatus = 'idle' | 'syncing' | 'error';

type SyncStore = {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingCount: number;
  conflictCount: number;
  error?: string;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncStore | null>(null);

export function SyncProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const { user, isConfigured } = useAuth();
  const { refresh } = useTransactions();

  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [error, setError] = useState<string>();

  // Guards against overlapping runs when sign-in and app-foreground coincide.
  const isRunning = useRef(false);
  const userId = user?.id ?? null;

  const readCounters = useCallback(async () => {
    const [pending, conflicts, last] = await Promise.all([
      countPendingChanges(db),
      countUnresolvedConflicts(db),
      getLastSyncedAt(db),
    ]);
    setPendingCount(pending);
    setConflictCount(conflicts);
    setLastSyncedAt(last);
  }, [db]);

  const syncNow = useCallback(async () => {
    if (!isConfigured || !userId || isRunning.current) return;

    isRunning.current = true;
    setRunStatus('syncing');
    setError(undefined);

    try {
      const result = await runSync(db, userId);
      if (result.pulled > 0) await refresh();
      await readCounters();
      setRunStatus('idle');
    } catch (caught) {
      // Sync failure must never break the app: SQLite remains the source of
      // truth and every local change stays queued for the next attempt.
      setError(caught instanceof Error ? caught.message : 'Sync failed.');
      setRunStatus('error');
      await readCounters();
    } finally {
      isRunning.current = false;
    }
  }, [db, isConfigured, readCounters, refresh, userId]);

  useEffect(() => {
    if (!isConfigured || !userId) return;
    // Kicking off a network sync is an external-system effect, not derived
    // state; syncNow marks itself as running before it awaits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void syncNow();
  }, [isConfigured, syncNow, userId]);

  useEffect(() => {
    if (!isConfigured || !userId) return;

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncNow();
    });
    return () => subscription.remove();
  }, [isConfigured, syncNow, userId]);

  // Sign-in state fully determines these two, so they are derived rather than
  // mirrored into state by an effect.
  let status: SyncStatus = runStatus;
  if (!isConfigured) status = 'disabled';
  else if (!userId) status = 'signed-out';

  const value = useMemo<SyncStore>(
    () => ({ status, lastSyncedAt, pendingCount, conflictCount, error, syncNow }),
    [conflictCount, error, lastSyncedAt, pendingCount, status, syncNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const store = useContext(SyncContext);
  if (!store) throw new Error('useSync must be used within SyncProvider');
  return store;
}
