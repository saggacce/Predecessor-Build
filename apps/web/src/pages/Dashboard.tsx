import { useEffect, useState } from 'react';
import { Server, Zap, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type SyncCommand, ApiErrorResponse } from '../api/client';
import type { VersionRecord } from '@predecessor/data-model';

export default function Dashboard() {
  const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [latestPatch, setLatestPatch] = useState<VersionRecord | null>(null);
  const [syncing, setSyncing] = useState(false);

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

  async function handleSync(command: SyncCommand) {
    setSyncing(true);
    const toastId = toast.loading(`Running ${command}...`);
    try {
      const res = await apiClient.admin.syncData(command);
      toast.success(`${command} completed`, {
        id: toastId,
        description: res.stdout ? res.stdout.slice(0, 120) : undefined,
      });
      setTimeout(() => void fetchDashboardData(), 1000);
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : `Failed to run ${command}`;
      toast.error(message, { id: toastId });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="dashboard">
      <header className="header">
        <h1 className="header-title">Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Overview of the scouting engine and API connection.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Server color="var(--accent-blue)" size={24} />
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>System Health</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: healthStatus === 'ok' ? 'var(--accent-success)' : healthStatus === 'error' ? 'var(--accent-danger)' : 'var(--accent-purple)',
              boxShadow: healthStatus === 'ok' ? '0 0 10px var(--accent-success)' : 'none',
            }} />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              {healthStatus === 'ok' ? 'API Online & Connected' : healthStatus === 'error' ? 'API Disconnected' : 'Checking...'}
            </span>
          </div>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Zap color="var(--accent-purple)" size={24} />
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Current Patch</h3>
          </div>
          {latestPatch ? (
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                v{latestPatch.name}
              </div>
              <span style={{ color: 'var(--text-muted)' }}>Active game version tracked</span>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No patch data synced yet.</p>
          )}
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <RefreshCw
              color="var(--text-primary)"
              size={24}
              style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}
            />
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Data Controls</h3>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => void handleSync('sync-stale')}
              disabled={syncing || healthStatus !== 'ok'}
              className="btn-primary"
            >
              Sync Players
            </button>
            <button
              onClick={() => void handleSync('sync-versions')}
              disabled={syncing || healthStatus !== 'ok'}
              className="btn-secondary"
            >
              Sync Versions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
