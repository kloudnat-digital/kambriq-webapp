'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'sans-serif' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '16px',
            padding: '24px',
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', margin: 0 }}>
            Une erreur inattendue s&apos;est produite
          </h2>
          <button
            onClick={reset}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
