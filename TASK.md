# Jumbotron rework: cleanup and runtime-first architecture

This file is the specification for an AI agent (or a human) doing the rework of Jumbotron, a modloader for the GameMaker HTML5 build of Retro Bowl. Read it fully before touching anything. Decisions in the "Decisions already made" section are settled; do not reopen them. Everything else is yours to work out, within the acceptance criteria.

Work on a branch. Commit in small, reviewable steps that each keep `npm test` and `npm run check:ci` green. Do not open a PR or push unless told to.

## 1. Background you need

### 1.1 What exists today

An npm-workspaces monorepo. The engine (`injector/injector-core/src/hook.ts`) fetches the 7.2 MB game bundle, parses it with Babel into a 1.4 M node AST, matches declarative JSON selectors that mirror Babel node shapes, mutates nodes, regenerates 9.8 MB of JS, and evaluates it from a blob URL. This takes about 8.5 s and 415 MB of heap in Node per page load, with no caching. Mods are authored in `modkit/` as Babel-AST-shaped selectors plus tag-numbered actions and exported to `*.jb.json`. Three mods exist: `jettison-poki` (remove Poki entries from `JSON_game.Extensions`), `override-poki` (`global.gmlpoki = true` to `false`), and `show-jumbotron-version` (wrap `gml_Script_s_get_gm_version`). All three are being replaced; their behaviour is the acceptance test for the new system.

`docs/injector-architecture.md`, `.github/copilot-instructions.md`, and the deleted README (see `git show HEAD~1:README.md` on `main`) describe the old design. They are useful for orientation and wrong in places (they claim the game data is gitignored and that there are no tests). They are all being deleted or rewritten.

### 1.2 Facts about the game bundle that the new design depends on

Verify each of these against the real bundle before relying on it; they were checked against the 2024-09-24 Poki snapshot (`data/raw/html5game/RetroBowl.js`).

- The bundle is a sloppy-mode classic script (no `"use strict"`, no modules). Every GML script and object event is a top-level function declaration: `function gml_Script_<name>(_inst,_other,argument0,...)`, `function gml_Object_<obj>_<Event>_<n>(_inst,_other)`, `gml_Room_*`, `gml_RoomCC_*`, `gml_GlobalScript_*`. About 4,200 of them. All are therefore writable properties of `window`.
- Call sites call them by global identifier (`gml_Script_x(_inst,_other)`). Some are bound lazily at runtime with `__yy_method(_inst, gml_Script_x)` inside Create events. There is no script table that captures function references at bundle-evaluation time. Consequently, replacing `window.gml_Script_x` after the bundle evaluates and before `GameMaker_Init()` runs affects every caller.
- `global` is a plain top-level object holding GML globals (`global.gmlpoki`, etc.). `JSON_game` is a top-level `var` holding the asset manifest including `Extensions`.
- Nothing in the bundle calls `GameMaker_Init()`. The original page does, from the Poki SDK callback. The loader owns that call.
- The runtime prefixes asset paths with `"html5game/"` unless `window.g_GameMakerHTML5Dir` is defined before the bundle evaluates, in which case that value is the base. Text data files (`Teams.txt`, `Names_*.txt`, `LanguageUS.txt`, ...) are tab-separated with a header row and are fetched with `XMLHttpRequest`; textures via `Image`, audio via fetch/XHR into WebAudio.
- `vph_poki.js` and `tph_crazygames.js` are extension shims that expect `window.PokiSDK`. The original page sets `window.PokiSDK = null` when the SDK fails to load. The extension init entry `{init:"gml_Script_poki_init"}` is in `JSON_game.Extensions`.
- Two variants exist: Retro Bowl (`data/raw`) and Retro Bowl College (`data/raw_co`, different function set, `*_CO.txt` data files). Both must be supported by the design; only Retro Bowl needs to be exercised end to end in this rework.

## 2. Decisions already made

1. **Runtime-first.** Mods run as JavaScript after the bundle evaluates and before `GameMaker_Init()`. No whole-bundle parse at page load. Babel is removed from the browser path entirely.
2. **Mods are ES modules, not JSON.** A mod is a module whose default export is `defineMod({...})`. Authors write TypeScript against `@jumbotron/sdk` types; the loader passes the runtime API into the mod's `setup` function. Mods never bundle the runtime.
3. **Three tiers of change**, each used only when the lower one is insufficient: (a) runtime hooks and data overrides, (b) per-function source patches, (c) offline pre-patched bundles built by a CLI. The old declarative AST selector format is not carried forward in any tier.
4. **Compatibility is a first-class runtime concern.** Every mutation a mod makes goes through the runtime registry so that mutations compose (hooks chain, patches apply in sequence, file transforms chain) and every conflict is detected and reported with the mod ids involved. Silent failure is a bug.
5. **Game assets leave the repository.** `data/raw` and `data/raw_co` are deleted from the tree and gitignored. A CLI command fetches them into a gitignored directory for development. The deployed loader never serves game assets from the repo. (Whether to purge them from git history is the owner's call; do not rewrite history.)
6. **Tooling stays:** npm workspaces, TypeScript strict, Biome with the existing config, Renovate, the automerge workflow, GitHub Pages deploy of the loader. Node 22 minimum. Tests move to Vitest.

## 3. Cleanup (Phase 0)

Delete, with `git rm`, and remove every reference from `package.json` workspaces, `biome.json`, `.biomeignore`, `jsconfig.json`, and workflows:

- `injector/` (all three packages), `parser/`, `modkit/`, `typings-core/`, `app/` (replaced by `packages/loader`; salvage nothing but the checkbox-panel idea).
- `data/` entirely, including `proxy.py` and `overwrite/index.html`. Record the two CDN base URLs and the `Referer` header from `proxy.py` in the new CLI fetch command before deleting.
- `devkit.sh` (references `injector/out`, which no longer exists), `obf.js`, `test.js`, `jsconfig.json`, `.gitpod.yml`, `injector/injector-core/meta.json`.
- `docs/injector-architecture.md`, `docs/biome-guide.md`. Fold the useful Biome commands into the README.
- `.github/copilot-instructions.md`: rewrite from scratch after the new layout exists (see Phase 6); do not carry old text forward.
- `.vscode/`: keep.

After deletion the repo should contain only root config, workflows, and `packages/`. Add `game/` (fetched assets) and `**/generated/*.tmp` style scratch to `.gitignore`. Check `npm ci` and the workflows still pass on an essentially empty workspace before starting Phase 1.

## 4. Target layout

```
packages/
  runtime/      @jumbotron/runtime   browser library the loader executes: registry, hooks,
                                     source patches, file overrides, lifecycle, conflict report
  sdk/          @jumbotron/sdk       author-facing: defineMod, types, helpers; type-only at runtime
  game-index/   @jumbotron/game-index generated catalog of game functions per bundle hash, plus
                                     the generator; d.ts consumed by sdk
  cli/          @jumbotron/cli       `jumbotron fetch-game`, `jumbotron index`, `jumbotron build-bundle`,
                                     `jumbotron build-mod`
  loader/       (private)            Vite app: picks mods, boots the game, shows the conflict report
  mods/         (private)            first-party mods, each a folder with src/ and a built dist/
    no-poki/
    show-version/
game/           gitignored, populated by `jumbotron fetch-game`
```

Dependency direction: `mods -> sdk (types only)`, `sdk -> game-index (types)`, `loader -> runtime, sdk`, `cli -> runtime (for build-bundle), game-index`. `runtime` depends on nothing at runtime. Keep `runtime` small; target under 15 KB minified.

## 5. Runtime and SDK design (Phases 1 and 2)

### 5.1 Mod definition

```ts
// packages/sdk/src/index.ts (shape; refine as needed)
export interface ModManifest {
  id: string;                 // [a-z0-9-]+, unique, used as namespace everywhere
  name: string;
  version: string;            // semver
  description?: string;
  game?: {
    variant?: "retro-bowl" | "retro-bowl-college" | "any";
    bundleHashes?: string[];  // sha256 of RetroBowl.js this mod was tested against
  };
  requires?: string[];        // mod ids that must be loaded, and loaded first
  after?: string[];           // soft ordering: load after these if present
  before?: string[];
  conflicts?: string[];       // hard: refuse to load together
}

export interface Mod extends ModManifest {
  setup(api: ModApi): void | Promise<void>;   // runs before GameMaker_Init
}

export function defineMod(mod: Mod): Mod;      // identity with type checking
```

The loader dynamically `import()`s each selected mod URL, reads the default export, resolves order (topological on `requires`/`after`/`before`, then by id for determinism), rejects `conflicts` pairs and missing `requires` with a clear message, and calls `setup` in order. `setup` may be async; the loader awaits all before calling `GameMaker_Init()`.

### 5.2 The API passed to `setup`

```ts
export interface ModApi {
  readonly mod: Readonly<ModManifest>;
  readonly game: { variant: string; bundleHash: string; functions: ReadonlySet<string> };
  readonly log: (...args: unknown[]) => void;    // prefixed with mod id

  // Tier 1: hooks. All compose. Handlers run in mod load order.
  hook<N extends GameFunctionName>(name: N, handler: HookHandler<N>): void;
  before<N extends GameFunctionName>(name: N, fn: (...args: Args<N>) => void | Args<N>): void;
  after<N extends GameFunctionName>(name: N, fn: (result: Ret<N>, ...args: Args<N>) => Ret<N> | void): void;

  // Tier 1: globals and manifest. Recorded per mod for conflict reporting.
  globals: {
    get(key: string): unknown;
    set(key: string, value: unknown): void;          // `global.gml<key>`; warns if another mod set a different value
  };
  extensions: {
    disable(name: string): void;                     // removes JSON_game.Extensions entries by name and their init entries; idempotent
  };

  // Tier 1: data files. Transforms chain in load order; replace is exclusive.
  files: {
    transformText(path: string, fn: (text: string) => string): void;
    transformTable(path: string, fn: (rows: Record<string, string>[], header: string[]) => Record<string, string>[]): void;
    replace(path: string, source: Blob | string | (() => Promise<Blob>)): void;   // warns if combined with any other override of the same path
    add(path: string, source: Blob | string | (() => Promise<Blob>)): void;       // new file the game does not ship
  };

  // Tier 2: source patches on one function. Applied in load order, each verified.
  patch<N extends GameFunctionName>(name: N, ops: PatchOp | PatchOp[]): void;

  // Escape hatches, recorded as exclusive claims so the loader can warn.
  replaceFunction<N extends GameFunctionName>(name: N, fn: GameFunction<N>): void;
  defineFunction(localName: string, fn: (...args: unknown[]) => unknown): string;  // returns the namespaced global name

  // Lifecycle
  onBeforeInit(fn: () => void | Promise<void>): void;
  onAfterInit(fn: () => void): void;   // after GameMaker_Init returns; game objects exist
  state: Record<string, unknown>;       // per-mod scratch, persisted to localStorage under the mod id if the mod opts in
}

type HookHandler<N> = (ctx: { orig: GameFunction<N>; inst: unknown; other: unknown; args: Args<N>; mod: string }) => Ret<N>;

type PatchOp =
  | { kind: "replace"; find: string | RegExp; with: string; expect?: number }   // expect defaults to 1; mismatch is an error
  | { kind: "insertBefore"; anchor: string | RegExp; code: string; expect?: number }
  | { kind: "insertAfter"; anchor: string | RegExp; code: string; expect?: number }
  | { kind: "prepend"; code: string }     // at function body start
  | { kind: "append"; code: string };     // before every return is NOT implied; document that append runs only at fall-through end
```

Design notes the implementation must honour:

- **Hooks chain.** The registry keeps an ordered list of handlers per function name. The installed wrapper calls the last-registered handler with `orig` bound to the next one down, bottoming out at the current function value (which may already be a patched or replaced function). `before` and `after` are sugar over `hook`. `this` must be forwarded with `Function.prototype.apply`; GML calls pass `_inst` and `_other` positionally, so expose them as `ctx.inst` and `ctx.other` and keep `args` as the remaining arguments.
- **Installation happens once, at the end of setup, not per call.** Collect all registrations during every mod's `setup`; then, in one pass per touched function: apply source patches in order, then `replaceFunction` if claimed (error if more than one mod claims it, or if a mod both patches and another replaces), then wrap with the hook chain. Assign the final function to `window[name]`. This ordering is what lets a patch and a hook from different mods coexist.
- **Patches operate on `fn.toString()` of the current function value.** Wrap the result in parentheses, evaluate with indirect eval `(0, eval)(...)` so it binds in global scope, and assign to `window[name]`. Every op's `find`/`anchor` must match exactly `expect` times; on mismatch throw a `PatchError` naming the mod, function, op index, and the other mods that touched the function earlier (that is the conflict report). Never fall back to skipping the op. Cache the pre-patch source so the report can show the original text alongside the current text.
- **Hooks on names that do not exist** throw at registration with the nearest three names by Levenshtein distance from the game index. Same for `patch` and `replaceFunction`.
- **File overrides** are served through the asset layer (5.3). `transformTable` parses the TSV (first line is header, values are tab-separated, file starts with a UTF-8 BOM) and serialises back in the same shape. Transforms chain; `replace` is exclusive and produces a warning, not an error, when combined with transforms from other mods, applied in the order: replace source first, then transforms. `add` conflicts on same path are errors.
- **Globals.** `globals.set` records `{key, value, mod}`; if two mods set the same key to values that are not `Object.is`-equal, the loader shows a warning naming both. Last writer in load order wins.
- **Namespacing.** `defineFunction("foo", fn)` installs `window["jb_" + modId.replace(/-/g, "_") + "_foo"]` and returns that name so patch code can reference it. Mods must not create other globals; document this. The runtime checks `Object.keys(window)` before and after each mod's `setup` in development mode and warns about stray globals.
- **Report.** After installation the runtime produces a `LoadReport`: per mod, the list of functions hooked, patched, replaced, globals set, files touched, plus a list of warnings and errors with mod ids. The loader renders it. A mod whose `setup` throws is disabled and the game still boots with the others unless a `requires` chain depends on it.

### 5.3 Asset layer

The loader sets `window.g_GameMakerHTML5Dir` to a virtual base (for example `/jb-assets/`) before injecting the bundle script and registers a service worker that answers requests under that base. The service worker resolves a request by: (1) mod `add`/`replace` sources, (2) the game source, then applies `transform*` chains for text files. Transforms are registered in the page, so the service worker fetches the original and posts it to the page (or the page pre-computes transformed files during setup and hands them to the worker via a `MessageChannel` cache). Choose whichever is simpler and document it.

Game sources, in priority order, selectable in the loader UI and persisted in IndexedDB:

1. **Local directory** picked via the File System Access API (`showDirectoryPicker`), the directory that contains `html5game/`. Persist the handle. This is the primary supported way to run the deployed loader, because it keeps Poki's assets off our origin.
2. **Same-origin** `game/` directory, used by the Vite dev server, which serves the gitignored `game/` fetched by the CLI.
3. **Remote base URL** (the Poki CDN or any other host). Only works if that host sends permissive CORS headers for XHR text loads. Implement it, verify against the Poki CDN, and if CORS fails, keep it in the UI with an explanatory error rather than removing it.

The bundle itself (`RetroBowl.js`) is loaded as a classic `<script>` from the same virtual base so the browser caches it and `fn.toString()` works. Before it executes, set `window.PokiSDK = null` unless a mod says otherwise. After all mods' `setup` and `onBeforeInit` resolve, call `window.GameMaker_Init()`, then run `onAfterInit` callbacks.

### 5.4 First-party mods

Reimplement the three old mods as two:

- `no-poki`: `extensions.disable("Poki")` and `extensions.disable("crazygames")`, `globals.set("poki", false)`. Enabled by default in the loader. Verify the game boots to the title screen with only this mod and with no mods.
- `show-version`: `after("gml_Script_s_get_gm_version", (r) => r + "\nJumbotron " + version)` where the version is read from the mod's package at build time. Verify the string appears on the title/settings screen.

Add a third that exercises tier 2 and the file layer so both paths are proven on real code, for example `custom-teams` that renames one team via `files.transformTable("Teams.txt", ...)` and `patch` that changes one numeric literal inside `gml_Script_s_get_player_ovr` (its body is a chain of `yyCompareVal` switch cases; `test.js` on `main` before cleanup shows the shape). Any small, visible change is fine.

Each mod folder: `package.json` (name `@jumbotron-mods/<id>`, private), `src/index.ts`, built by `jumbotron build-mod` to `dist/index.js` (single ESM file, esbuild, externals none because the mod imports only types). `mods/` is a workspace so `npm run build` builds them.

## 6. Game index (Phase 3)

`jumbotron index <path-to-RetroBowl.js>` produces `packages/game-index/generated/<variant>.json` and `<variant>.d.ts`. Do not run `tsc` over the bundle. A single regex pass over `function (gml_\w+)\(([^)]*)\)` is enough to extract names and parameter lists; record `bundleHash` (sha256), `variant`, `fetchedAt`, and the count. The `.d.ts` declares `interface GameFunctions { gml_Script_x(_inst: unknown, _other: unknown, argument0?: unknown, ...): unknown }` and `type GameFunctionName = keyof GameFunctions`. The sdk's `hook`/`patch`/`after` generics are typed against it, so authors get autocomplete and typos fail at compile time. Commit the generated files; they are a few hundred KB and change only when the game updates. Add a test that regenerating from the fetched bundle is a no-op.

Both variants get an index. The sdk exposes a union by default and per-variant types under `@jumbotron/sdk/retro-bowl` and `@jumbotron/sdk/college`.

## 7. CLI (Phase 4)

`packages/cli`, invoked as `npx jumbotron <cmd>` from the repo root (bin entry in the workspace). Commands:

- `fetch-game [--variant retro-bowl|college] [--out game/]`: downloads `index.html`, `html5game/RetroBowl.js`, and every asset referenced by the bundle's `JSON_game` (sounds, textures, included text files, extension js files) from the CDN base recorded from the old `proxy.py`, with the `Referer: https://games.poki.com/` header. Print the bundle hash at the end. Skip files whose size and hash match.
- `index <bundle>`: Phase 3.
- `build-mod <dir>`: esbuild `src/index.ts` to `dist/index.js` (ESM, target es2022, minify off by default). Inject `__MOD_VERSION__` from `package.json`.
- `build-bundle --game game/ --mods <dist paths...> --out patched/`: tier 3. Runs the same runtime in Node (jsdom is not required; provide a minimal `window`/`global` shim, evaluate the bundle with `vm`, run mod setups, apply patches and hooks), then serialises the result as a new `RetroBowl.js` in which each patched or replaced function declaration's source text is spliced in place by byte offsets (use `magic-string`; never regenerate the whole file), followed by an appended block that installs the hook chains and a tiny embedded copy of the runtime's install routine. Output also includes transformed data files. This is for CSP-restricted hosts and for producing a distributable; it is allowed to not support `add`/`replace` of binary assets in v1, but must say so in its output.

## 8. Loader (Phase 5)

Vite app in `packages/loader`. Plain TypeScript, no framework. Screens:

1. Game source picker (5.3) with the detected variant and bundle hash, and a warning if no game index matches the hash.
2. Mod list: first-party mods from `mods/*/dist` (served by the dev server, and copied into the Pages build), plus an "add mod by URL" input. Checkboxes, persisted in localStorage. Show each mod's manifest `game.bundleHashes` match state.
3. Start. Shows the `LoadReport`: per-mod touched functions and files, warnings in yellow, errors in red with the `PatchError` detail (original vs current source excerpt). A single "continue anyway" for warnings; errors disable the offending mod and re-run install.
4. The game canvas, full width, with the report collapsible above it.

Dev mode (`npm run dev` in the loader) serves `game/` at the virtual base, watches `mods/*/src`, rebuilds on change, and reloads the page. Hooks registered after init do not affect already-bound methods, so hot module replacement without a page reload is out of scope; say so in the README.

Pages deploy: `static.yml` builds the loader and first-party mods and uploads `packages/loader/dist`. No game assets in the artifact; assert this in the workflow with a `test ! -e dist/html5game` step.

## 9. Tests

Switch every package to Vitest (`npm test` at the root runs all). Required coverage:

- `runtime`: a synthetic fixture bundle (`packages/runtime/test/fixtures/mini-game.js`) with a dozen `gml_Script_*` functions, `global`, `JSON_game.Extensions`, and a `GameMaker_Init` that records calls. Test: hook chaining order across three mods; `before`/`after` semantics; patch ops with `expect` mismatch throwing `PatchError` naming the earlier mod; patch then hook from different mods; `replaceFunction` exclusivity; `globals.set` conflict warning; `extensions.disable` idempotence; `transformTable` round trip on a BOM-prefixed TSV; load ordering and `conflicts`/`requires` resolution; unknown-name suggestions.
- `game-index`: generator output on the fixture and idempotence on the real bundle when `game/` exists (skip otherwise).
- `cli build-bundle`: the fixture bundle plus a mod produces output that, when evaluated in `vm`, behaves identically to the runtime path (same hook results, same patched function output).
- `loader`: one Playwright smoke test that boots the fixture bundle through the real loader with the three first-party mods stubbed to the fixture's function names, and asserts the report shows no errors and `GameMaker_Init` was called. If `game/` is present locally, a second, skipped-in-CI test boots the real game with `no-poki` and `show-version` and asserts the version string is drawn (check via the hooked function's return value, not pixels).

## 10. Documentation and repo hygiene (Phase 6)

- New `README.md`: what Jumbotron is, the three tiers with one example each, how to run (`fetch-game`, `npm run dev`), how to write a mod (a complete 20-line example using `after`, `files.transformTable`, and `patch`), the compatibility rules (prefer hooks over patches, patches over replace; anchors should be the smallest unique string; never write bare globals), and the Biome commands.
- `packages/sdk/README.md`: API reference generated from the TSDoc comments or hand-written; every `ModApi` member with one example.
- Rewrite `.github/copilot-instructions.md` for the new layout, under 80 lines.
- Update `test.yml` to Node 22 and 24 and add `npm run check:ci`; drop `lint.yml` if `check:ci` covers it.
- `renovate.json`: unchanged.

## 11. Acceptance criteria

- `npm ci && npm test && npm run check:ci && npm run build` pass from a clean clone with no `game/` directory.
- With `game/` fetched, `npm run dev` boots Retro Bowl to the title screen with no mods, with `no-poki` only, and with all first-party mods, in under 1 s from "Start" to `GameMaker_Init` on a warm cache (measure and print it in the report).
- The two-mods-touch-one-function case works: a test mod that `patch`es `gml_Script_s_get_gm_version` and `show-version` that `after`s it both take effect.
- A deliberately conflicting pair produces a report naming both mods and the offending anchor, and the game still boots with the conflicting mod disabled.
- `jumbotron build-bundle` output, loaded in a plain page with no runtime, shows the same version string as the runtime path.
- No Babel package remains in any `package.json`. Root `du -sh` of the checkout, excluding `.git` and `node_modules`, is under 5 MB.
- Old packages, `data/`, and root scratch files are gone. No file references `injector`, `modkit`, `jb.json`, `TagSymbol`, or `Primitives_`.

## 12. Non-goals

- Retro Bowl College end-to-end testing (design for it, index it, do not block on it).
- Mod marketplace, signing, or sandboxing. Mods are trusted code.
- Hot module replacement without page reload.
- Supporting the old `.jb.json` format or migrating third-party mods (none exist).
- Purging game assets from git history.
