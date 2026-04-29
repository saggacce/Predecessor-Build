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

  useEffect(() => {
    void fetchDashboardData();
  }, []);

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
      void fetchDashboardData(); // refresh patch display
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
      const label = `${res.synced} synced · ${res.skipped} skipped · ${res.errors} errors`;
      setSyncState({ tag: 'done', op: 'Players', result: label });
      if (res.errors > 0) {
        toast.warning('Players sync completed with errors', { description: label });
      } else {
        toast.success('Players synced', { description: label });
      }
    } catch (err) {
      const msg = err instanceof ApiErrorResponse ? err.error.message : 'Sync failed';
      setSyncState({ tag: 'failed', op: 'Players', message: msg });
      toast.error('Players sync failed', { description: msg });
    }
  }

  const isSyncing = syncState.tag === 'running';

  return (
    <div className="dashboard">
      <header className="header">
        <h1 className="header-title">Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          System status and data controls.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>

        {/* System Health */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Server color="var(--accent-blue)" size={24} />
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>System Health</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: healthStatus === 'ok' ? 'var(--accent-success)'
                : healthStatus === 'error' ? 'var(--accent-danger)'
                : 'var(--accent-purple)',
              boxShadow: healthStatus === 'ok' ? '0 0 8px var(--accent-success)' : 'none',
            }} />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>
              {healthStatus === 'ok' ? 'API Online & Connected'
                : healthStatus === 'error' ? 'API Disconnected'
                : 'Checking...'}
            </span>
          </div>
        </div>

        {/* Current Patch */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Zap color="var(--accent-purple)" size={24} />
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Current Patch</h3>
          </div>
          {latestPatch ? (
            <>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                v{latestPatch.name}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {new Date(latestPatch.releaseDate).toLocaleDateString()} · {latestPatch.patchType}
              </span>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No patch data. Run "Sync Versions" to pull from pred.gg.
            </p>
          )}
        </div>

        {/* Data Sync Controls */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <RefreshCw
              color="var(--text-primary)"
              size={22}
              style={{ animation: isSyncing ? 'spin 0.8s linear infinite' : 'none' }}
            />
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Data Controls</h3>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <button
              onClick={() => void handleSyncVersions()}
              disabled={isSyncing || healthStatus !== 'ok'}
              className="btn-secondary"
            >
              Sync Versions
            </button>
            <button
              onClick={() => void handleSyncStale()}
              disabled={isSyncing || healthStatus !== 'ok'}
              className="btn-primary"
            >
              Sync Players
            </button>
          </div>

          {/* Live sync feedback */}
          {syncState.tag === 'running' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--accent-blue)' }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                border: '2px solid var(--accent-blue)',
                borderTopColor: 'transparent',
                animation: 'spin 0.6s linear infinite',
                flexShrink: 0,
              }} />
              Syncing {syncState.op}...
            </div>
          )}
          {syncState.tag === 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--accent-success)' }}>
              <CheckCircle size={16} />
              {syncState.op}: {syncState.result}
            </div>
          )}
          {syncState.tag === 'failed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--accent-danger)' }}>
              <XCircle size={16} />
              {syncState.op} failed: {syncState.message}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
