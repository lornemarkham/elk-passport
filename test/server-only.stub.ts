/**
 * `server-only` has no browser build on purpose — importing it from client code
 * is meant to be a build error. That also makes any server module unimportable
 * under vitest, which runs everything in one environment. Aliased to this empty
 * module in `vitest.config.ts`, so the guard keeps working where it matters
 * (the Next build) and stops blocking tests of pure logic that happens to live
 * in a server file.
 */
export {};
