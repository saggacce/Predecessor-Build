import { useEffect, useMemo, useState } from 'react';
import { Edit3, ExternalLink, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient, type TeamMatch, type TeamProfile, type VodLink, type VodLinkInput, type VodLinkType, type VodVisibility } from '../api/client';

const VOD_TYPES: VodLinkType[] = [
  'full_match',
  'player_pov',
  'clip',
  'coach_review',
  'scrim_recording',
  'tournament_vod',
  'ingame_replay_ref',
];

const VISIBILITIES: VodVisibility[] = ['staff', 'team', 'player'];

type VodFormState = {
  teamId: string;
  matchId: string;
  playerId: string;
  type: VodLinkType;
  url: string;
  gameTimeStart: string;
  gameTimeEnd: string;
  videoTimestampStart: string;
  videoTimestampEnd: string;
  tags: string;
  notes: string;
  visibility: VodVisibility;
};

const emptyForm = (teamId = ''): VodFormState => ({
  teamId,
  matchId: '',
  playerId: '',
  type: 'full_match',
  url: '',
  gameTimeStart: '',
  gameTimeEnd: '',
  videoTimestampStart: '',
  videoTimestampEnd: '',
  tags: '',
  notes: '',
  visibility: 'staff',
});

function label(value: string) {
  return value.replace(/_/g, ' ');
}

function toSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : null;
}

function formToInput(form: VodFormState): VodLinkInput {
  return {
    teamId: form.teamId,
    matchId: form.matchId || null,
    playerId: form.playerId || null,
    type: form.type,
    url: form.url.trim(),
    gameTimeStart: toSeconds(form.gameTimeStart),
    gameTimeEnd: toSeconds(form.gameTimeEnd),
    videoTimestampStart: toSeconds(form.videoTimestampStart),
    videoTimestampEnd: toSeconds(form.videoTimestampEnd),
    tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    notes: form.notes.trim() || null,
    visibility: form.visibility,
  };
}

function vodToForm(vod: VodLink): VodFormState {
  return {
    teamId: vod.teamId,
    matchId: vod.matchId ?? '',
    playerId: vod.playerId ?? '',
    type: VOD_TYPES.includes(vod.type as VodLinkType) ? vod.type as VodLinkType : 'full_match',
    url: vod.url,
    gameTimeStart: vod.gameTimeStart?.toString() ?? '',
    gameTimeEnd: vod.gameTimeEnd?.toString() ?? '',
    videoTimestampStart: vod.videoTimestampStart?.toString() ?? '',
    videoTimestampEnd: vod.videoTimestampEnd?.toString() ?? '',
    tags: vod.tags.join(', '),
    notes: vod.notes ?? '',
    visibility: VISIBILITIES.includes(vod.visibility as VodVisibility) ? vod.visibility as VodVisibility : 'staff',
  };
}

function timestampUrl(url: string, seconds: number | null): string {
  if (!seconds) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('t', String(seconds));
    return parsed.toString();
  } catch {
    return url.includes('?') ? `${url}&t=${seconds}` : `${url}?t=${seconds}`;
  }
}

function formatSeconds(seconds: number | null) {
  if (seconds === null) return '-';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function groupKey(vod: VodLink) {
  if (vod.match?.startTime) return new Date(vod.match.startTime).toDateString();
  return 'Unlinked VODs';
}

export default function VodIndex() {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [vods, setVods] = useState<VodLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [playerFilter, setPlayerFilter] = useState('');
  const [form, setForm] = useState<VodFormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VodFormState>(emptyForm());

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;

  useEffect(() => {
    apiClient.teams.list('OWN')
      .then(({ teams: loadedTeams }) => {
        setTeams(loadedTeams);
        const firstTeamId = loadedTeams[0]?.id ?? '';
        setSelectedTeamId(firstTeamId);
        setForm(emptyForm(firstTeamId));
      })
      .catch((err) => {
        const message = err instanceof ApiErrorResponse ? err.error.message : 'Failed to load teams';
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTeamId) {
      setVods([]);
      setMatches([]);
      return;
    }

    setForm((current) => ({ ...current, teamId: selectedTeamId, matchId: '', playerId: '' }));
    setPlayerFilter('');
    setEditingId(null);
    Promise.all([
      apiClient.vod.list({ teamId: selectedTeamId }),
      apiClient.teams.getAnalysis(selectedTeamId).catch(() => null),
    ])
      .then(([vodRes, analysis]) => {
        setVods(vodRes.vods);
        setMatches(analysis?.teamMatches ?? []);
      })
      .catch((err) => {
        const message = err instanceof ApiErrorResponse ? err.error.message : 'Failed to load VOD links';
        toast.error(message);
      });
  }, [selectedTeamId]);

  const filteredVods = useMemo(() => {
    return vods.filter((vod) => (
      (!typeFilter || vod.type === typeFilter) &&
      (!playerFilter || vod.playerId === playerFilter)
    ));
  }, [playerFilter, typeFilter, vods]);

  const groupedVods = useMemo(() => {
    return filteredVods.reduce<Record<string, VodLink[]>>((groups, vod) => {
      const key = groupKey(vod);
      groups[key] = [...(groups[key] ?? []), vod];
      return groups;
    }, {});
  }, [filteredVods]);

  async function reloadVods() {
    if (!selectedTeamId) return;
    const res = await apiClient.vod.list({ teamId: selectedTeamId });
    setVods(res.vods);
  }

  async function handleCreate() {
    if (!form.teamId || !form.url.trim()) {
      toast.error('Team and URL are required');
      return;
    }
    setSaving(true);
    try {
      await apiClient.vod.create(formToInput(form));
      toast.success('VOD link added');
      setForm(emptyForm(selectedTeamId));
      await reloadVods();
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : 'Failed to add VOD link';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    try {
      await apiClient.vod.update(id, formToInput(editForm));
      toast.success('VOD link updated');
      setEditingId(null);
      await reloadVods();
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : 'Failed to update VOD link';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this VOD link?')) return;
    try {
      await apiClient.vod.delete(id);
      toast.success('VOD link deleted');
      await reloadVods();
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : 'Failed to delete VOD link';
      toast.error(message);
    }
  }

  function openVod(vod: VodLink) {
    window.open(timestampUrl(vod.url, vod.videoTimestampStart), '_blank', 'noopener,noreferrer');
  }

  const formGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.75rem',
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="header">
        <h1 className="header-title">VOD & Replay Index</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          External match video references, replay codes and review timestamps.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} style={{ minWidth: 220 }}>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="">All types</option>
          {VOD_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
        </select>
        <select value={playerFilter} onChange={(event) => setPlayerFilter(event.target.value)}>
          <option value="">All players</option>
          {selectedTeam?.roster.map((member) => (
            <option key={member.playerId} value={member.playerId}>{member.customName ?? member.displayName}</option>
          ))}
        </select>
      </div>

      <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
          <Plus size={16} /> Add VOD
        </div>
        <div style={formGridStyle}>
          <input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="URL" />
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as VodLinkType })}>
            {VOD_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
          </select>
          <select value={form.matchId} onChange={(event) => setForm({ ...form, matchId: event.target.value })}>
            <option value="">No match link</option>
            {matches.map((match) => (
              <option key={match.matchId} value={match.matchId}>{formatDate(match.startTime)} - {match.gameMode}</option>
            ))}
          </select>
          <select value={form.playerId} onChange={(event) => setForm({ ...form, playerId: event.target.value })}>
            <option value="">No player POV</option>
            {selectedTeam?.roster.map((member) => (
              <option key={member.playerId} value={member.playerId}>{member.customName ?? member.displayName}</option>
            ))}
          </select>
          <input value={form.gameTimeStart} onChange={(event) => setForm({ ...form, gameTimeStart: event.target.value })} placeholder="Game start sec" inputMode="numeric" />
          <input value={form.gameTimeEnd} onChange={(event) => setForm({ ...form, gameTimeEnd: event.target.value })} placeholder="Game end sec" inputMode="numeric" />
          <input value={form.videoTimestampStart} onChange={(event) => setForm({ ...form, videoTimestampStart: event.target.value })} placeholder="Video start sec" inputMode="numeric" />
          <input value={form.videoTimestampEnd} onChange={(event) => setForm({ ...form, videoTimestampEnd: event.target.value })} placeholder="Video end sec" inputMode="numeric" />
          <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as VodVisibility })}>
            {VISIBILITIES.map((visibility) => <option key={visibility} value={visibility}>{visibility}</option>)}
          </select>
          <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Tags, comma separated" />
        </div>
        <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Notes" rows={3} />
        <button className="btn-primary" type="button" onClick={handleCreate} disabled={saving || !selectedTeamId} style={{ alignSelf: 'flex-start' }}>
          <Plus size={15} /> Add link
        </button>
      </div>

      {loading && <div className="glass-card" style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading...</div>}

      {!loading && teams.length === 0 && (
        <div className="glass-card" style={{ padding: '1rem', color: 'var(--text-muted)' }}>No own teams available.</div>
      )}

      {!loading && selectedTeamId && filteredVods.length === 0 && (
        <div className="glass-card" style={{ padding: '1rem', color: 'var(--text-muted)' }}>No VOD links match the current filters.</div>
      )}

      {Object.entries(groupedVods).map(([group, items]) => (
        <section key={group} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>{group === 'Unlinked VODs' ? group : formatDate(items[0].match?.startTime ?? items[0].createdAt)}</h2>
          {items.map((vod) => {
            const isEditing = editingId === vod.id;
            return (
              <article key={vod.id} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {isEditing ? (
                  <>
                    <div style={formGridStyle}>
                      <input value={editForm.url} onChange={(event) => setEditForm({ ...editForm, url: event.target.value })} />
                      <select value={editForm.type} onChange={(event) => setEditForm({ ...editForm, type: event.target.value as VodLinkType })}>
                        {VOD_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
                      </select>
                      <input value={editForm.videoTimestampStart} onChange={(event) => setEditForm({ ...editForm, videoTimestampStart: event.target.value })} placeholder="Video start sec" />
                      <input value={editForm.tags} onChange={(event) => setEditForm({ ...editForm, tags: event.target.value })} placeholder="Tags" />
                    </div>
                    <textarea value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} rows={3} />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-primary" type="button" onClick={() => handleUpdate(vod.id)} disabled={saving}><Save size={15} /> Save</button>
                      <button className="btn-secondary" type="button" onClick={() => setEditingId(null)}><X size={15} /> Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{label(vod.type)}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          Game {formatSeconds(vod.gameTimeStart)} - Video {formatSeconds(vod.videoTimestampStart)} - {vod.visibility}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="btn-secondary" type="button" onClick={() => openVod(vod)}><ExternalLink size={15} /> Open</button>
                        <button className="btn-secondary" type="button" onClick={() => { setEditingId(vod.id); setEditForm(vodToForm(vod)); }}><Edit3 size={15} /> Edit</button>
                        <button className="btn-secondary" type="button" onClick={() => handleDelete(vod.id)}><Trash2 size={15} /> Delete</button>
                      </div>
                    </div>
                    {vod.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {vod.tags.map((tag) => (
                          <span key={tag} style={{ padding: '0.2rem 0.45rem', borderRadius: 4, background: 'var(--bg-dark)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{tag}</span>
                        ))}
                      </div>
                    )}
                    {vod.notes && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{vod.notes}</p>}
                  </>
                )}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
