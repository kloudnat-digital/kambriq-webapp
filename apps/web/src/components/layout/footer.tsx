import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { siteConfig } from '@/config/site.config';
import { KambriqLogo } from '@/components/ui/kambriq-logo';
import FooterLinkColumn from '@/components/layout/footer-link-column';
import LinkedIn from '@/components/icons/linkedin';
import Facebook from '@/components/icons/facebook';
import Youtube from '@/components/icons/youtube';
import NewsletterSignup from '../landing/newsletter-signup';
import type { FC } from 'react';

const Footer: FC = async () => {
  const t = await getTranslations('footer');
  const year = new Date().getFullYear();

  const socialLinks = [
    { href: siteConfig.social.linkedin, Icon: LinkedIn, label: 'LinkedIn' },
    { href: siteConfig.social.facebook, Icon: Facebook, label: 'Facebook' },
    { href: siteConfig.social.youtube, Icon: Youtube, label: 'YouTube' },
  ];

  return (
    <footer className="bg-accent text-white">
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-8 lg:px-8 lg:pt-28">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-10">
          {/* Brand column */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <KambriqLogo className="size-10" />
              <span className="font-serif text-2xl font-semibold text-white">KAMBRIQ</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-accent-200">{t('tagline')}</p>
            <div className="flex gap-5 pt-2">
              {socialLinks.map(({ href, Icon, label }) => (
                <Link
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-accent-300 transition-colors hover:text-white"
                >
                  <span className="sr-only">{label}</span>
                  <Icon className="size-5" />
                </Link>
              ))}
            </div>
          </div>

          {/* Products */}
          <FooterLinkColumn
            heading={t('productsServices')}
            links={[
              { href: '/products/lands', label: t('lands') },
              { href: '/products/verify', label: t('verify') },
              { href: '/products/kamnet', label: t('kamnet') },
              { href: '/products/kbs', label: t('kbs') },
            ]}
          />

          {/* Resources */}
          <FooterLinkColumn
            heading={t('support')}
            links={[
              { href: '/about', label: t('about') },
              { href: '/methode', label: t('methode') },
              { href: '/contact', label: t('contact') },
              { href: '/faq', label: t('faq') },
            ]}
          />

          {/* Contact */}
          <div>
            <h3 className="mb-4 text-xs font-semibold tracking-[0.12em] text-accent-300 uppercase">
              {t('contactUs')}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href={`mailto:${siteConfig.contact.email}`}
                  className="text-sm text-accent-100 transition-colors hover:text-white"
                >
                  {siteConfig.contact.email}
                </Link>
              </li>
              <li>
                <Link
                  href={`https://wa.me/${siteConfig.contact.whatsapp.number.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent-100 transition-colors hover:text-white"
                >
                  WhatsApp {siteConfig.contact.whatsapp.displayNumber}
                </Link>
              </li>
            </ul>

            <h3 className="mt-8 mb-4 text-xs font-semibold tracking-[0.12em] text-accent-300 uppercase">
              {t('legal')}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/legal/mentions"
                  className="text-sm text-accent-200 transition-colors hover:text-white"
                >
                  {t('mentions')}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/terms"
                  className="text-sm text-accent-200 transition-colors hover:text-white"
                >
                  {t('terms')}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/privacy"
                  className="text-sm text-accent-200 transition-colors hover:text-white"
                >
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/cookies"
                  className="text-sm text-accent-200 transition-colors hover:text-white"
                >
                  {t('cookies')}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/rgpd"
                  className="text-sm text-accent-200 transition-colors hover:text-white"
                >
                  {t('rgpd')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <NewsletterSignup className="mt-16 border-t border-white/10 pt-8" />

        {/* Bottom bar */}
        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-accent-400 sm:flex sm:items-center sm:justify-between">
          <p>
            &copy; {year} {t('copyright')}
          </p>
          <p className="mt-2 sm:mt-0">{t('tagline')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
