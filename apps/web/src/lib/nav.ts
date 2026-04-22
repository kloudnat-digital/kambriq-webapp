import {
  LayoutGrid,
  Map,
  BookmarkCheck,
  UserPlus,
  User,
  GraduationCap,
  BookOpen,
  Award,
  ClipboardList,
  Users,
  Network,
  Wallet,
  AlertTriangle,
  ShieldCheck,
  FileSearch,
  Settings,
  UserCog,
} from 'lucide-react';
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

// ── Role constants (match backend RBAC) ──────────────────────────────
const CLIENT = 'CLIENT';
const AGENT = 'AGENT';
const OPS = 'OPS';
const ADMIN_KBS = 'ADMIN_KBS';
const ADMIN_KAMNET = 'ADMIN_KAMNET';
const ADMIN_LANDS = 'ADMIN_LANDS';
const ADMIN_GLOBAL = 'ADMIN_GLOBAL';
const ROOT = 'ROOT';

const ADMINS = [OPS, ADMIN_GLOBAL, ROOT];
const AGENTS_ALL = [AGENT, ...ADMINS];
const AGENTS_CONFIRMED = [AGENT, ...ADMINS]; // level-based filtering done at page level

export const NAV_SECTIONS: NavSection[] = [
  // ── Mon espace (all authenticated) ───────────────────────────────
  {
    label: 'Mon espace',
    items: [{ label: 'Mon profil', href: '/profile', icon: User, roles: [] }],
  },

  // ── Client ───────────────────────────────────────────────────────
  {
    label: 'Client',
    items: [
      { label: 'Mes terrains', href: '/mylands', icon: LayoutGrid, roles: [CLIENT] },
      { label: 'Mes vérifications', href: '/client/verify', icon: FileSearch, roles: [CLIENT] },
    ],
  },

  // ── Agent KAMNET ─────────────────────────────────────────────────
  {
    label: 'KAMNET',
    items: [
      { label: 'Dashboard', href: '/agent/dashboard', icon: LayoutGrid, roles: AGENTS_ALL },
      { label: 'KAMBRIQ LANDS', href: '/lands', icon: Map, roles: AGENTS_ALL },
      { label: 'Mes prospects', href: '/agent/prospects', icon: Users, roles: AGENTS_ALL },
      {
        label: 'Réservations',
        href: '/reservations',
        icon: BookmarkCheck,
        roles: AGENTS_CONFIRMED,
      },
      { label: 'Mon réseau', href: '/agent/network', icon: Network, roles: AGENTS_ALL },
      { label: 'Commissions', href: '/agent/commissions', icon: Wallet, roles: AGENTS_CONFIRMED },
      { label: 'Escalade', href: '/agent/escalation/new', icon: AlertTriangle, roles: AGENTS_ALL },
    ],
  },

  // ── KBS (candidat en formation) ──────────────────────────────────
  {
    label: 'Formation KBS',
    items: [
      { label: 'Mon parcours', href: '/kbs/dashboard', icon: GraduationCap, roles: [] },
      { label: 'Examen KCA', href: '/kbs/exam', icon: ClipboardList, roles: [] },
      { label: 'Mon certificat', href: '/kbs/certificate', icon: Award, roles: [] },
    ],
  },

  // ── Administration ───────────────────────────────────────────────
  {
    label: 'Administration',
    items: [
      {
        label: 'Admin LANDS',
        href: '/admin/lands',
        icon: Map,
        roles: [OPS, ADMIN_LANDS, ADMIN_GLOBAL, ROOT],
      },
      {
        label: 'Admin réservations',
        href: '/admin/reservations',
        icon: BookmarkCheck,
        roles: [OPS, ADMIN_LANDS, ADMIN_GLOBAL, ROOT],
      },
      {
        label: 'Admin VERIFY™',
        href: '/admin/verify',
        icon: ShieldCheck,
        roles: [OPS, ADMIN_GLOBAL, ROOT],
      },
      {
        label: 'Admin KBS',
        href: '/admin/kbs',
        icon: BookOpen,
        roles: [ADMIN_KBS, ADMIN_GLOBAL, ROOT],
      },
      {
        label: 'Admin KAMNET',
        href: '/admin/kamnet',
        icon: UserCog,
        roles: [ADMIN_KAMNET, ADMIN_GLOBAL, ROOT],
      },
      {
        label: 'Escalades',
        href: '/admin/escalations',
        icon: AlertTriangle,
        roles: [OPS, ADMIN_GLOBAL, ROOT],
      },
      {
        label: 'Inviter un client',
        href: '/invite',
        icon: UserPlus,
        roles: [OPS, ADMIN_LANDS, ADMIN_GLOBAL, ROOT],
      },
      {
        label: 'Paramètres',
        href: '/settings',
        icon: Settings,
        roles: [ADMIN_GLOBAL, ROOT],
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
