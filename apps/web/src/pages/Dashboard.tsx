import { useEffect, useState } from 'react';
import { Server, Zap, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiErrorResponse } from '../api/client';
import type { VersionRecord } from '@predecessor/data-model';

type SyncState =
  | { tag: 'idle' }
  | { tag: 'running'; op: string }
  | { tag: 'done'; op: string; result: string }
  | { tag: 'failed'; op: string; message: string };

export default function Dashboard() {
  const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [latestPatch, setLatestPatch] = useState<VersionRecord | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ tag: 'idle' });

  useEffect(() => { void fetchDashboardData(); }, []);

  async function fetchDashboardData() {
    const [health, patch] = await Promise.allSettled([
      apiClient.health(),
      apiClient.patches.latest(),
    ]);
    setHealthStatus(health.status === 'fulfilled' ? 'ok' : 'error');
    if (patch.status === 'fulfilled') setLatestPatch(patch.value);
  }

  async function handleSyncVersions() {
    setSyncState({ tag: 'running', op: 'Versions' });
    try {
      const res = await apiClient.admin.syncVersions();
      const label = `${res.synced} version${res.synced !== 1 ? 's' : ''} synced in ${(res.elapsed / 1000).toFixed(1)}s`;
      setSyncState({ tag: 'done', op: 'Versions', result: label });
      toast.success('Versions synced', { description: label });
      void fetchDashboardData();
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Sync failed';
      setSyncState({ tag: 'failed', op: 'Versions', message: msg });
      toast.error('Versions sync failed', { description: msg });
    }
  }

  async function handleSyncStale() {
    setSyncState({ tag: 'running', op: 'Players' });
    try {
      const res = await apiClient.admin.syncStale();
      const remaining = (res as { total?: number }).total ?? 0;
      const label = `${res.synced} synced · ${res.skipped} skipped · ${res.errors} errors${remaining > res.synced ? ` · ${remaining - res.synced} remaining` : ''}`;
      setSyncState({ tag: 'done', op: 'Players', result: label });
      if (res.errors > 0) {
        toast.warning('Players sync completed with errors', { description: label });
      } else if (remaining > res.synced) {
        toast.success(`Batch synced (${res.synced} players)`, { description: `${remaining - res.synced} more stale — click again to continue` });
      } else {
        toast.success('All players synced', { description: label });
      }
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Sync failed';
      setSyncState({ tag: 'failed', op: 'Players', message: msg });
      toast.error('Players sync failed', { description: msg });
    }
  }

  const isSyncing = syncState.tag === 'running';
  const statusColor = healthStatus === 'ok' ? 'var(--accent-win)' : healthStatus === 'error' ? 'var(--accent-loss)' : 'var(--accent-violet)';

  return (
    <div>
      <header className="header">
        <h1 className="header-title">Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.875rem' }}>
          System status and data controls.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
            <Server color="var(--accent-blue)" size={18} />
            <h3 style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>System Health</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              className={healthStatus === 'ok' ? 'led-pulse' : undefined}
              style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: statusColor,
                ['--pulse-color' as string]: 'var(--accent-win)',
                transition: 'background 0.3s',
              }}
            />
            <span style={{ color: healthStatus === 'ok' ? 'var(--text-primary)' : statusColor, fontWeight: 600, fontSize: '0.9rem' }}>
              {healthStatus === 'ok' ? 'API Online' : healthStatus === 'error' ? 'API Disconnected' : 'Checking…'}
            </span>
          </div>
          {healthStatus === 'ok' && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '0.35rem' }}>pred.gg pipeline active</p>
          )}
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
            <Zap color="var(--accent-violet)" size={18} />
            <h3 style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Patch</h3>
          </div>
          {latestPatch ? (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.65rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                v{latestPatch.name}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.45rem', fontFamily: 'var(--font-mono)' }}>
                {new Date(latestPatch.releaseDate).toLocaleDateString()} · {latestPatch.patchType}
              </p>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No patch data. Run "Sync Versions" below.
            </p>
          )}
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.1rem' }}>
            <RefreshCw
              color="var(--text-muted)"
              size={18}
              style={{ animation: isSyncing ? 'spin 0.8s linear infinite' : 'none' }}
            />
            <h3 style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Data Controls</h3>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <button
              onClick={() => void handleSyncVersions()}
              disabled={isSyncing || healthStatus !== 'ok'}
              className="btn-secondary"
              style={{ flex: 1 }}
            >
              Sync Versions
            </button>
            <button
              onClick={() => void handleSyncStale()}
              disabled={isSyncing || healthStatus !== 'ok'}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              Sync Players
            </button>
          </div>

          {syncState.tag === 'running' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
              Syncing {syncState.op}…
            </div>
          )}
          {syncState.tag === 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--accent-win)', fontFamily: 'var(--font-mono)' }}>
              <CheckCircle size={14} />
              {syncState.result}
            </div>
          )}
          {syncState.tag === 'failed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--accent-loss)', fontFamily: 'var(--font-mono)' }}>
              <XCircle size={14} />
              {syncState.op} failed: {syncState.message}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
