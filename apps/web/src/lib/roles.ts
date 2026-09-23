/**
 * Single, authoritative import point for role codes within the web application.
 * Bypasses the `@kambriq/common` barrel to avoid pulling in server-only code.
 * Ensures consistent usage of role constants instead of bare strings.
 */
// eslint-disable-next-line no-restricted-imports -- see above: the barrel is not importable from the web
export { RoleCode } from '@kambriq/common/types/roles.enum';
