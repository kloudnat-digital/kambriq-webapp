import { IdentityReviewAction } from '@/components/identities/identity-review-action';
import { getUserForReview } from '@/lib/actions/payments';

export const metadata = { title: "Vérifier une pièce d'identité" };

export default async function IdentityReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserForReview(id);
  const documents = user.profile?.idDocumentUrls ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          {user.firstName} {user.lastName}
        </h1>
        <p className="text-sm text-gray-500">
          {user.email}
          {user.phone && <> — {user.phone}</>}
          {user.profile?.city && (
            <>
              {' '}
              — {user.profile.city}
              {user.profile.country && `, ${user.profile.country}`}
            </>
          )}
        </p>
      </header>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-semibold text-gray-900">Pièces déposées</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune pièce déposée.</p>
        ) : (
          <ul className="space-y-3">
            {documents.map((url, i) => (
              <li key={url}>
                {/* Signed at read time by the API. Opened rather than embedded:
                    an identity document is not something to render inline in a
                    page that may be screenshotted or printed by accident. */}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 underline underline-offset-2"
                >
                  Ouvrir la pièce {i + 1}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <IdentityReviewAction userId={id} />
    </div>
  );
}
