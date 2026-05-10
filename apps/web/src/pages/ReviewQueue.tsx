import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Plus, Trash2, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type ReviewItem, type TeamGoal, type TeamProfile } from '../api/client';
import { ApiErrorResponse } from '../api/client';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'FALSE_POSITIVE', label: 'False Positive' },
  { value: 'TEAM_ISSUE', label: 'Team Issue' },
  { value: 'PLAYER_ISSUE', label: 'Player Issue' },
  { value: 'DRAFT_ISSUE', label: 'Draft Issue' },
  { value: 'ADDED_TO_TRAINING', label: 'Added to Training' },
];

const TAG_OPTIONS = [
  { value: 'bad_objective_setup', label: 'Bad Objective Setup' },
  { value: 'facecheck', label: 'Facecheck' },
  { value: 'bad_reset', label: 'Bad Reset' },
  { value: 'late_rotation', label: 'Late Rotation' },
  { value: 'bad_engage', label: 'Bad Engage' },
  { value: 'ignored_call', label: 'Ignored Call' },
  { value: 'bad_secure', label: 'Bad Secure' },
  { value: 'poor_conversion', label: 'Poor Conversion' },
];

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'var(--accent-loss)',
  high: '#f97316',
  medium: '#f0b429',
  low: 'var(--text-muted)',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--text-muted)',
  IN_REVIEW: '#f0b429',
  REVIEWED: 'var(--accent-win)',
  FALSE_POSITIVE: 'var(--text-muted)',
  TEAM_ISSUE: 'var(--accent-loss)',
  PLAYER_ISSUE: '#f97316',
  DRAFT_ISSUE: 'var(--accent-violet)',
  ADDED_TO_TRAINING: 'var(--accent-win)',
};

const GOAL_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--text-muted)',
  ACTIVE: 'var(--accent-blue)',
  ACHIEVED: 'var(--accent-win)',
  FAILED: 'var(--accent-loss)',
  PAUSED: '#f0b429',
  ARCHIVED: 'var(--text-muted)',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ReviewQueue() {
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [goals, setGoals] = useState<TeamGoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'queue' | 'goals'>('queue');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalMetric, setNewGoalMetric] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalTimeframe, setNewGoalTimeframe] = useState('');

  // Load own teams on mount
  useEffect(() => {
    apiClient.teams.list('OWN')
      .then((res) => {
        setTeams(res.teams);
        if (res.teams.length > 0) setSelectedTeamId(res.teams[0].id);
      })
      .catch(() => toast.error('Failed to load teams.'));
  }, []);

  // Load items & goals when team changes
  useEffect(() => {
    if (!selectedTeamId) return;
    setLoading(true);
    Promise.all([
      apiClient.review.list(selectedTeamId, { status: statusFilter || undefined, priority: priorityFilter || undefined }),
      apiClient.goals.listTeam(selectedTeamId),
    ])
      .then(([reviewRes, goalsRes]) => {
        setItems(reviewRes.items);
        setGoals(goalsRes.goals);
      })
      .catch(() => toast.error('Failed to load review data.'))
      .finally(() => setLoading(false));
  }, [selectedTeamId, statusFilter, priorityFilter]);

  async function handleStatusChange(item: ReviewItem, status: string) {
    try {
      const updated = await apiClient.review.update(item.id, { status });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch { toast.error('Failed to update status.'); }
  }

  async function handleTagChange(item: ReviewItem, tag: string) {
    try {
      const updated = await apiClient.review.update(item.id, { tag });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch { toast.error('Failed to update tag.'); }
  }

  async function handleCommentSave(item: ReviewItem, comment: string) {
    try {
      const updated = await apiClient.review.update(item.id, { coachComment: comment });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      toast.success('Comment saved.');
    } catch { toast.error('Failed to save comment.'); }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.review.delete(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch { toast.error('Failed to delete item.'); }
  }

  async function handleCreateGoal() {
    if (!newGoalTitle.trim() || !selectedTeamId) return;
    try {
      const goal = await apiClient.goals.createTeam({
        teamId: selectedTeamId,
        title: newGoalTitle.trim(),
        metricId: newGoalMetric.trim() || undefined,
        targetValue: newGoalTarget ? parseFloat(newGoalTarget) : undefined,
        timeframe: newGoalTimeframe.trim() || undefined,
      });
      setGoals((prev) => [goal, ...prev]);
      setNewGoalTitle(''); setNewGoalMetric(''); setNewGoalTarget(''); setNewGoalTimeframe('');
      setShowNewGoal(false);
      toast.success('Goal created.');
    } catch { toast.error('Failed to create goal.'); }
  }

  async function handleGoalStatus(goal: TeamGoal, status: string) {
    try {
      const updated = await apiClient.goals.updateTeam(goal.id, { status });
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? updated : g)));
    } catch { toast.error('Failed to update goal.'); }
  }

  async function handleGoalDelete(id: string) {
    try {
      await apiClient.goals.deleteTeam(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch { toast.error('Failed to delete goal.'); }
  }

  const pendingCount = items.filter((i) => i.status === 'PENDING' || i.status === 'IN_REVIEW').length;
  const activeGoals = goals.filter((g) => g.status === 'ACTIVE').length;

  return (
    <div>
      <header className="header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="header-title">Review Queue</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Eventos críticos detectados por el Analyst y objetivos de entrenamiento del equipo.
          </p>
        </div>
      </header>

      {/* Team selector */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Equipo:</span>
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTeamId(t.id)}
            style={{ fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.75rem', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${selectedTeamId === t.id ? 'var(--accent-blue)' : 'var(--border-color)'}`, background: selectedTeamId === t.id ? 'rgba(91,156,246,0.12)' : 'transparent', color: selectedTeamId === t.id ? 'var(--accent-blue)' : 'var(--text-muted)', transition: 'all 0.15s' }}
          >
            {t.name}
          </button>
        ))}
        {teams.length === 0 && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No own teams configured.</span>}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Pending Review', value: pendingCount, color: pendingCount > 0 ? 'var(--accent-loss)' : 'var(--accent-win)' },
          { label: 'Total Items', value: items.length, color: 'var(--text-secondary)' },
          { label: 'Active Goals', value: activeGoals, color: 'var(--accent-blue)' },
          { label: 'Achieved Goals', value: goals.filter((g) => g.status === 'ACHIEVED').length, color: 'var(--accent-win)' },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>{kpi.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
        {(['queue', 'goals'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.55rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: activeTab === t ? 'var(--accent-blue)' : 'var(--text-muted)', borderBottom: activeTab === t ? '2px solid var(--accent-blue)' : '2px solid transparent', transition: 'color 0.15s' }}>
            {t === 'queue' ? `Review Queue${pendingCount > 0 ? ` (${pendingCount})` : ''}` : `Team Goals${activeGoals > 0 ? ` (${activeGoals})` : ''}`}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</div>}

      {/* ── REVIEW QUEUE TAB ─────────────────────────────────────────────── */}
      {!loading && activeTab === 'queue' && (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', width: 'auto' }}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="input" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', width: 'auto' }}>
              <option value="">All priorities</option>
              {['critical', 'high', 'medium', 'low'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>{items.length} items</span>
          </div>

          {items.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <CheckCircle size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No items in queue</div>
              <div style={{ fontSize: '0.75rem' }}>Items are created automatically from Analyst insights or manually from TeamAnalysis.</div>
            </div>
          ) : (
            items.map((item, i) => (
              <ReviewItemCard
                key={item.id}
                item={item}
                last={i === items.length - 1}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                onStatusChange={(s) => handleStatusChange(item, s)}
                onTagChange={(t) => handleTagChange(item, t)}
                onCommentSave={(c) => handleCommentSave(item, c)}
                onDelete={() => handleDelete(item.id)}
              />
            ))
          )}
        </div>
      )}

      {/* ── GOALS TAB ────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'goals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowNewGoal(!showNewGoal)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.45rem 1rem' }}>
              <Plus size={14} /> New Goal
            </button>
          </div>

          {showNewGoal && (
            <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>New Team Goal</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Title *</label>
                  <input className="input" value={newGoalTitle} onChange={(e) => setNewGoalTitle(e.target.value)} placeholder="e.g. Reduce deaths before Fangtooth" style={{ fontSize: '0.8rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Metric ID (optional)</label>
                  <input className="input" value={newGoalMetric} onChange={(e) => setNewGoalMetric(e.target.value)} placeholder="e.g. TEAM-013" style={{ fontSize: '0.8rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Target value</label>
                  <input className="input" type="number" value={newGoalTarget} onChange={(e) => setNewGoalTarget(e.target.value)} placeholder="e.g. 0.5" style={{ fontSize: '0.8rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Timeframe</label>
                  <input className="input" value={newGoalTimeframe} onChange={(e) => setNewGoalTimeframe(e.target.value)} placeholder="e.g. next 5 scrims" style={{ fontSize: '0.8rem' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setShowNewGoal(false)} style={{ fontSize: '0.78rem' }}>Cancel</button>
                <button className="btn-primary" onClick={handleCreateGoal} style={{ fontSize: '0.78rem' }}>Create</button>
              </div>
            </div>
          )}

          {goals.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No goals yet</div>
              <div style={{ fontSize: '0.75rem' }}>Create team goals linked to metrics to track improvement over time.</div>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              {goals.map((goal, i) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  last={i === goals.length - 1}
                  onStatusChange={(s) => handleGoalStatus(goal, s)}
                  onDelete={() => handleGoalDelete(goal.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ReviewItemCard ─────────────────────────────────────────────────────────────

function ReviewItemCard({ item, last, expanded, onToggle, onStatusChange, onTagChange, onCommentSave, onDelete }: {
  item: ReviewItem; last: boolean; expanded: boolean;
  onToggle: () => void;
  onStatusChange: (s: string) => void;
  onTagChange: (t: string) => void;
  onCommentSave: (c: string) => void;
  onDelete: () => void;
}) {
  const [comment, setComment] = useState(item.coachComment ?? '');
  const prioColor = PRIORITY_COLOR[item.priority] ?? 'var(--text-muted)';
  const statusColor = STATUS_COLOR[item.status] ?? 'var(--text-muted)';
  const isPending = item.status === 'PENDING' || item.status === 'IN_REVIEW';

  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--border-color)', borderLeft: `3px solid ${prioColor}` }}>
      {/* Row */}
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer', background: isPending ? `${prioColor}08` : 'transparent', transition: 'background 0.15s' }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: prioColor, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.reason}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.1rem 0.4rem', borderRadius: 999, background: `${prioColor}22`, color: prioColor }}>{item.priority}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.eventType}</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem', fontFamily: 'var(--font-mono)' }}>
            {new Date(item.createdAt).toLocaleDateString()}
            {item.tag && <span style={{ marginLeft: '0.5rem', color: statusColor }}> · {item.tag.replace(/_/g, ' ')}</span>}
          </div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', padding: '0.15rem 0.5rem', borderRadius: 999, background: `${statusColor}18`, color: statusColor, flexShrink: 0 }}>{item.status.replace(/_/g, ' ')}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ padding: '0.75rem 1rem 1rem', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>Status</label>
              <select value={item.status} onChange={(e) => onStatusChange(e.target.value)} className="input" style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>Causa</label>
              <select value={item.tag ?? ''} onChange={(e) => onTagChange(e.target.value)} className="input" style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}>
                <option value="">— Sin etiquetar —</option>
                {TAG_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>Nota del coach</label>
            <textarea
              className="input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              style={{ resize: 'vertical', fontSize: '0.78rem', width: '100%' }}
              placeholder="Añade contexto, causa real o acción correctiva…"
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button onClick={onDelete} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--accent-loss)', background: 'none', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '5px', padding: '0.3rem 0.6rem', cursor: 'pointer' }}>
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={() => onCommentSave(comment)} className="btn-primary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem' }}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── GoalCard ──────────────────────────────────────────────────────────────────

function GoalCard({ goal, last, onStatusChange, onDelete }: {
  goal: TeamGoal; last: boolean;
  onStatusChange: (s: string) => void;
  onDelete: () => void;
}) {
  const statusColor = GOAL_STATUS_COLOR[goal.status] ?? 'var(--text-muted)';
  const progress = goal.baselineValue !== null && goal.targetValue !== null && goal.currentValue !== null
    ? Math.min(Math.max((goal.currentValue - goal.baselineValue) / (goal.targetValue - goal.baselineValue), 0), 1)
    : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderBottom: last ? 'none' : '1px solid var(--border-color)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{goal.title}</span>
          {goal.metricId && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>{goal.metricId}</span>}
        </div>
        {goal.timeframe && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{goal.timeframe}</div>}
        {progress !== null && (
          <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: progress >= 1 ? 'var(--accent-win)' : 'var(--accent-blue)', borderRadius: 999 }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', flexShrink: 0 }}>{Math.round(progress * 100)}%</span>
          </div>
        )}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', padding: '0.15rem 0.5rem', borderRadius: 999, background: `${statusColor}18`, color: statusColor, flexShrink: 0 }}>{goal.status}</span>
      <select value={goal.status} onChange={(e) => onStatusChange(e.target.value)} className="input" style={{ fontSize: '0.68rem', padding: '0.2rem 0.4rem', width: 'auto', flexShrink: 0 }}>
        {['DRAFT','ACTIVE','ACHIEVED','FAILED','PAUSED','ARCHIVED'].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem', flexShrink: 0 }} title="Delete goal">
        <Trash2 size={13} />
      </button>
    </div>
  );
}
