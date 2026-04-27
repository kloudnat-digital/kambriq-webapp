import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import { ContactInfo } from '@/components/contact/contact-info';
import { ContactForm } from '@/components/contact/contact-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.contact');
  return { title: t('title'), description: t('description') };
}

const ContactHero = () => {
  const t = useTranslations('contact.hero');
  return (
    <section className="bg-accent px-6 py-20 text-white sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-4xl leading-[1.05] font-semibold tracking-[-0.02em] text-white sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-4 text-lg leading-[1.65] text-accent-200">{t('subtitle')}</p>
      </div>
    </section>
  );
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main>
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
      <Footer />
    </>
  );
}
