import type { Metadata } from 'next';
import { LegalPolicyPage } from '@/components/cms/legal-policy-page';
import { publicPageMetadata } from '@/lib/seo/metadata';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/legal/privacy', 'metadata.legal.privacy');

export default async function PrivacyPage() {
  return <LegalPolicyPage slug="legal-privacy" />;
}
