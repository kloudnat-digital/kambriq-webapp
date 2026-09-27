import { toHTML } from '@portabletext/to-html';
import type { ArbitraryTypedObject, PortableTextBlock } from '@portabletext/types';

/**
 * What a policy's Portable Text may contain, as the library types it.
 * `TypedObject` alone cannot express a block's `style`, `children` or `markDefs`.
 */
export type PolicyBody = (PortableTextBlock | ArbitraryTypedObject)[];

/** Thrown when a document contains something this renderer cannot reproduce. */
export class UnrenderablePolicyError extends Error {
  constructor(readonly detail: string) {
    super(`Refusing to archive a policy this renderer cannot reproduce: ${detail}`);
    this.name = 'UnrenderablePolicyError';
  }
}

/**
 * Renders Portable Text to the HTML stored in the archive.
 *
 * `onMissingComponent` throws, because the library's default does not fail: an
 * unknown block type becomes `<div style="display:none">` and an unknown block
 * style flattens to `<p>`, both producing HTML that looks complete and is not.
 * A block type added in Sanity therefore needs a renderer here first.
 *
 * The output is safe to serve: text is escaped by the library, the tag set is
 * closed by `defaultComponents`, unsafe link protocols are dropped by
 * `uriLooksSafe`, and any custom type that could introduce markup throws.
 */
export function renderPolicyHtml(body: PolicyBody): string {
  return toHTML(body, {
    onMissingComponent: (message, options) => {
      throw new UnrenderablePolicyError(`${options.nodeType} "${options.type}": ${message}`);
    },
  });
}
