import {
  LayoutGrid,
  Map,
  BookmarkCheck,
  CircleUser,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  Award,
  Users,
  ListChecks,
  CalendarClock,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  labelKey: string; // translation key under app.nav.items
  href: string;
  icon: LucideIcon;
  roles: string[]; // empty = all authenticated
  hideForRoles?: string[]; // if any of these roles is present, hide the item (e.g. hide "enroll" once enrolled)
  exact?: boolean; // true = highlight only on exact match, not on children (for index-like routes with sibling sub-routes)
};

export type NavSection = {
  labelKey: string; // translation key under app.nav.sections
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: 'sections.mySpace',
    items: [
      {
        labelKey: 'items.mylands',
        href: '/mylands',
        icon: LayoutGrid,
        roles: ['CLIENT'],
      },
      {
        labelKey: 'items.profile',
        href: '/account',
        icon: CircleUser,
        roles: ['CLIENT'],
      },
    ],
  },
  {
    labelKey: 'sections.lands',
    items: [
      {
        labelKey: 'items.catalogue',
        href: '/lands',
        icon: Map,
        roles: ['AGENT', 'ADMIN_LANDS', 'ADMIN_GLOBAL'],
      },
      {
        labelKey: 'items.reservations',
        href: '/reservations',
        icon: BookmarkCheck,
        roles: ['AGENT', 'ADMIN_LANDS', 'ADMIN_GLOBAL'],
      },
    ],
  },
  {
    labelKey: 'sections.kbs',
    items: [
      {
        labelKey: 'items.kbsEnroll',
        href: '/kbs/enroll',
        icon: GraduationCap,
        roles: [],
        hideForRoles: ['CANDIDATE_KBS'],
      },
      {
        labelKey: 'items.kbsDashboard',
        href: '/kbs',
        icon: BookOpen,
        roles: ['CANDIDATE_KBS'],
        exact: true,
      },
      {
        labelKey: 'items.kbsExam',
        href: '/kbs/exam',
        icon: ClipboardCheck,
        roles: ['CANDIDATE_KBS'],
      },
      {
        labelKey: 'items.kbsCertificate',
        href: '/kbs/certificate',
        icon: Award,
        roles: ['KCA_CERTIFIED'],
      },
    ],
  },
  {
    labelKey: 'sections.admin',
    items: [
      {
        labelKey: 'items.adminLands',
        href: '/admin/lands',
        icon: Map,
        roles: ['ADMIN_LANDS', 'ADMIN_GLOBAL'],
      },
    ],
  },
  {
    labelKey: 'sections.kbsAdmin',
    items: [
      {
        labelKey: 'items.adminKbsCandidates',
        href: '/admin/kbs/candidates',
        icon: Users,
        roles: ['ADMIN_KBS', 'ADMIN_GLOBAL'],
      },
      {
        labelKey: 'items.adminKbsCourse',
        href: '/admin/kbs/course',
        icon: BookOpen,
        roles: ['ADMIN_KBS', 'ADMIN_GLOBAL'],
      },
      {
        labelKey: 'items.adminKbsQuestions',
        href: '/admin/kbs/questions',
        icon: ListChecks,
        roles: ['ADMIN_KBS', 'ADMIN_GLOBAL'],
      },
      {
        labelKey: 'items.adminKbsExams',
        href: '/admin/kbs/exams',
        icon: CalendarClock,
        roles: ['ADMIN_KBS', 'ADMIN_GLOBAL'],
      },
      {
        labelKey: 'items.adminKbsCertificates',
        href: '/admin/kbs/certificates',
        icon: Award,
        roles: ['ADMIN_KBS', 'ADMIN_GLOBAL'],
      },
      {
        labelKey: 'items.adminKbsSettings',
        href: '/admin/kbs/settings',
        icon: Settings,
        roles: ['ADMIN_KBS', 'ADMIN_GLOBAL'],
      },
    ],
  },
  {
    labelKey: 'sections.account',
    items: [
      {
        labelKey: 'items.profile',
        href: '/account',
        icon: CircleUser,
        roles: ['AGENT', 'ADMIN_LANDS', 'ADMIN_GLOBAL', 'ADMIN_KBS'],
      },
    ],
  },
];

export const filterNavForRoles = (sections: NavSection[], userRoles: string[]): NavSection[] =>
  sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const rolesOk = item.roles.length === 0 || item.roles.some((r) => userRoles.includes(r));
        const notExcluded = !item.hideForRoles?.some((r) => userRoles.includes(r));
        return rolesOk && notExcluded;
      }),
    }))
    .filter((section) => section.items.length > 0);
