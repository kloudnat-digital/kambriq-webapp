import type { Metadata } from 'next';
import { LegalPolicyPage } from '@/components/cms/legal-policy-page';
import { publicPageMetadata } from '@/lib/seo/metadata';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/legal/mentions', 'metadata.legal.mentions');

export default async function MentionsPage() {
  return <LegalPolicyPage slug="legal-mentions" />;
}
