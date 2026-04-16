import Navbar from '@/components/layout/navbar';
import { PartnersHero } from '@/components/partners/partners-hero';
import { PartnerBenefits } from '@/components/partners/partner-benefits';
import { PartnerForm } from '@/components/partners/partner-form';

export default function PartnersPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <PartnersHero />
        <PartnerBenefits />
        <PartnerForm />
      </main>
    </>
  );
}
