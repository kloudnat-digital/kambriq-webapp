import { MyLandsContent } from '@/components/mylands/mylands-content';

export default function MyLandsPage() {
  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Mes terrains</h1>
      <MyLandsContent />
    </div>
  );
}
