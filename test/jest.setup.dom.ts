/**
 * Frontend-only setup. Deliberately does not import `test/jest.setup.ts`: that
 * one re-points DATABASE_URL and asserts the Postgres schema, which a component
 * test has no business touching.
 *
 * Everything stubbed below is a real browser API that jsdom does not implement,
 * verified against actual usage in src/ rather than added speculatively.
 */
import '@testing-library/jest-dom';

// framer-motion's `useReducedMotion` calls this on mount. It is used by
// AnimatedValue, BottomNav and CricketScoreCarousel, so without a stub the first
// render of almost any screen throws "window.matchMedia is not a function".
// Reports "no preference" so animation paths are the ones under test.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom ships neither observer. Leaflet and framer-motion both construct one
// when mounted, and an unimplemented constructor is a hard ReferenceError.
class MockObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.ResizeObserver ??= MockObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= MockObserver as unknown as typeof IntersectionObserver;

// Vite exposes configuration on `import.meta.env`, which cannot exist in the
// CommonJS ts-jest emits; `test/vite-env-transform.cjs` rewrites it to
// `process.env`, so these are the names the compiled frontend actually reads.
// `apiClient.ts` and `realtimeClient.ts` both read them at module load, so they
// have to be set before the first import of either.
//
// `DEV` is deliberately left unset: every `process.env` value is a string, so
// `'false'` would read as truthy. Unset means the production branch, which is the
// one that resolves an absolute origin.
process.env.VITE_API_URL ??= 'http://localhost:3001';

// No component test may reach the network. A test that renders a data-fetching
// screen must stub its own response; an unstubbed call fails loudly here rather
// than hanging until the 15s timeout or, worse, hitting a real backend.
beforeEach(() => {
  globalThis.fetch = jest.fn(() =>
    Promise.reject(new Error('Unstubbed fetch in a component test — mock the ApiClient method you need.')),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
  window.localStorage.clear();
});
