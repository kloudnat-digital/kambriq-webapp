import { auth } from '@/auth';
import ReservationDetailContent from '@/components/reservations/reservation-detail-content';
import { isAdminLands } from '@/routes';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReservationDetailPage({ params }: Props) {
  const [param, session] = await Promise.all([params, auth()]);
  const userRoles = session?.user?.roles ?? [];
  const currentUserId = session?.user?.id ?? '';
  return (
    <div className="p-6 lg:p-8">
      <ReservationDetailContent
        id={param.id}
        currentUserId={currentUserId}
        isAdmin={isAdminLands(userRoles)}
      />
    </div>
  );
}
