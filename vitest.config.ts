import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

/**
 * Resolve the dsh source tree the dev-time link farm was built from — the
 * same order as advisor's vitest config ($DSH_SOURCE_DIR first, then
 * $DSH_HOME/source/current, then the default home location).
 */
function resolveSourceRoot(): string {
  const candidates = [
    process.env.DSH_SOURCE_DIR,
    process.env.DSH_HOME ? join(process.env.DSH_HOME, 'source', 'current') : undefined,
    join(homedir(), '.dsh', 'source', 'current'),
  ].filter((candidate): candidate is string => candidate !== undefined)
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return ''
}

const sourceRoot = resolveSourceRoot()

export default defineConfig({
  resolve: {
    alias: sourceRoot
      ? [
          // The real packages' `./client` entries are browser loader artifacts
          // (`window.__ModuleLoader__.load(...)` — served to the web shell at
          // runtime); dev-time tests resolve the client-store engine (the card
          // store's value import) to its SOURCE instead. Its value import
          // graph is node-safe: zustand + immer resolve from the linked
          // packages / the registry.
          {
            find: '@deepseek-ai/dsh-client-store',
            replacement: join(sourceRoot, 'packages', 'client', 'store', 'src', 'index.ts'),
          },
        ]
      : [],
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    pool: 'forks',
  },
})
