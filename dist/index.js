// src/index.ts
import { Type } from "typebox";
import { getAgentDir as getAgentDir4 } from "@earendil-works/pi-coding-agent";

// src/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
function getLazyConfigPath(agentDir = getAgentDir()) {
  return join(agentDir, "lazy.json");
}
function getSettingsPath(agentDir = getAgentDir()) {
  return join(agentDir, "settings.json");
}
function defaultConfig() {
  return {
    version: 1,
    defaults: { lazy: true },
    auto: true,
    autoLoadLimit: 1,
    afterStartBatchSize: 1,
    afterStartDelayMs: 0,
    specs: [
      // Providers / always-on identity
      { name: "grok-cli", source: "npm:pi-grok-cli", lazy: false, description: "Grok CLI provider" },
      { name: "antigravity", source: "npm:pi-antigravity", lazy: false, description: "Antigravity provider" },
      { name: "cursor", source: "npm:@rahularya01/pi-cursor", lazy: false, description: "Cursor provider bridge" },
      // VeryLazy — common after UI is up
      {
        name: "subagents",
        source: "npm:pi-subagents",
        lazy: "after-start",
        priority: 10,
        description: "Subagent orchestration"
      },
      {
        name: "todo",
        source: "npm:@juicesharp/rpiv-todo",
        lazy: "after-start",
        priority: 20,
        cmd: ["todo"],
        tools: ["todo"]
      },
      {
        name: "ask-user",
        source: "npm:@juicesharp/rpiv-ask-user-question",
        lazy: "after-start",
        priority: 20,
        tools: ["ask_user_question"]
      },
      {
        name: "hypa",
        source: "npm:@hypabolic/pi-hypa",
        lazy: "after-start",
        priority: 30,
        description: "Hypa compressed tools"
      },
      {
        name: "paster",
        source: "npm:pi-paster",
        lazy: "after-start",
        priority: 40,
        description: "Clipboard / paste helpers"
      },
      // On-demand — heavy / situational
      {
        name: "web",
        source: "npm:pi-web-access",
        lazy: true,
        cmd: ["web"],
        tools: ["web_search", "fetch_content", "get_search_content"],
        keywords: ["web search", "search the web", "fetch url", "youtube"],
        description: "Web search / fetch / video"
      },
      {
        name: "mcp",
        source: "npm:pi-mcp-adapter",
        lazy: true,
        cmd: ["mcp"],
        keywords: ["mcp", "playwright", "clickup"],
        description: "MCP server bridge"
      },
      {
        name: "context-mode",
        source: "npm:context-mode",
        lazy: true,
        cmd: ["context-mode", "ctx"],
        tools: ["ctx_execute", "ctx_search", "ctx_index"],
        keywords: ["context-mode", "ctx_execute"],
        description: "Context-mode tools + skills"
      },
      {
        name: "lens",
        source: "npm:pi-lens",
        lazy: true,
        cmd: ["lens"],
        tools: ["lens_diagnostics", "symbol_search", "module_report", "lsp_diagnostics"],
        keywords: ["diagnostics", "symbol search", "ast-grep", "lsp"],
        description: "pi-lens code intelligence"
      },
      {
        name: "plannotator",
        source: "npm:@plannotator/pi-extension",
        lazy: true,
        cmd: ["plannotator", "plan"],
        keywords: ["plannotator", "plan mode"],
        description: "Plan mode / plannotator"
      }
    ]
  };
}
function normalizeMode(value, fallback = true) {
  if (value === false || value === true || value === "after-start") return value;
  return fallback;
}
function normalizePositiveInteger(value, fallback) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}
function normalizeNonNegativeInteger(value, fallback) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}
function loadConfig(agentDir = getAgentDir()) {
  const path = getLazyConfigPath(agentDir);
  if (!existsSync(path)) {
    const cfg = defaultConfig();
    saveConfig(cfg, agentDir);
    return cfg;
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    const defaultsLazy = normalizeMode(raw.defaults?.lazy, true);
    const specs = Array.isArray(raw.specs) ? raw.specs.filter((s) => !!s && typeof s === "object" && typeof s.name === "string" && typeof s.source === "string").map((s) => ({
      ...s,
      lazy: s.lazy === void 0 ? defaultsLazy : normalizeMode(s.lazy, defaultsLazy),
      cmd: s.cmd?.filter((c) => typeof c === "string" && c.length > 0),
      tools: s.tools?.filter((t) => typeof t === "string" && t.length > 0),
      keys: s.keys?.filter((k) => typeof k === "string" && k.length > 0),
      event: s.event?.filter((e) => typeof e === "string" && e.length > 0),
      keywords: s.keywords?.filter((k) => typeof k === "string" && k.length > 0),
      dependencies: s.dependencies?.filter((d) => typeof d === "string" && d.length > 0)
    })) : defaultConfig().specs;
    return {
      version: 1,
      defaults: { lazy: defaultsLazy },
      auto: raw.auto !== false,
      autoLoadLimit: normalizePositiveInteger(raw.autoLoadLimit, 1),
      afterStartBatchSize: normalizePositiveInteger(raw.afterStartBatchSize, 1),
      afterStartDelayMs: normalizeNonNegativeInteger(raw.afterStartDelayMs, 0),
      specs
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pi-lazy] failed to parse lazy.json: ${message}`);
    return defaultConfig();
  }
}
function saveConfig(config, agentDir = getAgentDir()) {
  const path = getLazyConfigPath(agentDir);
  mkdirSync(dirname(path), { recursive: true });
  const body = `${JSON.stringify(config, null, 2)}
`;
  writeFileSync(path, body, "utf-8");
  return path;
}
function isManagedLazy(spec) {
  return spec.lazy !== false;
}

// src/loader.ts
import { existsSync as existsSync2, readFileSync as readFileSync2, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname as dirname2, join as join2 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
function fileUrl(path) {
  return pathToFileURL(path).href;
}
function asFactory(mod) {
  if (typeof mod === "function") return mod;
  if (mod && typeof mod === "object") {
    const d = mod.default;
    if (typeof d === "function") return d;
  }
  return null;
}
var cachedPiPackageJson;
var cachedCreateJiti;
var aliasesPromise;
var jitiInstance;
function resolvePiPackageJson() {
  if (cachedPiPackageJson !== void 0) return cachedPiPackageJson;
  const finish = (value) => cachedPiPackageJson = value;
  try {
    const bin = realpathSync(process.argv[1] ?? "");
    let dir = dirname2(bin);
    for (let i = 0; i < 10; i++) {
      const pkgPath = join2(dir, "package.json");
      if (existsSync2(pkgPath)) {
        try {
          const name = JSON.parse(readFileSync2(pkgPath, "utf-8")).name;
          if (name === "@earendil-works/pi-coding-agent" || name === "@mariozechner/pi-coding-agent") {
            return finish(pkgPath);
          }
        } catch {
        }
      }
      const parent = dirname2(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
  }
  try {
    const url = import.meta.resolve("@earendil-works/pi-coding-agent/package.json");
    return finish(fileURLToPath(url));
  } catch {
  }
  try {
    const require2 = createRequire(import.meta.url);
    return finish(require2.resolve("@earendil-works/pi-coding-agent/package.json"));
  } catch {
  }
  for (const guess of [
    join2(dirname2(process.execPath), "../lib/node_modules/@earendil-works/pi-coding-agent/package.json"),
    join2(dirname2(process.execPath), "../lib/node_modules/@mariozechner/pi-coding-agent/package.json")
  ]) {
    if (existsSync2(guess)) return finish(guess);
  }
  return finish(null);
}
function resolveJitiCreate() {
  if (cachedCreateJiti !== void 0) return cachedCreateJiti;
  const candidates = [];
  const pushResolve = (from) => {
    try {
      const require2 = createRequire(from);
      candidates.push(require2.resolve("jiti"));
    } catch {
    }
  };
  const piPkg = resolvePiPackageJson();
  if (piPkg) pushResolve(piPkg);
  pushResolve(fileURLToPath(import.meta.url));
  if (piPkg) {
    let dir = dirname2(piPkg);
    for (let i = 0; i < 6; i++) {
      const nested = join2(dir, "node_modules", "jiti", "lib", "jiti.cjs");
      const nestedPkg = join2(dir, "node_modules", "jiti", "package.json");
      if (existsSync2(nestedPkg)) {
        try {
          const require2 = createRequire(nestedPkg);
          candidates.push(require2.resolve("jiti"));
        } catch {
          if (existsSync2(nested)) candidates.push(nested);
        }
        break;
      }
      const parent = dirname2(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  for (const jitiPath of [...new Set(candidates)]) {
    try {
      const require2 = createRequire(jitiPath);
      const jitiMod = require2(jitiPath);
      if (typeof jitiMod?.createJiti === "function") {
        return cachedCreateJiti = jitiMod.createJiti.bind(jitiMod);
      }
      if (typeof jitiMod === "function") {
        return cachedCreateJiti = jitiMod;
      }
    } catch {
    }
  }
  return cachedCreateJiti = null;
}
async function importFactory(extensionPath) {
  if (/\.(js|mjs|cjs)$/.test(extensionPath)) {
    try {
      const mod = await import(fileUrl(extensionPath));
      const factory = asFactory(mod);
      if (factory) return factory;
    } catch {
    }
  }
  const createJiti = resolveJitiCreate();
  if (!createJiti) {
    throw new Error("jiti not available \u2014 cannot load TypeScript extensions at runtime");
  }
  try {
    const aliases = await (aliasesPromise ??= buildAliases());
    const jiti = jitiInstance ??= createJiti(import.meta.url, {
      interopDefault: true,
      // Keep transformed extension modules fresh across reloads.
      moduleCache: false,
      alias: aliases
    });
    if (jiti && typeof jiti.import === "function") {
      try {
        const mod2 = await jiti.import(extensionPath, { default: true });
        const factory = asFactory(mod2);
        if (factory) return factory;
      } catch (firstErr) {
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        if (/does not provide an export named|default/i.test(msg)) {
          const mod2 = await jiti.import(extensionPath);
          return asFactory(mod2);
        }
        throw firstErr;
      }
      const mod = await jiti.import(extensionPath);
      return asFactory(mod);
    }
    throw new Error("jiti instance missing async import()");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to import extension module ${extensionPath}: ${message}`);
  }
}
function tryResolveFrom(fromPkgJson, spec) {
  if (!fromPkgJson) return null;
  try {
    const require2 = createRequire(fromPkgJson);
    return require2.resolve(spec);
  } catch {
    return null;
  }
}
function firstExisting(...paths) {
  for (const p of paths) {
    if (p && existsSync2(p)) return p;
  }
  return null;
}
async function buildAliases() {
  const aliases = {};
  const piPkg = resolvePiPackageJson();
  const piRoot = piPkg ? dirname2(piPkg) : null;
  const piModuleRoots = piRoot ? [join2(piRoot, "node_modules"), dirname2(dirname2(piRoot))] : [];
  const requireFromPi = piPkg ? createRequire(piPkg) : null;
  const piModule = (pkg, file) => firstExisting(...piModuleRoots.map((root) => join2(root, pkg, file)));
  const set = (spec, path) => {
    if (path) aliases[spec] = path;
  };
  const resolveSpec = (spec) => {
    try {
      const resolved = import.meta.resolve(spec);
      return resolved.startsWith("file:") ? fileURLToPath(resolved) : resolved;
    } catch {
    }
    if (requireFromPi) {
      try {
        return requireFromPi.resolve(spec);
      } catch {
      }
    }
    return tryResolveFrom(piPkg, spec);
  };
  const piCoding = firstExisting(
    resolveSpec("@earendil-works/pi-coding-agent"),
    piRoot ? join2(piRoot, "dist/index.js") : null
  );
  set("@earendil-works/pi-coding-agent", piCoding);
  set("@mariozechner/pi-coding-agent", piCoding);
  const agentCore = firstExisting(
    resolveSpec("@earendil-works/pi-agent-core"),
    piModule("@earendil-works/pi-agent-core", "dist/index.js")
  );
  set("@earendil-works/pi-agent-core", agentCore);
  set("@mariozechner/pi-agent-core", agentCore);
  const tui = firstExisting(
    resolveSpec("@earendil-works/pi-tui"),
    piModule("@earendil-works/pi-tui", "dist/index.js")
  );
  set("@earendil-works/pi-tui", tui);
  set("@mariozechner/pi-tui", tui);
  const aiCompat = firstExisting(
    resolveSpec("@earendil-works/pi-ai/compat"),
    piModule("@earendil-works/pi-ai", "dist/compat.js")
  );
  const aiOauth = firstExisting(
    resolveSpec("@earendil-works/pi-ai/oauth"),
    piModule("@earendil-works/pi-ai", "dist/oauth.js")
  );
  const aiProviders = firstExisting(
    resolveSpec("@earendil-works/pi-ai/providers/all"),
    piModule("@earendil-works/pi-ai", "dist/providers/all.js")
  );
  set("@earendil-works/pi-ai/providers/all", aiProviders);
  set("@mariozechner/pi-ai/providers/all", aiProviders);
  set("@earendil-works/pi-ai/oauth", aiOauth);
  set("@mariozechner/pi-ai/oauth", aiOauth);
  set("@earendil-works/pi-ai/compat", aiCompat);
  set("@mariozechner/pi-ai/compat", aiCompat);
  const ai = firstExisting(
    resolveSpec("@earendil-works/pi-ai"),
    piModule("@earendil-works/pi-ai", "dist/index.js")
  );
  set("@earendil-works/pi-ai", ai);
  set("@mariozechner/pi-ai", ai);
  const typebox = resolveSpec("typebox");
  const typeboxCompile = resolveSpec("typebox/compile");
  const typeboxValue = resolveSpec("typebox/value");
  set("typebox", typebox);
  set("typebox/compile", typeboxCompile);
  set("typebox/value", typeboxValue);
  set("@sinclair/typebox", typebox);
  set("@sinclair/typebox/compile", typeboxCompile);
  set("@sinclair/typebox/value", typeboxValue);
  return aliases;
}
function createTrackingApi(pi, track) {
  const on = (event, handler) => {
    if (event === "session_start") track.sessionStartHandlers.push(handler);
    if (event === "resources_discover") track.resourcesDiscoverHandlers.push(handler);
    return pi.on(event, handler);
  };
  const registerTool = (tool) => {
    track.tools.push(tool.name);
    return pi.registerTool(tool);
  };
  const registerCommand = (name, options) => {
    track.commands.push(name);
    return pi.registerCommand(name, options);
  };
  return new Proxy(pi, {
    get(target, prop, receiver) {
      if (prop === "on") return on;
      if (prop === "registerTool") return registerTool;
      if (prop === "registerCommand") return registerCommand;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
async function loadResolvedEntry(entry, pi, ctx, deps) {
  const { spec } = entry;
  if (entry.state === "loaded") {
    return {
      ok: true,
      name: spec.name,
      alreadyLoaded: true,
      tools: entry.loadedTools,
      commands: entry.loadedCommands,
      loadMs: entry.loadMs
    };
  }
  if (entry.state === "loading") {
    return { ok: false, name: spec.name, error: "already loading" };
  }
  if (!entry.moduleLazyReady) {
    return {
      ok: false,
      name: spec.name,
      error: "not module-lazy ready \u2014 run /lazy migrate and restart pi (package still eager-loaded by settings)"
    };
  }
  if (!entry.packageRoot || entry.extensionPaths.length === 0) {
    return {
      ok: false,
      name: spec.name,
      error: entry.packageRoot ? "no extension entrypoints found in package" : `package not installed for ${spec.source}`
    };
  }
  for (const dep of spec.dependencies ?? []) {
    const depResult = await deps.loadDependency(dep);
    if (!depResult.ok && !depResult.alreadyLoaded) {
      return { ok: false, name: spec.name, error: `dependency ${dep} failed: ${depResult.error}` };
    }
  }
  entry.state = "loading";
  const started = Date.now();
  const track = {
    tools: [],
    commands: [],
    sessionStartHandlers: [],
    resourcesDiscoverHandlers: []
  };
  const api = createTrackingApi(pi, track);
  try {
    for (const extPath of entry.extensionPaths) {
      const factory = await importFactory(extPath);
      if (!factory) {
        throw new Error(`Extension does not export a default factory: ${extPath}`);
      }
      await factory(api);
    }
    if (ctx && track.sessionStartHandlers.length > 0) {
      const event = { type: "session_start", reason: "startup" };
      for (const handler of track.sessionStartHandlers) {
        try {
          await handler(event, ctx);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[pi-lazy] session_start handler error in ${spec.name}: ${message}`);
        }
      }
    }
    if (ctx && track.resourcesDiscoverHandlers.length > 0) {
      const event = { type: "resources_discover", cwd: ctx.cwd, reason: "startup" };
      for (const handler of track.resourcesDiscoverHandlers) {
        try {
          await handler(event, ctx);
        } catch {
        }
      }
    }
    if (track.tools.length > 0 && typeof pi.getActiveTools === "function" && typeof pi.setActiveTools === "function") {
      try {
        const active = pi.getActiveTools();
        const merged = [.../* @__PURE__ */ new Set([...active, ...track.tools])];
        pi.setActiveTools(merged);
      } catch {
      }
    }
    const loadMs = Date.now() - started;
    entry.state = "loaded";
    entry.loadedAt = Date.now();
    entry.loadMs = loadMs;
    entry.loadedTools = track.tools;
    entry.loadedCommands = track.commands;
    entry.error = void 0;
    return {
      ok: true,
      name: spec.name,
      loadMs,
      tools: track.tools,
      commands: track.commands
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    entry.state = "error";
    entry.error = message;
    return { ok: false, name: spec.name, error: message };
  }
}

// src/migrate.ts
import { copyFileSync, existsSync as existsSync4, readFileSync as readFileSync4, writeFileSync as writeFileSync2 } from "node:fs";
import { getAgentDir as getAgentDir3 } from "@earendil-works/pi-coding-agent";

// src/resolve.ts
import { existsSync as existsSync3, readdirSync, readFileSync as readFileSync3, statSync } from "node:fs";
import { join as join3, resolve } from "node:path";
import { getAgentDir as getAgentDir2 } from "@earendil-works/pi-coding-agent";
function npmPackageName(source) {
  if (source.startsWith("npm:")) {
    const rest = source.slice(4);
    if (rest.startsWith("@")) {
      const m = rest.match(/^(@[^/]+\/[^@]+)/);
      return m?.[1] ?? rest;
    }
    return rest.split("@")[0] ?? rest;
  }
  if (!source.includes(":") && !source.startsWith(".") && !source.startsWith("/")) {
    return source.startsWith("@") ? source.match(/^(@[^/]+\/[^@]+)/)?.[1] ?? source : source.split("@")[0];
  }
  return null;
}
function resolvePackageRoot(source, agentDir = getAgentDir2(), cwd = process.cwd()) {
  const npmName = npmPackageName(source);
  if (npmName) {
    const candidates = [
      join3(agentDir, "npm", "node_modules", npmName),
      join3(cwd, ".pi", "npm", "node_modules", npmName)
    ];
    for (const c of candidates) {
      if (existsSync3(c)) return c;
    }
    return null;
  }
  if (source.startsWith("git:") || source.startsWith("https://") || source.startsWith("http://") || source.startsWith("ssh://")) {
    const gitRoot = join3(agentDir, "git");
    if (existsSync3(gitRoot)) {
    }
    return null;
  }
  const local = resolve(cwd, source);
  if (existsSync3(local)) return local;
  const abs = resolve(source);
  if (existsSync3(abs)) return abs;
  return null;
}
function readPiManifest(packageRoot) {
  const pj = join3(packageRoot, "package.json");
  if (!existsSync3(pj)) return null;
  try {
    const pkg = JSON.parse(readFileSync3(pj, "utf-8"));
    return pkg.pi && typeof pkg.pi === "object" ? pkg.pi : null;
  } catch {
    return null;
  }
}
function isExtensionFile(name) {
  return name.endsWith(".ts") || name.endsWith(".js") || name.endsWith(".mts") || name.endsWith(".mjs");
}
function resolveExtensionEntries(packageRoot) {
  const manifest = readPiManifest(packageRoot);
  if (manifest?.extensions?.length) {
    const entries = [];
    for (const extPath of manifest.extensions) {
      const resolved = resolve(packageRoot, extPath);
      if (!existsSync3(resolved)) continue;
      const st = statSync(resolved);
      if (st.isFile() && isExtensionFile(resolved)) {
        entries.push(resolved);
        continue;
      }
      if (st.isDirectory()) {
        const indexTs2 = join3(resolved, "index.ts");
        const indexJs2 = join3(resolved, "index.js");
        if (existsSync3(indexTs2)) entries.push(indexTs2);
        else if (existsSync3(indexJs2)) entries.push(indexJs2);
        else {
          try {
            for (const name of readdirSync(resolved)) {
              if (isExtensionFile(name)) {
                entries.push(join3(resolved, name));
              }
            }
          } catch {
          }
        }
      }
    }
    if (entries.length > 0) return entries;
  }
  const indexTs = join3(packageRoot, "index.ts");
  const indexJs = join3(packageRoot, "index.js");
  if (existsSync3(indexTs)) return [indexTs];
  if (existsSync3(indexJs)) return [indexJs];
  return [];
}
function resolveSpecPaths(spec, agentDir = getAgentDir2(), cwd = process.cwd()) {
  const packageRoot = resolvePackageRoot(spec.source, agentDir, cwd);
  if (!packageRoot) {
    return { packageRoot: null, extensionPaths: [] };
  }
  return {
    packageRoot,
    extensionPaths: resolveExtensionEntries(packageRoot)
  };
}
function isModuleLazyInSettings(source, settingsPackages) {
  const target = normalizeSourceKey(source);
  for (const entry of settingsPackages) {
    if (typeof entry === "string") {
      if (normalizeSourceKey(entry) === target) return false;
      continue;
    }
    if (entry && typeof entry === "object") {
      const obj = entry;
      if (typeof obj.source === "string" && normalizeSourceKey(obj.source) === target) {
        return Array.isArray(obj.extensions) && obj.extensions.length === 0;
      }
    }
  }
  return false;
}
function normalizeSourceKey(source) {
  const npm = npmPackageName(source);
  if (npm) return `npm:${npm}`;
  return source;
}
function findSettingsPackageIndex(settingsPackages, source) {
  const target = normalizeSourceKey(source);
  return settingsPackages.findIndex((entry) => {
    if (typeof entry === "string") return normalizeSourceKey(entry) === target;
    if (entry && typeof entry === "object" && typeof entry.source === "string") {
      return normalizeSourceKey(entry.source) === target;
    }
    return false;
  });
}

// src/migrate.ts
function packageSource(spec) {
  if (spec.source.startsWith("npm:") || spec.source.startsWith("git:") || spec.source.startsWith("http://") || spec.source.startsWith("https://") || spec.source.startsWith("ssh://") || spec.source.startsWith("/") || spec.source.startsWith(".")) {
    return spec.source;
  }
  return `npm:${spec.source}`;
}
function migrateSettings(agentDir = getAgentDir3()) {
  const settingsPath = getSettingsPath(agentDir);
  const config = loadConfig(agentDir);
  const managed = config.specs.filter(isManagedLazy);
  if (!existsSync4(settingsPath)) {
    return { ok: false, settingsPath, changed: [], skipped: [], added: [], error: "settings.json not found" };
  }
  let settings;
  try {
    settings = JSON.parse(readFileSync4(settingsPath, "utf-8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, settingsPath, changed: [], skipped: [], added: [], error: message };
  }
  const packages = Array.isArray(settings.packages) ? [...settings.packages] : [];
  const changed = [];
  const skipped = [];
  const added = [];
  for (const spec of managed) {
    const source = packageSource(spec);
    const idx = findSettingsPackageIndex(packages, spec.source);
    if (idx === -1) {
      packages.push({ source, extensions: [] });
      added.push(spec.name);
      changed.push(`${spec.name} (added)`);
      continue;
    }
    const current = packages[idx];
    if (typeof current === "string") {
      packages[idx] = { source: current, extensions: [] };
      changed.push(spec.name);
      continue;
    }
    if (current && typeof current === "object") {
      const obj = { ...current };
      if (Array.isArray(obj.extensions) && obj.extensions.length === 0) {
        skipped.push(spec.name);
        continue;
      }
      obj.extensions = [];
      if (typeof obj.source !== "string") obj.source = source;
      packages[idx] = obj;
      changed.push(spec.name);
      continue;
    }
    skipped.push(spec.name);
  }
  for (const spec of config.specs.filter((s) => s.lazy === false)) {
    const idx = findSettingsPackageIndex(packages, spec.source);
    if (idx === -1) continue;
    const current = packages[idx];
    if (!current || typeof current !== "object") continue;
    const obj = current;
    if (!(Array.isArray(obj.extensions) && obj.extensions.length === 0 && typeof obj.source === "string")) {
      continue;
    }
    const otherFilters = Object.entries(obj).some(([k, v]) => {
      if (k === "source" || k === "extensions") return false;
      return Array.isArray(v) && v.length > 0;
    });
    if (otherFilters) continue;
    packages[idx] = obj.source;
    changed.push(`${spec.name} (restored eager)`);
  }
  if (changed.length === 0) {
    return { ok: true, settingsPath, changed, skipped, added };
  }
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const backupPath = `${settingsPath}.bak.lazy-${stamp}`;
  copyFileSync(settingsPath, backupPath);
  settings.packages = packages;
  writeFileSync2(settingsPath, `${JSON.stringify(settings, null, 2)}
`, "utf-8");
  return { ok: true, backupPath, settingsPath, changed, skipped, added };
}

// src/index.ts
import { performance } from "node:perf_hooks";
import { existsSync as existsSync5, readFileSync as readFileSync5 } from "node:fs";
function readSettingsPackages(agentDir) {
  const path = getSettingsPath(agentDir);
  if (!existsSync5(path)) return [];
  try {
    const settings = JSON.parse(readFileSync5(path, "utf-8"));
    return Array.isArray(settings.packages) ? settings.packages : [];
  } catch {
    return [];
  }
}
function buildCatalog(config, agentDir, cwd) {
  const packages = readSettingsPackages(agentDir);
  const map = /* @__PURE__ */ new Map();
  for (const spec of config.specs) {
    const managed = isManagedLazy(spec);
    const moduleLazyReady = managed && isModuleLazyInSettings(spec.source, packages);
    let state;
    if (!managed) {
      state = "eager";
    } else if (!moduleLazyReady) {
      state = "eager";
    } else {
      state = "pending";
    }
    map.set(spec.name, {
      spec,
      // Avoid filesystem/package.json scans for packages that are never loaded.
      packageRoot: "",
      extensionPaths: [],
      moduleLazyReady,
      state
    });
  }
  return map;
}
function formatStatus(rt) {
  const all = [...rt.entries.values()];
  const loaded = all.filter((e) => e.state === "loaded").length;
  const pending = all.filter((e) => e.state === "pending").length;
  const eager = all.filter((e) => e.state === "eager").length;
  const errors = all.filter((e) => e.state === "error").length;
  const parts = [`lazy ${loaded}\u2191`, `${pending}\xB7`, `${eager}\u26A1`];
  if (errors) parts.push(`${errors}\u2717`);
  return parts.join(" ");
}
function refreshStatus(pi, rt, ctx) {
  rt.status = formatStatus(rt);
  const ui = ctx?.ui ?? void 0;
  if (ui && typeof ui.setStatus === "function") {
    ui.setStatus("pi-lazy", rt.status);
  }
}
function recordTiming(rt, label, started) {
  rt.profile.push({ label, ms: performance.now() - started });
  if (rt.profile.length > 100) rt.profile.shift();
}
async function loadByName(pi, rt, name, ctx) {
  const key = name.trim();
  const entry = rt.entries.get(key) ?? [...rt.entries.values()].find(
    (e) => e.spec.source === key || e.spec.source.endsWith(key) || e.spec.name.toLowerCase() === key.toLowerCase()
  );
  if (!entry) {
    return { ok: false, name: key, error: `unknown spec '${key}' \u2014 see /lazy list` };
  }
  if (entry.state === "eager") {
    return {
      ok: true,
      name: entry.spec.name,
      alreadyLoaded: true,
      error: void 0
    };
  }
  if (!entry.packageRoot && entry.extensionPaths.length === 0) {
    const started2 = performance.now();
    const resolved = resolveSpecPaths(entry.spec, getAgentDir4(), (ctx ?? rt.sessionCtx)?.cwd ?? process.cwd());
    entry.packageRoot = resolved.packageRoot ?? "";
    entry.extensionPaths = resolved.extensionPaths;
    entry.resolveMs = performance.now() - started2;
    recordTiming(rt, `resolve:${entry.spec.name}`, started2);
  }
  const started = performance.now();
  const result = await loadResolvedEntry(entry, pi, ctx ?? rt.sessionCtx, {
    loadDependency: (dep) => loadByName(pi, rt, dep, ctx)
  });
  recordTiming(rt, `load:${entry.spec.name}`, started);
  refreshStatus(pi, rt, ctx ?? rt.sessionCtx);
  return result;
}
function registerStubs(pi, rt) {
  const cmdOwners = /* @__PURE__ */ new Map();
  const toolOwners = /* @__PURE__ */ new Map();
  for (const entry of rt.entries.values()) {
    if (entry.state !== "pending") continue;
    const { spec } = entry;
    for (const cmd of spec.cmd ?? []) {
      if (cmdOwners.has(cmd)) continue;
      cmdOwners.set(cmd, spec.name);
    }
    for (const tool of spec.tools ?? []) {
      if (toolOwners.has(tool)) continue;
      toolOwners.set(tool, spec.name);
    }
    for (const key of spec.keys ?? []) {
      try {
        pi.registerShortcut(key, {
          description: `Load lazy package ${spec.name}`,
          handler: async (ctx) => {
            const res = await loadByName(pi, rt, spec.name, ctx);
            ctx.ui.notify(
              res.ok ? res.alreadyLoaded ? `${spec.name} already loaded` : `loaded ${spec.name}${res.loadMs != null ? ` (${res.loadMs}ms)` : ""}` : `failed ${spec.name}: ${res.error}`,
              res.ok ? "info" : "error"
            );
          }
        });
      } catch {
      }
    }
  }
  for (const [cmd, owner] of cmdOwners) {
    pi.registerCommand(cmd, {
      description: `[lazy] load ${owner} then run /${cmd}`,
      handler: async (args, ctx) => {
        const res = await loadByName(pi, rt, owner, ctx);
        if (!res.ok) {
          ctx.ui.notify(`lazy: failed to load ${owner}: ${res.error}`, "error");
          return;
        }
        const suffix = args?.trim() ? ` ${args.trim()}` : "";
        pi.sendUserMessage(`/${cmd}${suffix}`, { deliverAs: "followUp" });
        if (!res.alreadyLoaded) {
          ctx.ui.notify(`lazy: loaded ${owner}${res.loadMs != null ? ` in ${res.loadMs}ms` : ""}`, "info");
        }
      }
    });
  }
  for (const [toolName, owner] of toolOwners) {
    pi.registerTool({
      name: toolName,
      label: `Lazy: ${toolName}`,
      description: `Lazy stub for ${toolName}. Loads package '${owner}' on first use, then activates the real tool. Call again after activation if needed.`,
      parameters: Type.Object({
        _lazy: Type.Optional(Type.String({ description: "Ignored. Present so the tool is valid before load." }))
      }, { additionalProperties: true }),
      async execute(_id, _params, _signal, _onUpdate, ctx) {
        const res = await loadByName(pi, rt, owner, ctx);
        if (!res.ok) {
          return {
            content: [{ type: "text", text: `Failed to load '${owner}': ${res.error}` }],
            details: { ok: false, error: res.error }
          };
        }
        const tools = res.tools?.length ? res.tools.join(", ") : "(see package)";
        return {
          content: [
            {
              type: "text",
              text: res.alreadyLoaded ? `Package '${owner}' already available. Use the real tools now.` : `Loaded '${owner}'${res.loadMs != null ? ` in ${res.loadMs}ms` : ""}. Registered tools: ${tools}. Call the real tool again on the next turn.`
            }
          ],
          details: { ok: true, loaded: owner, tools: res.tools ?? [], alreadyLoaded: !!res.alreadyLoaded }
        };
      }
    });
  }
}
function registerEventTriggers(pi, rt) {
  const eventMap = /* @__PURE__ */ new Map();
  for (const entry of rt.entries.values()) {
    if (entry.state !== "pending") continue;
    for (const ev of entry.spec.event ?? []) {
      const list = eventMap.get(ev) ?? [];
      list.push(entry.spec.name);
      eventMap.set(ev, list);
    }
  }
  pi.on("before_agent_start", async (event, ctx) => {
    if (!rt.auto) return;
    const prompt = (event.prompt ?? "").toLowerCase();
    const toLoad = /* @__PURE__ */ new Set();
    for (const name of eventMap.get("before_agent_start") ?? []) {
      toLoad.add(name);
    }
    for (const entry of rt.entries.values()) {
      if (entry.state !== "pending") continue;
      for (const kw of entry.spec.keywords ?? []) {
        if (kw && prompt.includes(kw.toLowerCase())) {
          toLoad.add(entry.spec.name);
          break;
        }
      }
    }
    const limit = rt.config.autoLoadLimit ?? 1;
    for (const name of [...toLoad].slice(0, limit)) {
      const res = await loadByName(pi, rt, name, ctx);
      if (res.ok && !res.alreadyLoaded) {
        ctx.ui.notify(`lazy: auto-loaded ${name}`, "info");
      }
    }
  });
}
async function runAfterStart(pi, rt, ctx) {
  const queue = [...rt.entries.values()].filter((e) => e.state === "pending" && e.spec.lazy === "after-start").sort((a, b) => (a.spec.priority ?? 100) - (b.spec.priority ?? 100));
  const batchSize = rt.config.afterStartBatchSize ?? 1;
  const delayMs = rt.config.afterStartDelayMs ?? 0;
  for (let i = 0; i < queue.length && !rt.queueCancelled; i += batchSize) {
    for (const entry of queue.slice(i, i + batchSize)) {
      const res = await loadByName(pi, rt, entry.spec.name, ctx);
      if (!res.ok) ctx.ui.notify(`lazy: after-start failed ${entry.spec.name}: ${res.error}`, "warning");
    }
    if (i + batchSize < queue.length && !rt.queueCancelled) {
      await new Promise((resolve2) => setTimeout(resolve2, delayMs));
    }
  }
  refreshStatus(pi, rt, ctx);
}
function listLines(rt) {
  const lines = [];
  const order = ["pending", "loading", "loaded", "error", "eager"];
  const sorted = [...rt.entries.values()].sort((a, b) => {
    const ai = order.indexOf(a.state);
    const bi = order.indexOf(b.state);
    if (ai !== bi) return ai - bi;
    return a.spec.name.localeCompare(b.spec.name);
  });
  for (const e of sorted) {
    const mode = e.spec.lazy === false ? "eager" : e.spec.lazy === "after-start" ? "after-start" : "on-demand";
    const ms = e.loadMs != null ? ` ${e.loadMs}ms` : "";
    const err = e.error ? ` \u2014 ${e.error}` : "";
    const ready = e.moduleLazyReady ? "" : e.state === "eager" && isManagedLazy(e.spec) ? " (migrate+restart needed)" : "";
    lines.push(`${e.state.padEnd(8)} ${e.spec.name.padEnd(16)} ${mode.padEnd(12)} ${e.spec.source}${ms}${ready}${err}`);
  }
  return lines;
}
function piLazy(pi) {
  const agentDir = getAgentDir4();
  const config = loadConfig(agentDir);
  const rt = {
    config,
    entries: /* @__PURE__ */ new Map(),
    auto: config.auto !== false,
    afterStartQueued: false,
    status: "lazy \u2026",
    profile: [],
    queueCancelled: false
  };
  const rebuild = (cwd) => {
    const started = performance.now();
    rt.config = loadConfig(agentDir);
    rt.auto = rt.config.auto !== false;
    rt.entries = buildCatalog(rt.config, agentDir, cwd);
    rt.status = formatStatus(rt);
    recordTiming(rt, "catalog", started);
  };
  rebuild(process.cwd());
  registerStubs(pi, rt);
  registerEventTriggers(pi, rt);
  pi.on("session_start", async (event, ctx) => {
    rt.sessionCtx = ctx;
    rt.queueCancelled = false;
    rebuild(ctx.cwd);
    refreshStatus(pi, rt, ctx);
    const needsMigrate = [...rt.entries.values()].some(
      (e) => isManagedLazy(e.spec) && !e.moduleLazyReady
    );
    if (needsMigrate && event.reason === "startup") {
      ctx.ui.notify("pi-lazy: run /lazy migrate then restart for true module-lazy", "info");
    }
    if (!rt.afterStartQueued) {
      rt.afterStartQueued = true;
      setTimeout(() => {
        void runAfterStart(pi, rt, ctx);
      }, 0);
    }
  });
  pi.on("session_shutdown", () => {
    rt.sessionCtx = void 0;
    rt.afterStartQueued = false;
    rt.queueCancelled = true;
  });
  pi.registerCommand("lazy", {
    description: "LazyVim-style extension manager (list|load|migrate|auto|init|status)",
    getArgumentCompletions: (prefix) => {
      const sub = ["status", "list", "load", "migrate", "auto", "init", "config", "profile"];
      const names = [...rt.entries.keys()].map((n) => `load ${n}`);
      const items = [...sub, ...names, "auto on", "auto off"].map((v) => ({ value: v, label: v }));
      const filtered = items.filter((i) => i.value.startsWith(prefix) || i.value.includes(prefix));
      return filtered.length ? filtered : null;
    },
    handler: async (args, ctx) => {
      const raw = (args ?? "").trim();
      const [head, ...rest] = raw.split(/\s+/);
      const sub = (head || "status").toLowerCase();
      if (sub === "status" || sub === "") {
        const lines = [
          formatStatus(rt),
          `auto: ${rt.auto ? "on" : "off"}`,
          `config: ${getLazyConfigPath(agentDir)}`,
          "",
          ...listLines(rt)
        ];
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }
      if (sub === "list") {
        ctx.ui.notify(listLines(rt).join("\n") || "no specs", "info");
        return;
      }
      if (sub === "config") {
        ctx.ui.notify(getLazyConfigPath(agentDir), "info");
        return;
      }
      if (sub === "profile") {
        const lines = rt.profile.length ? rt.profile.map((item) => `${item.label.padEnd(24)} ${item.ms.toFixed(1)}ms`) : ["no timings recorded"];
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }
      if (sub === "init") {
        const path = saveConfig(defaultConfig(), agentDir);
        rebuild(ctx.cwd);
        ctx.ui.notify(`wrote default config \u2192 ${path}`, "info");
        return;
      }
      if (sub === "auto") {
        const mode = (rest[0] ?? "").toLowerCase();
        if (mode === "on" || mode === "off") {
          rt.auto = mode === "on";
          rt.config.auto = rt.auto;
          saveConfig(rt.config, agentDir);
          ctx.ui.notify(`lazy auto ${mode}`, "info");
          return;
        }
        ctx.ui.notify(`lazy auto is ${rt.auto ? "on" : "off"} (usage: /lazy auto on|off)`, "info");
        return;
      }
      if (sub === "migrate") {
        const result = migrateSettings(agentDir);
        if (!result.ok) {
          ctx.ui.notify(`migrate failed: ${result.error}`, "error");
          return;
        }
        const lines = [
          result.changed.length ? `updated: ${result.changed.join(", ")}` : "no package changes needed",
          result.skipped.length ? `already lazy: ${result.skipped.join(", ")}` : "",
          result.added.length ? `added: ${result.added.join(", ")}` : "",
          result.backupPath ? `backup: ${result.backupPath}` : "",
          "Restart pi to apply module-lazy (extensions filtered to [])."
        ].filter(Boolean);
        ctx.ui.notify(lines.join("\n"), "info");
        rebuild(ctx.cwd);
        refreshStatus(pi, rt, ctx);
        return;
      }
      if (sub === "load") {
        const name = rest.join(" ").trim();
        if (!name) {
          ctx.ui.notify("usage: /lazy load <name>", "warning");
          return;
        }
        const res = await loadByName(pi, rt, name, ctx);
        if (!res.ok) {
          ctx.ui.notify(`load failed: ${res.error}`, "error");
          return;
        }
        if (res.alreadyLoaded) {
          ctx.ui.notify(`${res.name} already loaded/eager`, "info");
          return;
        }
        ctx.ui.notify(
          `loaded ${res.name}${res.loadMs != null ? ` in ${res.loadMs}ms` : ""}${res.tools?.length ? ` \u2014 tools: ${res.tools.join(", ")}` : ""}`,
          "info"
        );
        return;
      }
      ctx.ui.notify("usage: /lazy [status|list|profile|load <name>|migrate|auto on|off|init|config]", "warning");
    }
  });
  pi.registerTool({
    name: "lazy_load",
    label: "Lazy Load",
    description: "Load a deferred Pi extension package managed by pi-lazy (LazyVim-style). Use when a capability is pending/on-demand (web, mcp, lens, plannotator, context-mode, etc.). Prefer /lazy list names.",
    promptSnippet: "Load a deferred pi-lazy extension package on demand",
    parameters: Type.Object({
      name: Type.String({ description: "Spec name from /lazy list (e.g. web, mcp, lens, plannotator)" })
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const res = await loadByName(pi, rt, params.name, ctx);
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `Failed: ${res.error}` }],
          details: res
        };
      }
      return {
        content: [
          {
            type: "text",
            text: res.alreadyLoaded ? `'${res.name}' already loaded or eager.` : `Loaded '${res.name}' in ${res.loadMs ?? "?"}ms. tools=[${(res.tools ?? []).join(", ")}] commands=[${(res.commands ?? []).join(", ")}]`
          }
        ],
        details: res
      };
    }
  });
}
export {
  piLazy as default
};
