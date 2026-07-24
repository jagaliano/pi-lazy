# Changelog

## 0.2.3

- Resolve lazy-loaded extension peer dependencies from the active Pi runtime,
  including hoisted Bun/npm installations.

## 0.2.2

- Retry npm publishing without provenance only when npm reports an existing transparency-log entry.

## 0.2.1

- Include required Pi runtime dependencies in the published package so the compiled extension entry resolves after installation.

## 0.2.0

- Defer package resolution until first load and cache jiti/Pi loader setup.
- Publish a compiled `dist/index.js` extension entry.
- Add cooperative after-start batching, bounded automatic loads, and `/lazy profile` timings.
- Add an isolated startup benchmark that never mutates the live Pi agent configuration.

## 0.1.1

- Fix jiti resolution: prefer `createJiti` over the CJS default function wrapper
- Sync `j(path)` broke top-level await in lazy-loaded TS extensions (`rpiv-todo`, `rpiv-ask-user-question`)
- Pass `moduleCache: false` like pi-core when importing extension modules

## 0.1.0

- Initial release: LazyVim-style extension manager for Pi Coding Agent
- Load strategies: eager, `after-start` (VeryLazy), on-demand
- Triggers: `/lazy load`, stub commands/tools, keywords, events, shortcuts
- `/lazy migrate` rewrites `settings.packages` to `extensions: []` for true module-lazy
- Config: `~/.pi/agent/lazy.json`
