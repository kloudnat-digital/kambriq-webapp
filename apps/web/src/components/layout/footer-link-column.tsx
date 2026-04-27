import Link from 'next/link';
import type { FC } from 'react';

interface FooterLink {
  href: string;
  label: string;
  disabled?: boolean;
}

interface FooterLinkColumnProps {
  heading: string;
  links: FooterLink[];
}

const FooterLinkColumn: FC<FooterLinkColumnProps> = ({ heading, links }) => {
  return (
    <div>
      <h3 className="mb-4 text-xs font-semibold tracking-[0.12em] text-accent-300 uppercase">
        {heading}
      </h3>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            {link.disabled ? (
              <span className="text-sm text-accent-200/60">{link.label}</span>
            ) : (
              <Link
                href={link.href}
                className="text-sm text-accent-100 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FooterLinkColumn;
