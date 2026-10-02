import type { Metadata } from 'next';
import { LegalPolicyPage } from '@/components/cms/legal-policy-page';
import { publicPageMetadata } from '@/lib/seo/metadata';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/legal/rgpd', 'metadata.legal.rgpd');

export default async function RgpdPage() {
  return <LegalPolicyPage slug="legal-rgpd" />;
}
