// Workspace-root stub used only so that NX's project-graph analysis
// (which runs from the workspace root) can locate this file when
// next.config.ts calls createNextIntlPlugin('./src/i18n/request.ts').
//
// The REAL implementation is at apps/web/src/i18n/request.ts.
// Next.js (which runs from apps/web/) will use that file, NOT this one.
import type { getRequestConfig } from 'next-intl/server';
export default {} as Awaited<ReturnType<typeof getRequestConfig>>;
