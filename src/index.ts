/**
 * index.ts — dsh-interpreters host plugin entry.
 *
 * Registers two model-facing tools (`run_python`, `run_node`) whose
 * descriptions embed the configured interpreter paths. The paths are
 * persisted through the settings seam under the `interpreters` namespace
 * in `$DSH_HOME/settings.yaml`; runtime edits dispose and re-register the
 * tools so the model immediately sees the updated path.
 *
 * Architecture:
 *   - Composition `Config` (cordis.yml) is the first-boot seed.
 *   - `ctx.settings` namespace `interpreters` is the user-editable layer;
 *     `scope.watch()` triggers re-registration on every committed change.
 *   - Headless assemblies without a settings provider fall back to the
 *     composition config (no persistence, no live reload).
 *
 * @module @dsh-external/dsh-interpreters
 */

import type { Context } from '@deepseek-ai/cordis'
import z from 'schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-tools'
import { registerTools, type ResolvedConfig } from './tools.js'

export const name = 'dsh-interpreters'
export const inject = ['tools']

/** Settings namespace under which interpreter paths persist. */
export const SETTINGS_NAMESPACE = settingsNamespace('interpreters')

export interface Config {
  pythonPath?: string
  nodePath?: string
  timeoutMs?: number
}

export const Config = z.object({
  pythonPath: z.string().default('python').description('Path to the Python interpreter executable.'),
  nodePath: z.string().default('node').description('Path to the Node.js interpreter executable.'),
  timeoutMs: z.number().default(30000).description('Maximum execution time in milliseconds before the process is killed.'),
}) as unknown as z<Config>

/** Schemastery schema for the `interpreters` settings namespace. */
const SettingsSchema = z.object({
  pythonPath: z.string().default('python'),
  nodePath: z.string().default('node'),
  timeoutMs: z.number().default(30000),
})

/**
 * Resolve config with fallbacks for missing / invalid values.
 * @param config - raw config from cordis.yml or settings scope.
 * @returns a fully-populated {@link ResolvedConfig}.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  const pythonPath = typeof config.pythonPath === 'string' && config.pythonPath !== '' ? config.pythonPath : 'python'
  const nodePath = typeof config.nodePath === 'string' && config.nodePath !== '' ? config.nodePath : 'node'
  const timeoutMs = typeof config.timeoutMs === 'number' && config.timeoutMs > 0 ? config.timeoutMs : 30000
  return { pythonPath, nodePath, timeoutMs }
}

/**
 * Plugin body: register tools with the composition config, then swap to
 * settings-resolved config when the settings service is available.
 * @param ctx - host context carrying `tools`.
 * @param config - resolved composition config (seed).
 */
export function apply(ctx: Context, config: Config = {} as Config): void {
  let disposeTools = registerTools(ctx, resolveConfig(config))

  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(
      SETTINGS_NAMESPACE,
      SettingsSchema as unknown as z<Config>,
      { base: config as never },
    )

    const reRegister = (cfg: ResolvedConfig): void => {
      disposeTools?.()
      disposeTools = registerTools(ctx, cfg)
    }

    reRegister(resolveConfig(scope.get() as Config))

    scope.watch(() => {
      reRegister(resolveConfig(scope.get() as Config))
    })
  })

  ctx.effect(() => () => { disposeTools?.() }, 'dsh-interpreters: cleanup')
}
