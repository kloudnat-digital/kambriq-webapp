// Extends Jest's expect() with DOM matchers:
// toBeInTheDocument(), toHaveClass(), toBeVisible(), toHaveTextContent(), etc.
import '@testing-library/jest-dom';

// The MSW server in ./mocks/server is deliberately NOT started here.
//
// This file was wired up with `setupFilesAfterFramework`, which is not a Jest
// option, so it had never actually loaded. Correcting the key to
// setupFilesAfterEnv revealed that starting MSW from here fails: msw v2 ships
// ESM that the Next/SWC transform does not process, and it brought the whole
// suite down before a single test ran.
//
// No test uses MSW today. Rather than carry transformIgnorePatterns for a
// dependency nothing exercises, the bootstrap is left to the first test that
// actually needs it:
//
//   import { server } from '@/mocks/server';
//   beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
//   afterEach(() => server.resetHandlers());
//   afterAll(() => server.close());
//
// That test will also need the transform sorted, which is the right moment to
// pay for it.

// ---------------------------------------------------------------------------
// Browser APIs jsdom does not implement, which Radix primitives call.
// ---------------------------------------------------------------------------
//
// jsdom is a DOM, not a browser: it has no layout engine, so the APIs that
// report or capture geometry are simply absent. Radix's Select and Checkbox use
// them, and without these a component test dies on `render()` with
// `ResizeObserver is not defined` - which reads as a broken component and is a
// missing environment.
//
// These are stubs, deliberately, not implementations. A test must never assert
// anything about size, position or scrolling on the strength of them: jsdom
// reports every element as 0x0 and that is not a measurement. What they buy is
// the ability to render and interact with the component at all.

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    // Arrow properties rather than empty methods: `no-empty-function` refuses
    // the latter, and rightly - an empty method usually means unfinished work.
    // Here doing nothing IS the implementation, because jsdom has no layout to
    // report and a stub that invented one would be worse than none.
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  } as unknown as typeof ResizeObserver;
}

if (!('DOMRect' in globalThis)) {
  globalThis.DOMRect = class {
    constructor(
      public x = 0,
      public y = 0,
      public width = 0,
      public height = 0,
    ) {}
    top = 0;
    left = 0;
    right = 0;
    bottom = 0;
    toJSON() {
      return this;
    }
    static fromRect() {
      return new globalThis.DOMRect();
    }
  } as unknown as typeof DOMRect;
}

// Pointer capture: Radix's Select trigger calls these on every pointer down.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
}

// Called when the Select viewport brings the highlighted option into view.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}
