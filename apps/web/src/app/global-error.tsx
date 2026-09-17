'use client';

import { BRAND_INK, BRAND_ON_DARK, BRAND_TEAL } from '@/lib/brand-colors';

/**
 * A root error boundary renders its own `<html>` and `<body>`, replacing the
 * document - so `globals.css` is not in scope here and a `var(--color-...)`
 * reference would resolve to nothing. Making this page depend on the
 * stylesheet loading would make it depend on the thing that may have broken.
 *
 * The colours therefore come from `@/lib/brand-colors`, which is plain
 * TypeScript and needs no stylesheet. Before step 0 this file carried three
 * hex literals - and one of them, `#4f46e5`, was an indigo belonging to no
 * KAMBRIQ palette at all.
 */
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
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: BRAND_INK, margin: 0 }}>
            Une erreur inattendue s&apos;est produite
          </h2>
          <button
            onClick={reset}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              background: BRAND_TEAL,
              color: BRAND_ON_DARK,
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
