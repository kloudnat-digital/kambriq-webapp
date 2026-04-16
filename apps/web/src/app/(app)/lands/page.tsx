import { LandsCatalogContent } from '@/components/lands/app/lands-catalog-content';

export const metadata = { title: 'Catalogue terrains — KAMBRIQ' };

export default function LandsPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catalogue des terrains</h1>
        <p className="mt-1 text-sm text-gray-500">Parcourez et gérez les terrains disponibles</p>
      </div>
      <LandsCatalogContent />
    </div>
  );
}
