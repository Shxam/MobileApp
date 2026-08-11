/**
 * ts-jest, with Vite's `import.meta` rewritten away first.
 *
 * `import.meta` is module-syntax that only exists in a real ES module. ts-jest
 * emits CommonJS, so it passes the expression through untouched and Node throws
 * `SyntaxError: Cannot use 'import.meta' outside a module` the moment the module
 * is required — before a single assertion runs. `src/services/apiClient.ts` reads
 * it at the top level, and almost every component reaches that file, so this
 * blocked the whole frontend project rather than one test.
 *
 * The rewrite happens on the source text, so TypeScript never sees the offending
 * syntax and no `--experimental-vm-modules` / ESM tsconfig split is needed.
 *
 * `import.meta` → `({ env: process.env })` rather than straight to `process.env`,
 * because the codebase uses two shapes and this covers both by substitution:
 *
 *   import.meta.env.DEV              → ({ env: process.env }).env.DEV
 *   (import.meta as any).env?.VITE_X → (({ env: process.env }) as any).env?.VITE_X
 *
 * Tests therefore configure Vite variables through `process.env` (see
 * `test/jest.setup.dom.ts`). Note the semantic gap: `process.env` values are
 * always strings, so Vite's boolean `import.meta.env.DEV` arrives as `undefined`
 * unless a test sets it, and any string it is set to — including `'false'` — is
 * truthy.
 *
 * The pattern is the bare `import.meta` token. I checked src/, apps/ and
 * packages/ for the string inside a quote or template literal before choosing
 * this: there are none, only live expressions and prose in comments, and
 * rewriting a comment is inert. A future string literal containing
 * `import.meta` would be corrupted here, which is the one thing to watch.
 */
// ts-jest 29.4 exposes its factory as `require('ts-jest').default.createTransformer`
// — only reachable through the CommonJS `.default` interop wart. The class is a
// real top-level named export, so constructing it skips that.
const { TsJestTransformer } = require('ts-jest');

// Same tsconfig the frontend project passes to ts-jest directly: jsx:'react-jsx'
// so specs need no React import, matching how components are written.
const tsJest = new TsJestTransformer({ tsconfig: 'tsconfig.json' });

const IMPORT_META = /\bimport\.meta\b/g;
const SHIM = '({ env: process.env })';

function rewrite(sourceText) {
  // Cheap guard: the substitution is irrelevant to most files, and skipping the
  // regex keeps the transform off the hot path for them.
  return sourceText.includes('import.meta') ? sourceText.replace(IMPORT_META, SHIM) : sourceText;
}

// Delegating explicitly instead of spreading `tsJest`: it is a class instance,
// so its methods live on the prototype and would not survive an object spread.
module.exports = {
  process(sourceText, sourcePath, options) {
    return tsJest.process(rewrite(sourceText), sourcePath, options);
  },

  processAsync(sourceText, sourcePath, options) {
    return tsJest.processAsync(rewrite(sourceText), sourcePath, options);
  },

  // The suffix busts Jest's on-disk transform cache when this file changes, so an
  // edit above cannot be masked by a stale compile from a previous run.
  getCacheKey(sourceText, sourcePath, options) {
    return `${tsJest.getCacheKey(rewrite(sourceText), sourcePath, options)}-vite-env-1`;
  },

  async getCacheKeyAsync(sourceText, sourcePath, options) {
    const key = await tsJest.getCacheKeyAsync(rewrite(sourceText), sourcePath, options);
    return `${key}-vite-env-1`;
  },
};
