# Changelog

## 0.2.8

- Documentation: Improved README readability and onboarding with a table of contents, a clearer LazyVim analogy explanation, and streamlined usage sections.
- CI: Drop Node 20 from CI test matrix due to upstream `@earendil-works/pi-coding-agent` devDependency requirement while keeping package runtime support at Node >=20.

## 0.2.7

- Coalesce concurrent loads, reject dependency cycles, and prevent retries after partial factory activation.
- Preserve loaded extensions across session changes and cancel stale after-start queues with generation tokens.
- Make configuration/settings writes atomic; validate config fields and preserve package metadata during migration.
- Keep migrated packages eager until restart, support configured event names, and remove recursive command redispatch.
- Replace machine-specific integration/smoke scripts with hermetic tests and portable artifact verification.
- Move the Pi host to peer/dev dependencies and update the lockfile to clear dependency audit findings.

## 0.2.6

- **Fix DataCloneError on every lazy load** ("`... could not be cloned`"):
  `loadResolvedEntry` returned `commandHandlers` — a `Map` of command name to
  handler **function** — inside `LoadResult`, and the `lazy_load` tool
  forwarded the whole object as tool-result `details`. Pi `structuredClone`s
  tool-result details for the transcript, and functions cannot be cloned, so
  every lazy load crashed with `DataCloneError: <handler> could not be
  cloned.`
- Remove `commandHandlers` from `LoadResult`. Stub-command dispatch already
  reads `entry.loadedCommandHandlers` directly, so nothing consumed it from
  the result; internal `ResolvedEntry` tracking is unchanged.
- Sanitize `lazy_load` tool `details` to an explicit primitive allowlist
  (`ok`, `name`, `alreadyLoaded`, `loadMs`, `tools`, `commands`, `error`) as
  defense in depth, so a future non-serializable field can never crash the
  transcript.

## 0.2.5

- Fix stub command re-dispatch: after lazy-loading the real package, invoke its
  captured `registerCommand` handler directly instead of re-injecting `/cmd`
  via `sendUserMessage({ deliverAs: "followUp" })`. The follow-up path bypasses
  slash-command dispatch entirely and lands the literal `/cmd` text in the
  conversation as a plain chat message, so the real command (e.g. `/mcp`)
  never actually ran on first invocation.
- `loader.ts` now captures each `registerCommand` call's handler during the
  tracked load and exposes it via `ResolvedEntry.loadedCommandHandlers` /
  `LoadResult.commandHandlers`, keyed by command name.

## 0.2.4

- Resilient stale-ctx handling: guard all async-gap `ctx.ui` accesses so a replaced/reloaded session never crashes the pi process.
- Track `rt.sessionCtx` synchronously on `session_start` and prefer it over captured ctx across `loadByName` iterations, `setTimeout` gaps, and after-start batches.
- Extract `notifySafe()` and `refreshStatus()` stale-ctx guards for reuse.

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
