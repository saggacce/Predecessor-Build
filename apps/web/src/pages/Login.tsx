import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { KeyRound, LogIn, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient } from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.auth.internalLogin(email, password);
      toast.success('Session started.');
      window.location.assign('/');
    } catch (err) {
      const message = err instanceof ApiErrorResponse ? err.error.message : 'Login failed';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: '440px', margin: '2rem auto' }}>
      <header className="header">
        <h1 className="header-title">Login</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.35rem' }}>
          Internal Rift Line session.
        </p>
      </header>

      <form className="glass-card" onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
          Email
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
          Password
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="btn-primary" type="submit" disabled={submitting}>
          <LogIn size={16} />
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="glass-card" style={{ marginTop: '1rem', padding: '1rem', display: 'grid', gap: '0.7rem' }}>
        <a className="btn-secondary" href={apiClient.auth.loginUrl()}>
          <Radio size={16} />
          Connect pred.gg
        </a>
        <Link className="btn-secondary" to="/">
          <KeyRound size={16} />
          Back to workspace
        </Link>
      </div>
    </div>
  );
}
