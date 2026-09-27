import { notFound } from 'next/navigation';

/**
 * Every unmatched path under a valid locale, routed to the app's own 404 page.
 *
 * Without this, `/fr/zzz-does-not-exist` answered with Next's BUILT-IN 404 -
 * the bare "404: This page could not be found." - because `not-found.tsx` is a
 * boundary that something has to trigger, and an unmatched URL under a matched
 * dynamic segment triggers nothing. The status code was right and the page was
 * the one P3 replaced: a dead end with no way back into the site.
 *
 * It is the lowest-priority match in the segment, so it cannot shadow a real
 * route; it only receives what nothing else claimed.
 */
const CatchAllNotFound = () => notFound();

export default CatchAllNotFound;
