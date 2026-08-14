#!/usr/bin/env node
/** Build the TypeScript test entry with the project's esbuild, then run node:test. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const buildDir = mkdtempSync(join(root, ".test-build-"));
const outfile = join(buildDir, "unit.test.mjs");

try {
	await build({
		entryPoints: [join(root, "test/unit.test.ts")],
		outfile,
		bundle: true,
		platform: "node",
		format: "esm",
		target: "node20",
		external: ["@earendil-works/pi-coding-agent", "typebox"],
		logLevel: "warning",
	});
	const result = spawnSync(process.execPath, ["--test", outfile], { cwd: root, stdio: "inherit" });
	if (result.error) throw result.error;
	process.exitCode = result.status ?? 1;
} finally {
	rmSync(buildDir, { recursive: true, force: true });
}
