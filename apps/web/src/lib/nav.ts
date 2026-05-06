import { LayoutGrid, Map, BookmarkCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[]; // empty = all authenticated
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'LANDS',
    items: [
      {
        label: 'Mes terrains',
        href: '/mylands',
        icon: LayoutGrid,
        roles: ['CLIENT'],
      },
      {
        label: 'Catalogue',
        href: '/lands',
        icon: Map,
        roles: ['AGENT', 'ADMIN_LANDS', 'ADMIN_GLOBAL'],
      },
      {
        label: 'Réservations',
        href: '/reservations',
        icon: BookmarkCheck,
        roles: ['AGENT', 'ADMIN_LANDS', 'ADMIN_GLOBAL'],
      },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      {
        label: 'Lands',
        href: '/admin/lands',
        icon: Map,
        roles: ['ADMIN_LANDS', 'ADMIN_GLOBAL'],
      },
    ],
  },
];

export const filterNavForRoles = (sections: NavSection[], userRoles: string[]): NavSection[] =>
  sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.roles.length === 0 || item.roles.some((r) => userRoles.includes(r)),
      ),
    }))
    .filter((section) => section.items.length > 0);
