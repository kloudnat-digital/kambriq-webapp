import { Link } from '@/i18n/navigation';
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
      <h3 className="text-sm/6 font-semibold">{heading}</h3>
      <ul className="mt-6 space-y-4">
        {links.map((link) => (
          <li key={link.href}>
            {link.disabled ? (
              <span className="text-sm/6 opacity-60">{link.label}</span>
            ) : (
              <Link href={link.href} className="text-sm/6 transition-opacity hover:opacity-80">
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
