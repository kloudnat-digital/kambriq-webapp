import Link from 'next/link';

import Navbar from '@/components/layout/navbar';

const LEGAL_LINKS = [
  { href: '/legal/mentions', label: 'Mentions légales' },
  { href: '/legal/terms', label: 'CGU' },
  { href: '/legal/privacy', label: 'Confidentialité' },
  { href: '/legal/rgpd', label: 'RGPD' },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <div className="border-b border-border bg-gray-50">
          <nav className="mx-auto flex max-w-5xl gap-6 overflow-x-auto px-6 py-4 sm:px-8">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 text-sm font-medium text-gray-600 transition-colors hover:text-primary-600"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mx-auto max-w-3xl px-6 py-14 sm:px-8">{children}</div>
      </main>
    </>
  );
}
