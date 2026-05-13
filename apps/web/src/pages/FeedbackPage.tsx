import { useEffect, useState } from 'react';
import { Bug, Lightbulb, Zap, CheckCircle, Eye, XCircle, ChevronDown, ChevronUp, Image } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type FeedbackItem } from '../api/client';

const TYPE_CONFIG = {
  bug:         { label: 'Bug',        icon: <Bug size={12} />,       color: 'var(--accent-loss)' },
  suggestion:  { label: 'Sugerencia', icon: <Lightbulb size={12} />, color: 'var(--accent-prime)' },
  improvement: { label: 'Mejora',     icon: <Zap size={12} />,       color: 'var(--accent-blue)' },
} as const;

const STATUS_CONFIG = {
  NEW:       { label: 'Nuevo',     color: 'var(--accent-loss)',  bg: 'rgba(248,113,113,0.12)' },
  REVIEWED:  { label: 'Revisado',  color: 'var(--accent-win)',   bg: 'rgba(74,222,128,0.12)' },
  DISMISSED: { label: 'Descartado',color: 'var(--text-muted)',   bg: 'transparent' },
} as const;

export default function FeedbackPage() {
  const [reports, setReports] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiClient.feedback.list(statusFilter || undefined, typeFilter || undefined)
      .then(({ reports: r }) => setReports(r))
      .catch(() => toast.error('Error cargando feedbacks'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [statusFilter, typeFilter]);

  async function loadScreenshot(id: string) {
    try {
      const { report } = await apiClient.feedback.getDetail(id);
      setScreenshot(report.screenshotBase64 ?? null);
    } catch { toast.error('Error cargando pantallazo'); }
  }

  async function updateStatus(id: string, status: 'NEW' | 'REVIEWED' | 'DISMISSED') {
    setUpdating(id);
    try {
      const note = reviewNote.trim() || null;
      const { report: updated } = await apiClient.feedback.update(id, { status, reviewNote: note });
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, ...updated } : r));
      if (status !== 'NEW') setExpanded(null);
      toast.success(`Estado actualizado: ${STATUS_CONFIG[status].label}`);
    } catch { toast.error('Error al actualizar'); }
    finally { setUpdating(false); setReviewNote(''); }
  }

  function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); setScreenshot(null); return; }
    setExpanded(id);
    setScreenshot(null);
    setReviewNote('');
    const rep = reports.find((r) => r.id === id);
    if (rep) loadScreenshot(id);
  }

  const newCount = reports.filter((r) => r.status === 'NEW').length;

  return (
    <div>
      <header className="header">
        <div>
          <h1 className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            Feedback de usuarios
            {newCount > 0 && (
              <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'var(--accent-loss)', color: '#fff', borderRadius: 999, padding: '2px 8px' }}>
                {newCount} nuevo{newCount > 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
            Reportes de errores, sugerencias y mejoras enviados por los usuarios.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="glass-card" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.75rem 1rem' }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '0.38rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
          <option value="">Todos los estados</option>
          <option value="NEW">Nuevos</option>
          <option value="REVIEWED">Revisados</option>
          <option value="DISMISSED">Descartados</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          style={{ padding: '0.38rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
          <option value="">Todos los tipos</option>
          <option value="bug">Bugs</option>
          <option value="suggestion">Sugerencias</option>
          <option value="improvement">Mejoras</option>
        </select>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {reports.length} reporte{reports.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>Cargando…</div>
      ) : reports.length === 0 ? (
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No hay reportes{statusFilter || typeFilter ? ' con estos filtros' : ' todavía'}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {reports.map((r) => {
            const type = TYPE_CONFIG[r.type] ?? TYPE_CONFIG.bug;
            const status = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.NEW;
            const isExpanded = expanded === r.id;

            return (
              <div key={r.id} className="glass-card" style={{ padding: 0, overflow: 'hidden', opacity: r.status === 'DISMISSED' ? 0.6 : 1 }}>
                {/* Row */}
                <button
                  onClick={() => toggleExpand(r.id)}
                  style={{ width: '100%', display: 'grid', gridTemplateColumns: '28px 90px 130px 1fr 120px 100px 28px', gap: '0.75rem', alignItems: 'center', padding: '0.8rem 1.1rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ color: type.color }}>{type.icon}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: type.color }}>{type.label}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.section}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description.slice(0, 80)}{r.description.length > 80 ? '…' : ''}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                    {r.userName ?? r.userEmail ?? 'Anónimo'}
                  </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: status.color, background: status.bg, padding: '2px 7px', borderRadius: 999, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {status.label}
                  </span>
                  {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-color)', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Meta */}
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span>Enviado: <b style={{ color: 'var(--text-secondary)' }}>{new Date(r.createdAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b></span>
                      {r.userEmail && <span>Email: <b style={{ color: 'var(--text-secondary)' }}>{r.userEmail}</b></span>}
                      {r.reviewedAt && <span>Revisado: <b style={{ color: 'var(--text-secondary)' }}>{new Date(r.reviewedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short' })}</b></span>}
                    </div>

                    {/* Full description */}
                    <div style={{ background: 'var(--bg-dark)', borderRadius: 6, padding: '0.75rem 1rem', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {r.description}
                    </div>

                    {/* Screenshot */}
                    {screenshot && (
                      <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <img src={screenshot} alt="screenshot" style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain', background: '#000' }} />
                      </div>
                    )}
                    {screenshot === null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <Image size={13} /> Sin pantallazo adjunto
                      </div>
                    )}

                    {/* Review note */}
                    {r.reviewNote && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 6, padding: '0.6rem 0.85rem' }}>
                        <b style={{ color: 'var(--accent-win)' }}>Nota del revisor:</b> {r.reviewNote}
                      </div>
                    )}

                    {/* Actions */}
                    {r.status === 'NEW' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        <textarea
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          placeholder="Nota interna (opcional)…"
                          rows={2}
                          style={{ width: '100%', padding: '0.42rem 0.65rem', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.82rem', resize: 'none', fontFamily: 'inherit' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => void updateStatus(r.id, 'REVIEWED')} disabled={!!updating}
                            className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}>
                            <CheckCircle size={13} /> Marcar revisado
                          </button>
                          <button onClick={() => void updateStatus(r.id, 'DISMISSED')} disabled={!!updating}
                            className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.4rem 0.9rem', color: 'var(--text-muted)' }}>
                            <XCircle size={13} /> Descartar
                          </button>
                        </div>
                      </div>
                    )}
                    {r.status !== 'NEW' && (
                      <button onClick={() => void updateStatus(r.id, 'NEW')} disabled={!!updating}
                        style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 6, padding: '0.32rem 0.7rem', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Eye size={11} /> Reabrir
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
