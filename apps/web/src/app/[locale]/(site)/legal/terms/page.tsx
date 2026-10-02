import type { Metadata } from 'next';
import { LegalPolicyPage } from '@/components/cms/legal-policy-page';
import { publicPageMetadata } from '@/lib/seo/metadata';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/legal/terms', 'metadata.legal.terms');

export default async function TermsPage() {
  return <LegalPolicyPage slug="legal-terms" />;
}
