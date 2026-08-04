import { notFound } from 'next/navigation';
import { getModuleDetail } from '@/lib/actions/kbs';
import { KbsModuleDetailContent } from '@/components/kbs/kbs-module-detail-content';

interface Props {
  params: Promise<{ moduleId: string }>;
}

export default async function KbsModulePage({ params }: Props) {
  const { moduleId } = await params;
  const res = await getModuleDetail(moduleId);
  if (!res.success || !res.data) notFound();

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <KbsModuleDetailContent detail={res.data} />
    </div>
  );
}
