# AGENTS

This repository is an **Obsidian plugin**: **Another Habit Tracker**.

This file is written for automation agents (and future you) to quickly understand how to work on the project safely and consistently.

## Quick start

```bash
npm install
npm run dev
```

* `npm run dev` runs **esbuild in watch mode** and **vitest in watch mode** concurrently.
* The output bundle is `main.js` in the plugin folder.

## Project layout

* `main.ts`

  * Obsidian integration (commands, ribbon, modal UI, codeblock processor).
  * Calls logic exported from `core.ts`.
* `core.ts`

  * Pure logic (no Obsidian types) — this is where most unit tests should target.
* `core.test.ts`

  * Unit tests (Vitest) for `core.ts`.
* `esbuild.config.mjs`

  * Build pipeline for Obsidian plugin output.
* `manifest.json`

  * Plugin metadata.
* `versions.json`

  * Used by the sample-plugin versioning workflow.

## Commands & UI entrypoints

* **Command Palette**: opens the “Habit modal” to check/uncheck today.
* **Ribbon icon**: opens the same modal.
* **Markdown code block**: renders a dashboard/visualization.

  * `another-habit-tracker` (codeblock name)

## Dev scripts

From `package.json`:

* `npm run dev`

  * Runs `node esbuild.config.mjs` (watch) + `vitest` (watch) using `concurrently`.
* `npm run test`

  * Runs vitest (watch by default).
* `npm run test:run`

  * Runs vitest once (CI-style).
* `npm run build`

  * Typecheck (`tsc -noEmit -skipLibCheck`) + production build.
* `npm run version`

  * Bumps version + stages `manifest.json` and `versions.json`.

## Testing guidelines

* Prefer testing **pure functions** in `core.ts`.
* Use `vi.useFakeTimers()` and `vi.setSystemTime()` for date-dependent logic.
* Keep tests deterministic:

  * Avoid relying on the machine timezone for date math.
  * Use ISO dates (`YYYY-MM-DD`) consistently.

## Coding conventions

* Keep Obsidian-facing code in `main.ts`.
* Keep logic in `core.ts`:

  * No Obsidian imports.
  * Functions should accept primitives / plain objects.
* Make date calculations explicit:

  * Use ISO strings.
  * Convert to day-number via UTC when comparing consecutive days.

## Performance notes

* `entries` are assumed to be normalized via `normalizeEntries`:

  * sorted
  * unique
  * strings only
* When rendering many habits:

  * Convert `entries` to a `Set` for fast `has()` checks during window rendering.

## Release checklist

1. Ensure tests pass:

   ```bash
   npm run test:run
   ```
2. Ensure build passes:

   ```bash
   npm run build
   ```
3. Bump version:

   ```bash
   npm run version
   ```
4. Commit changes and tag if desired.

## Local Obsidian install

This repo is typically developed directly inside the vault plugin folder:

* Windows path (example):

  * `C:\Users\augus\Documents\obsidian\segundo cerebro\.obsidian\plugins\another-habit-tracker`

If you move the repo elsewhere, ensure your build output is copied/symlinked into the vault plugin folder.

## What NOT to do

* Don’t put business logic in the modal or codeblock renderer.
* Don’t add Obsidian dependencies to `core.ts`.
* Don’t introduce non-deterministic tests (time, random) without seeding or faking timers.
