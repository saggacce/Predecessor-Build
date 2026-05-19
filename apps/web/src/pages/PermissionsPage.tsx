import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type PlatformPermissions, type ConfigurableRole, type PermissionKey } from '../api/client';

const ROLES: ConfigurableRole[] = ['PLATFORM_ADMIN', 'MANAGER', 'COACH', 'ANALISTA', 'JUGADOR'];

const ROLE_LABELS: Record<ConfigurableRole, string> = {
  PLATFORM_ADMIN: 'Platform Admin',
  MANAGER: 'Manager',
  COACH: 'Coach',
  ANALISTA: 'Analista',
  JUGADOR: 'Jugador',
};

type PermRow = {
  key: PermissionKey;
  label: string;
  indent?: boolean;
};

type PermSection = {
  id: string;
  label: string;
  rows: PermRow[];
};

const SECTIONS: PermSection[] = [
  {
    id: 'teams-own',
    label: 'Equipo propio',
    rows: [
      { key: 'teams.own.view', label: 'Ver equipo propio' },
      { key: 'teams.own.create', label: 'Crear equipo', indent: true },
      { key: 'teams.own.edit', label: 'Editar equipo', indent: true },
      { key: 'teams.own.delete', label: 'Eliminar equipo', indent: true },
      { key: 'teams.own.addPlayer', label: 'Añadir jugador', indent: true },
      { key: 'teams.own.removePlayer', label: 'Eliminar jugador', indent: true },
      { key: 'teams.own.editPlayerName', label: 'Editar nombre de jugador', indent: true },
      { key: 'teams.own.syncMatches', label: 'Sincronizar partidas', indent: true },
    ],
  },
  {
    id: 'teams-rival',
    label: 'Equipo rival',
    rows: [
      { key: 'teams.rival.view', label: 'Ver equipos rivales' },
      { key: 'teams.rival.create', label: 'Añadir rival', indent: true },
      { key: 'teams.rival.edit', label: 'Editar rival', indent: true },
      { key: 'teams.rival.delete', label: 'Eliminar rival', indent: true },
      { key: 'teams.rival.addPlayer', label: 'Añadir jugador al rival', indent: true },
      { key: 'teams.rival.removePlayer', label: 'Eliminar jugador del rival', indent: true },
      { key: 'teams.rival.syncMatches', label: 'Sincronizar partidas del rival', indent: true },
    ],
  },
  {
    id: 'team-analysis',
    label: 'Team Analysis',
    rows: [
      { key: 'teamAnalysis.view', label: 'Ver sección' },
      { key: 'teamAnalysis.performance', label: 'Tab Performance', indent: true },
      { key: 'teamAnalysis.draft', label: 'Tab Draft', indent: true },
      { key: 'teamAnalysis.vision', label: 'Tab Vision / Objectives', indent: true },
      { key: 'teamAnalysis.analyst', label: 'Tab Analyst (IA)', indent: true },
    ],
  },
  {
    id: 'player-scouting',
    label: 'Player Scouting',
    rows: [
      { key: 'playerScouting.view', label: 'Ver sección' },
      { key: 'playerScouting.syncPlayer', label: 'Sincronizar jugador', indent: true },
      { key: 'playerScouting.editPlayerName', label: 'Editar nombre de jugador', indent: true },
      { key: 'playerGoals.view', label: 'Ver objetivos de jugador', indent: true },
      { key: 'playerGoals.create', label: 'Crear objetivo', indent: true },
      { key: 'playerGoals.edit', label: 'Editar objetivo', indent: true },
      { key: 'playerGoals.delete', label: 'Eliminar objetivo', indent: true },
    ],
  },
  {
    id: 'match-detail',
    label: 'Match Detail',
    rows: [
      { key: 'matchDetail.view', label: 'Ver detalle de partida' },
      { key: 'matchDetail.syncMatch', label: 'Sincronizar partida', indent: true },
      { key: 'matchDetail.editPlayerName', label: 'Editar nombre de jugador', indent: true },
      { key: 'matchDetail.scoreboard', label: 'Tab Scoreboard', indent: true },
      { key: 'matchDetail.statistics', label: 'Tab Statistics', indent: true },
      { key: 'matchDetail.timeline', label: 'Tab Timeline', indent: true },
      { key: 'matchDetail.analysis', label: 'Tab Analysis', indent: true },
    ],
  },
  {
    id: 'scrim-report',
    label: 'Battle Plan / Scrim Report',
    rows: [
      { key: 'scrimReport.view', label: 'Ver sección' },
      { key: 'scrimReport.export', label: 'Exportar PDF / portapapeles', indent: true },
    ],
  },
  {
    id: 'review-queue',
    label: 'Review Queue',
    rows: [
      { key: 'reviewQueue.view', label: 'Ver cola de revisión' },
      { key: 'reviewQueue.createItem', label: 'Crear review item', indent: true },
      { key: 'reviewQueue.editItem', label: 'Editar estado / nota', indent: true },
      { key: 'reviewQueue.deleteItem', label: 'Eliminar review item', indent: true },
      { key: 'teamGoals.view', label: 'Ver objetivos de equipo', indent: true },
      { key: 'teamGoals.create', label: 'Crear objetivo', indent: true },
      { key: 'teamGoals.edit', label: 'Editar objetivo', indent: true },
      { key: 'teamGoals.delete', label: 'Eliminar objetivo', indent: true },
    ],
  },
  {
    id: 'vod-index',
    label: 'VOD Index',
    rows: [
      { key: 'vodIndex.view', label: 'Ver sección' },
      { key: 'vodIndex.create', label: 'Añadir VOD', indent: true },
      { key: 'vodIndex.edit', label: 'Editar VOD', indent: true },
      { key: 'vodIndex.delete', label: 'Eliminar VOD', indent: true },
    ],
  },
  {
    id: 'invitations',
    label: 'Staff & Invitaciones',
    rows: [
      { key: 'invitations.view', label: 'Ver gestión de invitaciones' },
      { key: 'invitations.create', label: 'Crear invitación', indent: true },
      { key: 'invitations.revoke', label: 'Revocar invitación', indent: true },
    ],
  },
  {
    id: 'platform-admin',
    label: 'Platform Admin',
    rows: [
      { key: 'platformAdmin.view', label: 'Ver sección Platform Admin' },
      { key: 'platformAdmin.dataControls', label: 'Data Controls', indent: true },
      { key: 'platformAdmin.staff', label: 'Staff & Users', indent: true },
      { key: 'platformAdmin.auditLogs', label: 'Audit Logs', indent: true },
      { key: 'platformAdmin.feedback', label: 'Feedback', indent: true },
      { key: 'platformAdmin.permissions', label: 'Permisos (esta página)', indent: true },
    ],
  },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: value ? 'var(--accent-teal-bright)' : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
      title={value ? 'Permitido' : 'Denegado'}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 18 : 3,
        width: 14, height: 14, borderRadius: '50%',
        background: value ? '#fff' : 'rgba(255,255,255,0.4)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

export default function PermissionsPage() {
  const [perms, setPerms] = useState<PlatformPermissions | null>(null);
  const [defaults, setDefaults] = useState<PlatformPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(SECTIONS.map((s) => s.id)));
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    apiClient.admin.getPermissions()
      .then((res) => { setPerms(res.permissions); setDefaults(res.defaults); })
      .catch(() => toast.error('Error cargando permisos'))
      .finally(() => setLoading(false));
  }, []);

  function toggleSection(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function setPerm(role: ConfigurableRole, key: PermissionKey, value: boolean) {
    if (!perms) return;
    setPerms({ ...perms, [role]: { ...perms[role], [key]: value } });
  }

  function setSectionAll(sectionId: string, role: ConfigurableRole, value: boolean) {
    if (!perms) return;
    const section = SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;
    const updates = Object.fromEntries(section.rows.map((r) => [r.key, value]));
    setPerms({ ...perms, [role]: { ...perms[role], ...updates } });
  }

  async function handleSave() {
    if (!perms) return;
    setSaving(true);
    try {
      await apiClient.admin.savePermissions(perms);
      toast.success('Permisos guardados');
    } catch {
      toast.error('Error guardando permisos');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('¿Restaurar todos los permisos a los valores por defecto?')) return;
    setSaving(true);
    try {
      const res = await apiClient.admin.resetPermissions();
      setPerms(res.permissions);
      toast.success('Permisos restaurados a defaults');
    } catch {
      toast.error('Error restaurando permisos');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Cargando permisos…</div>;
  if (!perms) return <div style={{ padding: '2rem', color: 'var(--accent-loss)' }}>Error cargando permisos.</div>;

  return (
    <div style={{ maxWidth: 1100 }}>
      <header className="header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Shield size={20} style={{ color: 'var(--accent-violet)' }} />
          <h1 className="header-title">Permisos de plataforma</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Configura qué puede ver y hacer cada rol. <strong style={{ color: 'var(--accent-teal-bright)' }}>SUPER_ADMIN</strong> tiene acceso total y no puede ser modificado.
        </p>
      </header>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setAdvanced((v) => !v)}
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', borderRadius: 6, border: '1px solid var(--border-color)', background: advanced ? 'rgba(167,139,250,0.15)' : 'transparent', color: advanced ? 'var(--accent-violet)' : 'var(--text-secondary)', cursor: 'pointer' }}
        >
          {advanced ? 'Vista básica' : 'Vista avanzada'}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleReset}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.35rem 0.85rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <RotateCcw size={13} /> Restaurar defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.35rem 0.85rem', borderRadius: 6, border: 'none', background: 'var(--accent-blue)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            <Save size={13} /> {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, width: '35%' }}>
                Sección / Acción
              </th>
              {ROLES.map((role) => (
                <th key={role} style={{ textAlign: 'center', padding: '0.6rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 600, minWidth: 100 }}>
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((section) => {
              const isExpanded = expanded.has(section.id);
              return [
                // Section header row
                <tr
                  key={section.id}
                  onClick={() => advanced && toggleSection(section.id)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: advanced ? 'pointer' : 'default',
                  }}
                >
                  <td style={{ padding: '0.55rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {advanced && (isExpanded
                        ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
                        : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                      )}
                      {section.label}
                    </div>
                  </td>
                  {ROLES.map((role) => {
                    const allOn = section.rows.every((r) => perms[role][r.key]);
                    const allOff = section.rows.every((r) => !perms[role][r.key]);
                    const mixed = !allOn && !allOff;
                    return (
                      <td key={role} style={{ textAlign: 'center', padding: '0.55rem 0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <Toggle
                            value={allOn}
                            onChange={(v) => setSectionAll(section.id, role, v)}
                          />
                          {mixed && advanced && (
                            <span style={{ fontSize: '0.6rem', color: 'var(--accent-prime)', fontFamily: 'var(--font-mono)' }}>parcial</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>,
                // Expanded detail rows (advanced mode only)
                ...(advanced && isExpanded ? section.rows.map((row) => (
                  <tr key={row.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.4rem 0.75rem 0.4rem 2.2rem', color: row.indent ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '0.78rem' }}>
                      {row.label}
                    </td>
                    {ROLES.map((role) => (
                      <td key={role} style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>
                        <Toggle
                          value={perms[role][row.key]}
                          onChange={(v) => setPerm(role, row.key, v)}
                        />
                      </td>
                    ))}
                  </tr>
                )) : []),
              ];
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Los cambios se aplican a todos los usuarios del rol al guardar. Los permisos de <strong>SUPER_ADMIN</strong> no pueden modificarse.
      </p>
    </div>
  );
}
