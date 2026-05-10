import { getLocale } from 'next-intl/server';

import { loadContent } from '@/lib/content';

export const metadata = {
  title: 'Politique KYC / AML | KAMBRIQ',
  description:
    'Politique KAMBRIQ de connaissance client (KYC) et de lutte contre le blanchiment de capitaux et le financement du terrorisme (AML/CFT).',
};

export default async function KycAmlPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-kyc-aml', locale);
  return <Content />;
}
