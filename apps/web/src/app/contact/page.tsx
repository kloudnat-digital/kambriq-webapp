import { useTranslations } from 'next-intl';

import Navbar from '@/components/layout/navbar';
import { ContactInfo } from '@/components/contact/contact-info';
import { ContactForm } from '@/components/contact/contact-form';

const ContactHero = () => {
  const t = useTranslations('contact.hero');
  return (
    <section className="bg-gradient-to-b from-gray-900 to-gray-800 px-6 py-20 text-white sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-4 text-4xl font-bold">{t('title')}</h1>
        <p className="text-gray-300">{t('subtitle')}</p>
      </div>
    </section>
  );
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <ContactHero />
        <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <ContactInfo />
            </div>
            <div className="lg:col-span-3">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
