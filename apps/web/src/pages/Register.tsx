import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { BadgeCheck, KeyRound, UserPlus, Clock, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient, type PublicInvitation } from '../api/client';

type InvitationErrorType = 'expired' | 'used' | 'not_found' | 'unknown';

function getErrorType(err: unknown): InvitationErrorType {
  if (err instanceof ApiErrorResponse) {
    if (err.error.code === 'INVITATION_EXPIRED') return 'expired';
    if (err.error.code === 'INVITATION_USED') return 'used';
    if (err.error.code === 'INVITATION_NOT_FOUND') return 'not_found';
  }
  return 'unknown';
}

export default function Register() {
  const { token = '' } = useParams();
  const [invitation, setInvitation] = useState<PublicInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<InvitationErrorType | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    apiClient.invitations
      .get(token)
      .then((res) => {
        setInvitation(res.invitation);
        setError(null);
      })
      .catch((err) => {
        const type = getErrorType(err);
        const message = err instanceof ApiErrorResponse ? err.error.message : 'Invitation not found';
        setError(message);
        setErrorType(type);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await apiClient.auth.register(token, name, password);
      toast.success('Account created.');
      window.location.assign('/');
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : 'Registration failed';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading invitation...</div>;
  }

  if (error || !invitation) {
    const isExpired = errorType === 'expired';
    const isUsed = errorType === 'used';
    return (
      <div style={{ maxWidth: '460px', margin: '2rem auto' }}>
        <div className="glass-card" style={{ display: 'grid', gap: '1rem', textAlign: 'center' }}>
          {isExpired
            ? <Clock size={36} style={{ color: 'var(--accent-prime)', margin: '0 auto' }} />
            : isUsed
            ? <Ban size={36} style={{ color: 'var(--accent-loss)', margin: '0 auto' }} />
            : <KeyRound size={36} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
          }
          <h1 className="header-title">
            {isExpired ? 'Invitation expired' : isUsed ? 'Invitation already used' : 'Invitation unavailable'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.6 }}>
            {isExpired
              ? 'This invitation link has expired. Contact your manager or coach to send you a new one.'
              : isUsed
              ? 'This invitation has already been used to create an account. Try logging in instead.'
              : (error ?? 'This invitation link is invalid or no longer available.')}
          </p>
          <Link className="btn-secondary" to="/login">
            <KeyRound size={16} />
            {isUsed ? 'Go to login' : 'Back to login'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <header className="header">
        <h1 className="header-title">Create account</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
          Invitation for {invitation.email}
        </p>
      </header>

      <form className="glass-card" onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>Role</div>
            <div style={{ marginTop: '0.25rem', color: 'var(--accent-blue)', fontWeight: 800 }}>{invitation.role}</div>
          </div>
          <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>Expires</div>
            <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
              {new Date(invitation.expiresAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
          Name
          <input
            className="input"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
          Password
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? <BadgeCheck size={16} /> : <UserPlus size={16} />}
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
