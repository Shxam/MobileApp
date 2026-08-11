/**
 * Vite serves CSS imports; Jest would hand `.css` to the TS transform and throw
 * on the first selector. `src/main.tsx` and `apps/driver/src/main.tsx` both do a
 * bare `import './index.css'`, so any test that reaches them needs this.
 */
module.exports = {};
