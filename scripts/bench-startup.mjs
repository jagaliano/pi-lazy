#!/usr/bin/env node
/**
 * Isolated cold-start benchmark for pi-lazy. It never modifies ~/.pi/agent.
 * It creates a temporary PI_CODING_AGENT_DIR and symlinks only the installed
 * package store so package resolution behaves like a normal Pi installation.
 */
import { mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const ROOT = resolve(import.meta.dirname, "..");
const REAL_AGENT_DIR = process.env.PI_CODING_AGENT_DIR ?? join(process.env.HOME ?? "", ".pi", "agent");
const parsedRuns = Number(process.env.BENCH_RUNS ?? 3);
const RUNS = Number.isInteger(parsedRuns) && parsedRuns > 0 ? parsedRuns : 3;
const parsedTimeout = Number(process.env.BENCH_TIMEOUT_MS ?? 180_000);
const TIMEOUT_MS = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 180_000;
const OUTPUT_LIMIT = 1_000_000;
const REPORT = resolve(process.env.BENCH_REPORT ?? join(ROOT, ".benchmark-report.json"));
const tempAgent = mkdtempSync(join(tmpdir(), "pi-lazy-bench-"));

function stats(values) {
	const sorted = [...values].sort((a, b) => a - b);
	return {
		values: values.map(Math.round),
		min: Math.round(sorted[0]),
		max: Math.round(sorted.at(-1)),
		median: Math.round(sorted[Math.floor(sorted.length / 2)]),
		average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
	};
}

function runPi(args, env) {
	return new Promise((resolveRun, reject) => {
		const started = performance.now();
		const child = spawn("pi", args, { env, stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		let settled = false;
		let timedOut = false;
		let killTimer;
		const append = (current, chunk) => (current + chunk).slice(-OUTPUT_LIMIT);
		child.stdout.on("data", (chunk) => (stdout = append(stdout, chunk)));
		child.stderr.on("data", (chunk) => (stderr = append(stderr, chunk)));
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
			killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
		}, TIMEOUT_MS);
		child.once("error", (err) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			clearTimeout(killTimer);
			reject(err);
		});
		child.once("close", (code, signal) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			clearTimeout(killTimer);
			resolveRun({ ms: performance.now() - started, code, signal, timedOut, stdout, stderr });
		});
	});
}

function writeFixture(mode) {
	const lazyConfig = JSON.parse(readFileSync(join(ROOT, "examples/lazy.json"), "utf8"));
	const packages = lazyConfig.specs.map((spec) => {
		if (spec.lazy === false) return spec.source;
		return mode === "lazy" ? { source: spec.source, extensions: [] } : spec.source;
	});
	writeFileSync(join(tempAgent, "lazy.json"), `${JSON.stringify(lazyConfig, null, 2)}\n`);
	writeFileSync(join(tempAgent, "settings.json"), `${JSON.stringify({ packages }, null, 2)}\n`);
}

async function bench(mode) {
	writeFixture(mode);
	const results = [];
	for (let i = 0; i < RUNS; i++) {
		const result = await runPi([
			"--offline", "--no-session", "--no-context-files", "--mode", "text",
			"--extension", join(ROOT, "dist/index.js"), "-p", "Reply with exactly: PONG",
		], { ...process.env, PI_CODING_AGENT_DIR: tempAgent, PI_OFFLINE: "1" });
		if (result.code !== 0 || !/PONG/.test(result.stdout)) {
			throw new Error(`${mode} run ${i + 1} failed (exit ${result.code}): ${result.stderr || result.stdout}`);
		}
		results.push(result.ms);
		console.log(`${mode} ${i + 1}/${RUNS}: ${Math.round(result.ms)}ms`);
	}
	return stats(results);
}

try {
	if (!existsSync(join(ROOT, "dist/index.js"))) throw new Error("Run npm run build before benchmarking.");
	if (!existsSync(join(REAL_AGENT_DIR, "npm"))) throw new Error(`No package store at ${join(REAL_AGENT_DIR, "npm")}`);
	symlinkSync(join(REAL_AGENT_DIR, "npm"), join(tempAgent, "npm"), "dir");
	const lazy = await bench("lazy");
	const eager = await bench("eager");
	const report = { runs: RUNS, lazy, eager, eagerMinusLazyMs: eager.average - lazy.average };
	writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
	console.log(`\nLazy avg: ${lazy.average}ms; eager avg: ${eager.average}ms; delta: ${report.eagerMinusLazyMs}ms`);
	console.log(`Report: ${REPORT}`);
} finally {
	rmSync(tempAgent, { recursive: true, force: true });
}
