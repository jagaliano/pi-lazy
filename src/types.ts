/**
 * LazyVim-style extension load specs for Pi.
 */

export type LazyMode = false | true | "after-start";

export type SpecState = "eager" | "pending" | "loading" | "loaded" | "error";

export interface LazySpec {
	/** Stable id used by /lazy load <name> */
	name: string;
	/** Package source as in settings.packages (npm:..., git:..., or local path) */
	source: string;
	/**
	 * false      — always load with Pi (not managed)
	 * true       — load on demand (cmd / tools / event / keywords / manual)
	 * "after-start" — load shortly after session_start (VeryLazy)
	 */
	lazy?: LazyMode;
	/** Load priority for after-start (lower = earlier). Default 100. */
	priority?: number;
	/** Slash-command names that should stub-load this package on first use */
	cmd?: string[];
	/** Tool names to register as load-on-call stubs */
	tools?: string[];
	/** Keyboard shortcuts that load this package then run optional action */
	keys?: string[];
	/** Pi events that trigger load (e.g. "before_agent_start") */
	event?: string[];
	/** Case-insensitive prompt keywords that trigger load */
	keywords?: string[];
	/** Other spec names that must load first */
	dependencies?: string[];
	/** Optional human description */
	description?: string;
}

export interface LazyConfig {
	version: 1;
	defaults?: {
		lazy?: LazyMode;
	};
	/** When true, keyword/event auto-load is enabled (default true) */
	auto?: boolean;
	specs: LazySpec[];
}

export interface ResolvedEntry {
	spec: LazySpec;
	packageRoot: string;
	extensionPaths: string[];
	/** True when settings filter keeps extensions[] empty so Pi won't eager-load */
	moduleLazyReady: boolean;
	state: SpecState;
	error?: string;
	loadedAt?: number;
	loadMs?: number;
	loadedTools?: string[];
	loadedCommands?: string[];
}

export interface LoadResult {
	ok: boolean;
	name: string;
	alreadyLoaded?: boolean;
	loadMs?: number;
	tools?: string[];
	commands?: string[];
	error?: string;
}
