import { RoleCode } from '@/lib/roles';
import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.adminReservations');
  return { title: t('pageTitle') };
}

export default function AdminReservationsPage() {
  return (
    <PlaceholderPage
      namespace="app.adminReservations"
      titleKey="pageTitle"
      subtitleKey="subtitle"
      features={[
        'Vue globale de toutes les réservations',
        'Filtres par statut, agent, terrain',
        'Confirmation / annulation de réservation',
        'Export des données',
      ]}
      roles={['OPS', RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL, 'ROOT']}
    />
  );
}
