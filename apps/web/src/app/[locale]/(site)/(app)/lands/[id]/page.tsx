import { auth } from '@/auth';
import LandDetailContent from '@/components/lands/app/land-detail-content';
import { getLandById } from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { canManageReservations, isAdminLands } from '@/routes';
import type { LandDetail } from '@/types/lands';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const land = unwrap(await getLandById(id)) as LandDetail;
    return { title: land.title, description: land.description };
  } catch {
    return {};
  }
}

export default async function LandDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const userRoles = session?.user?.roles ?? [];
  const currentUserId = session?.user?.id ?? '';

  return (
    <div className="p-6 lg:p-8">
      <LandDetailContent
        id={id}
        currentUserId={currentUserId}
        isAdmin={isAdminLands(userRoles)}
        canManageReservations={canManageReservations(userRoles)}
      />
    </div>
  );
}
