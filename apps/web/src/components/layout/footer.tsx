import { Link } from '@/i18n/navigation';
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
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-6 pb-8 sm:pt-24 lg:px-8 lg:pt-32">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <KambriqLogo />

          <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <FooterLinkColumn
                heading={t('productsServices')}
                links={[
                  { href: '/products/lands', label: t('lands') },
                  { href: '/products/verify', label: t('verify') },
                  { href: '/products/kamnet', label: t('kamnet') },
                  { href: '/products/kbs', label: t('kbs') },
                ]}
              />
              <div className="mt-10 md:mt-0">
                <FooterLinkColumn
                  heading={t('support')}
                  links={[
                    { href: '/about', label: t('about') },
                    { href: '/contact', label: t('contact') },
                    { href: '/faq', label: t('faq') },
                  ]}
                />
              </div>
            </div>
            <div>
              <FooterLinkColumn
                heading={t('legal')}
                links={[
                  { href: '/legal/mentions', label: t('mentions') },
                  { href: '/legal/terms', label: t('terms') },
                  { href: '/legal/privacy', label: t('privacy') },
                  { href: '/legal/rgpd', label: t('rgpd') },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Newsletter */}
        <NewsletterSignup className="mt-16" />

        {/* Bottom bar */}
        <div className="mt-8 border-t border-primary-foreground/20 pt-8 md:flex md:items-center md:justify-between">
          <div className="flex gap-x-6 md:order-2">
            {socialLinks.map(({ href, Icon, label }) => (
              <Link
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="hover:opacity-80"
              >
                <span className="sr-only">{label}</span>
                <Icon className="size-6" />
              </Link>
            ))}
          </div>
          <div className="mt-8 flex items-center gap-2 text-sm/6 text-primary-foreground/60 md:order-1 md:mt-0">
            <p>
              &copy; {year} {t('copyright')}
            </p>
            <p className="hidden sm:block">•</p>
            <p className="hidden sm:block">{t('tagline')}</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
