import { ReservationsContent } from '@/components/reservations/reservations-content';

export const metadata = { title: 'Réservations — KAMBRIQ' };

export default function ReservationsPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Réservations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Suivez toutes les réservations et leur avancement
        </p>
      </div>
      <ReservationsContent />
    </div>
  );
}
