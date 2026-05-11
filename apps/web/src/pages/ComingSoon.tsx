import { Construction } from 'lucide-react';

interface ComingSoonProps {
  section: string;
  description?: string;
  issue?: number;
}

export default function ComingSoon({ section, description, issue }: ComingSoonProps) {
  return (
    <div style={{ padding: '2rem', maxWidth: '480px' }}>
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <Construction size={36} style={{ color: 'var(--accent-teal)', marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          {section}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
          {description ?? 'This section is under development and will be available in a future update.'}
        </p>
        {issue && (
          <a
            href={`https://github.com/saggacce/Predecessor-Build/issues/${issue}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--accent-teal)' }}
          >
            Track progress → Issue #{issue}
          </a>
        )}
      </div>
    </div>
  );
}
