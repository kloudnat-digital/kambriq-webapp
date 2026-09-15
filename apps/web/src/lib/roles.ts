/**
 * I18 - the web's one import of the role codes.
 *
 * Every role check the web made - the proxy's gates, the nav, the layouts, the
 * placeholder badges - spelled the code as a bare string, which is how a role
 * name that exists nowhere (`ROOT`) came to guard a real layout. The API bans
 * that (`role-code-literals.spec.ts`, which now scans this app too); this is
 * where the web gets the constant instead.
 *
 * Imported from the enum file directly, once, here: the web cannot import the
 * `@kambriq/common` barrel, which carries server-only code, and the repository
 * rule against enum-file imports exists to steer API code to that barrel.
 */
// eslint-disable-next-line no-restricted-imports -- see above: the barrel is not importable from the web
export { RoleCode } from '@kambriq/common/types/roles.enum';
